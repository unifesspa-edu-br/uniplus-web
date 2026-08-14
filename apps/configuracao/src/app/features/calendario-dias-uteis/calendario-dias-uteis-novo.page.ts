import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, groupBy, map, mergeMap, Subject, switchMap } from 'rxjs';

import {
  CalendarioDiasUteisApi,
  CriarCalendarioDiasUteisCommand,
  ABRANGENCIAS,
  UNIDADES_FEDERATIVAS,
} from '@uniplus/shared-data/configuracao';
import { type CidadeResumoDto, GeoApi } from '@uniplus/shared-data/geo';
import {
  ApiResult,
  idempotencyKey,
  ProblemDetails,
  withIdempotencyKey,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';

type DiaNaoUtilFormGroupCampoNome = 'codigoMunicipio' | 'uf' | 'abrangencia' | 'descricao' | 'data';

interface DiaNaoUtilFormGroup {
  uf: FormControl<string | null>;
  codigoMunicipio: FormControl<string | null>;
  municipioNome: FormControl<string | null>;
  municipioUf: FormControl<string | null>;
  buscaMunicipio: FormControl<string>;
  abrangencia: FormControl<string>;
  data: FormControl<string>;
  descricao: FormControl<string>;
}

/**
 * Snapshot municipal da ADR-0090 tal como o formulário o mantém: código IBGE,
 * nome e UF chegam juntos da API Geo e são gravados juntos — nenhum dos três
 * nasce de digitação livre nem de constante do código.
 */
interface MunicipioOpcao {
  readonly codigoIbge: string;
  readonly nome: string;
  readonly uf: string;
}

interface MunicipioBuscaState {
  readonly opcoes: readonly MunicipioOpcao[];
  readonly carregando: boolean;
  readonly erro: boolean;
}

interface MunicipioBuscaRequest {
  readonly grupo: FormGroup<DiaNaoUtilFormGroup>;
  readonly termo: string;
  readonly uf: string;
}

interface CalendarioDiaUtilFormGroup {
  versaoDataset: FormControl<string>;
  diasNaoUteis: FormArray<FormGroup<DiaNaoUtilFormGroup>>;
}

export const DATA_DUPLICADA_DATASET_CODE =
  'uniplus.configuracao.calendario_dias_uteis.data_duplicada_no_dataset';
/**
 * Prefixo dos erros que o backend devolve ao validar a referência de cidade do
 * Geo (`uniplus.cidade_referencia.*`, ADR-0090): código obrigatório/inválido,
 * nome obrigatório/longo demais, UF obrigatória/incoerente com o prefixo. É
 * prefixo, e não uma lista fechada, porque o registro cresce no backend.
 */
export const CIDADE_REFERENCIA_CODE_PREFIX = 'uniplus.cidade_referencia.';

const CODIGO_MUNICIPIO_PATTERN = /^(?:1[1-7]|2[1-9]|3[1-35]|4[1-3]|5[0-3])\d{5}$/;
/**
 * Prefixo do código IBGE (dois primeiros dígitos) de cada UF — a mesma
 * correspondência que `ReferenciaCidadeGeo` cobra no backend. Fica nesta página
 * (chunk lazy) em vez do roster compartilhado, que é carregado no bundle
 * inicial do painel.
 */
const PREFIXO_IBGE_POR_UF: Readonly<Record<string, string>> = {
  RO: '11',
  AC: '12',
  AM: '13',
  RR: '14',
  PA: '15',
  AP: '16',
  TO: '17',
  MA: '21',
  PI: '22',
  CE: '23',
  RN: '24',
  PB: '25',
  PE: '26',
  AL: '27',
  SE: '28',
  BA: '29',
  MG: '31',
  ES: '32',
  RJ: '33',
  SP: '35',
  PR: '41',
  SC: '42',
  RS: '43',
  MS: '50',
  MT: '51',
  GO: '52',
  DF: '53',
};
const DATA_DUPLICADA_MESSAGE = 'Esta data está duplicada para a mesma abrangência e região.';
const MUNICIPIO_OBRIGATORIO_MESSAGE = 'Selecione um município na busca.';
const PARA_SIGLA = 'PA';
const MUNICIPIOS_LIMIT = 20;
const MUNICIPIO_BUSCA_DEBOUNCE_MS = 300;
const MUNICIPIO_BUSCA_VAZIA: MunicipioBuscaState = {
  opcoes: [],
  carregando: false,
  erro: false,
};

function textoNormalizado(maxLength: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = typeof control.value === 'string' ? control.value.trim() : '';
    if (value.length === 0) {
      return { required: true };
    }
    return value.length > maxLength
      ? { maxlength: { requiredLength: maxLength, actualLength: value.length } }
      : null;
  };
}

function chaveDuplicidade(grupo: FormGroup<DiaNaoUtilFormGroup>): string | null {
  const data = grupo.controls.data.value;
  const abrangencia = grupo.controls.abrangencia.value;
  if (!data || !abrangencia) {
    return null;
  }

  if (abrangencia === 'MUNICIPAL') {
    const municipio = grupo.controls.codigoMunicipio.value?.trim();
    return municipio ? `${data}|${abrangencia}|${municipio}` : null;
  }
  if (abrangencia === 'ESTADUAL') {
    const uf = grupo.controls.uf.value?.trim().toUpperCase();
    return uf ? `${data}|${abrangencia}|${uf}` : null;
  }
  return `${data}|${abrangencia}`;
}

/**
 * Exige, na linha municipal, o snapshot inteiro da opção escolhida na Geo:
 * código IBGE de 7 dígitos, nome e UF cujo prefixo IBGE bate com o código. É a
 * mesma coerência que `ReferenciaCidadeGeo.Validar` cobra no backend — validada
 * aqui para que uma tripla incompleta não vire 422.
 */
function snapshotMunicipalCoerente(control: AbstractControl): ValidationErrors | null {
  const grupo = control as FormGroup<DiaNaoUtilFormGroup>;
  if (grupo.controls.abrangencia.value !== 'MUNICIPAL') {
    return null;
  }

  const codigo = grupo.controls.codigoMunicipio.value?.trim() ?? '';
  const nome = grupo.controls.municipioNome.value?.trim() ?? '';
  const uf = grupo.controls.municipioUf.value?.trim().toUpperCase() ?? '';
  if (!CODIGO_MUNICIPIO_PATTERN.test(codigo) || nome.length === 0) {
    return { snapshotMunicipal: true };
  }

  return PREFIXO_IBGE_POR_UF[uf] === codigo.slice(0, 2) ? null : { snapshotMunicipal: true };
}

function datasNaoUteisSemDuplicidade(control: AbstractControl): ValidationErrors | null {
  const chaves = new Set<string>();
  const diasNaoUteis = control as FormArray<FormGroup<DiaNaoUtilFormGroup>>;
  for (const grupo of diasNaoUteis.controls) {
    const chave = chaveDuplicidade(grupo);
    if (chave !== null && chaves.has(chave)) {
      return { dataDuplicada: true };
    }
    if (chave !== null) {
      chaves.add(chave);
    }
  }
  return null;
}

@Component({
  selector: 'cfg-calendario-dias-uteis-novo',
  imports: [ReactiveFormsModule, RouterLink],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header page-header--form">
      <a
        [routerLink]="['/calendario-dias-uteis']"
        class="btn btn--tertiary btn--sm btn--rect cfg-voltar"
      >
        <i aria-hidden="true" class="pi pi-chevron-left"></i>
        Voltar à lista
      </a>
      <div class="page-header__content">
        <h1 tabindex="-1" class="page-header__title">Novo calendário</h1>
        <p class="page-header__desc">
          Defina a versão do dataset e organize os dias não úteis por abrangência.
        </p>
      </div>
    </div>
    <form
      id="cfg-calendario-dias-uteis-form"
      [formGroup]="form"
      class="cfg-form cfg-calendario-form"
      (ngSubmit)="salvar()"
    >
      <section
        class="form-section cfg-calendario-form__identificacao"
        aria-labelledby="cfg-sec-dados-gerais"
      >
        <h2 id="cfg-sec-dados-gerais" class="form-section__title">Dados Gerais</h2>
        <div class="form-grid cfg-calendario-form__versao">
          <label class="field field--full" [class.is-error]="erroDoCampo('versaoDataset')">
            <span class="field__label is-required">Versão do dataset</span>
            <input
              type="text"
              autocapitalize="characters"
              class="input ng-untouched ng-pristine ng-invalid"
              formControlName="versaoDataset"
            />
            <span class="field__hint">Texto livre. Ex.: 2027.1</span>
            @if (erroDoCampo('versaoDataset')) {
              <span class="field__error">{{ erroDoCampo('versaoDataset') }}</span>
            }
          </label>
        </div>
      </section>
      <section class="form-section cfg-calendario-dias" aria-labelledby="cfg-mod-dias-nao-uteis">
        <div class="cfg-calendario-dias__header">
          <div>
            <h2 id="cfg-mod-dias-nao-uteis" class="form-section__title">Dias não úteis</h2>
            <p class="cfg-calendario-dias__descricao">
              Cada cartão representa uma data e a região em que ela não é útil.
            </p>
          </div>
          <button
            type="button"
            class="btn btn--primary btn--rect"
            (click)="adicionaNovoDiaNaoUtilFormGroup()"
          >
            <i class="pi pi-plus" aria-hidden="true"></i>
            Adicionar dia
          </button>
        </div>
        <ng-container formArrayName="diasNaoUteis">
          @if (diasNaoUteis.length === 0) {
            <div class="cfg-calendario-dias__empty">
              <i class="pi pi-calendar" aria-hidden="true"></i>
              <div>
                <strong>Nenhum dia adicionado</strong>
                <span>Adicione ao menos um dia não útil para criar o calendário.</span>
              </div>
            </div>
          }
          @for (diaNaoUtil of diasNaoUteis.controls; track diaNaoUtil; let index = $index) {
            <article
              class="cfg-dia-card"
              [formGroupName]="index"
              [attr.aria-labelledby]="'cfg-dia-nao-util-' + index"
            >
              <header class="cfg-dia-card__header">
                <div class="cfg-dia-card__titulo">
                  <span class="cfg-dia-card__numero" aria-hidden="true">{{ index + 1 }}</span>
                  <div>
                    <h3 [id]="'cfg-dia-nao-util-' + index">Dia não útil {{ index + 1 }}</h3>
                    <span>Informe quando e onde a regra será aplicada.</span>
                  </div>
                </div>
                <button
                  type="button"
                  class="btn btn--tertiary btn--sm btn--rect cfg-dia-card__remover"
                  (click)="removerLinhaPeloIndice(index)"
                  [disabled]="saving()"
                  [attr.aria-label]="'Remover dia não útil ' + (index + 1)"
                >
                  <i class="pi pi-trash" aria-hidden="true"></i>
                  <span>Remover</span>
                </button>
              </header>

              <div class="cfg-dia-card__grid">
                <label
                  class="field"
                  [class.is-error]="erroDoCampoDiasNaoUteis('abrangencia', index)"
                  [attr.for]="'abrangencia-' + index"
                >
                  <span class="field__label is-required">Abrangência</span>
                  <select
                    [id]="'abrangencia-' + index"
                    class="select"
                    [attr.aria-invalid]="
                      erroDoCampoDiasNaoUteis('abrangencia', index) ? 'true' : null
                    "
                    (change)="mudaAbrangencia(index)"
                    formControlName="abrangencia"
                  >
                    @for (abrangencia of abrangencias(); track abrangencia.value) {
                      <option [value]="abrangencia.value">{{ abrangencia.label }}</option>
                    }
                  </select>
                  @if (erroDoCampoDiasNaoUteis('abrangencia', index)) {
                    <span class="field__error">{{
                      erroDoCampoDiasNaoUteis('abrangencia', index)
                    }}</span>
                  }
                </label>

                @if (
                  diaNaoUtil.controls.abrangencia.value === 'MUNICIPAL' ||
                  diaNaoUtil.controls.abrangencia.value === 'ESTADUAL'
                ) {
                  <label class="field" [class.is-error]="erroDoCampoDiasNaoUteis('uf', index)">
                    <span class="field__label is-required">
                      {{
                        diaNaoUtil.controls.abrangencia.value === 'MUNICIPAL'
                          ? 'Estado para busca'
                          : 'Unidade Federativa (UF)'
                      }}
                    </span>
                    <select
                      [id]="'uf-' + index"
                      class="select"
                      [attr.aria-invalid]="erroDoCampoDiasNaoUteis('uf', index) ? 'true' : null"
                      formControlName="uf"
                      (change)="mudaUf(index)"
                    >
                      @for (
                        unidadeFederativa of unidadesFederativas();
                        track unidadeFederativa.id
                      ) {
                        <option [value]="unidadeFederativa.sigla">
                          {{ unidadeFederativa.nome }} - {{ unidadeFederativa.sigla }}
                        </option>
                      }
                    </select>
                    @if (erroDoCampoDiasNaoUteis('uf', index)) {
                      <span class="field__error">{{ erroDoCampoDiasNaoUteis('uf', index) }}</span>
                    }
                  </label>
                }

                @if (diaNaoUtil.controls.abrangencia.value === 'MUNICIPAL') {
                  <div
                    class="field field--full cfg-dia-card__municipio"
                    [class.is-error]="erroDoCampoDiasNaoUteis('codigoMunicipio', index)"
                  >
                    <label [for]="'busca-municipio-' + index" class="field__label is-required">
                      Município
                    </label>
                    <div class="cfg-municipio-busca">
                      <div class="cfg-municipio-busca__input">
                        <i class="pi pi-search" aria-hidden="true"></i>
                        <input
                          [id]="'busca-municipio-' + index"
                          type="search"
                          autocomplete="off"
                          class="input"
                          formControlName="buscaMunicipio"
                          placeholder="Digite ao menos 2 letras"
                          (input)="buscarMunicipios(index, valorDoInput($event))"
                        />
                      </div>
                      <select
                        [id]="'codigo-municipio-' + index"
                        class="select"
                        formControlName="codigoMunicipio"
                        aria-label="Selecionar município"
                        [attr.aria-invalid]="
                          erroDoCampoDiasNaoUteis('codigoMunicipio', index) ? 'true' : null
                        "
                        (change)="selecionarMunicipio(index)"
                      >
                        <option value="" disabled>
                          {{
                            estadoBuscaMunicipio(index).carregando
                              ? 'Buscando…'
                              : 'Selecione o município'
                          }}
                        </option>
                        @for (
                          municipio of estadoBuscaMunicipio(index).opcoes;
                          track municipio.codigoIbge
                        ) {
                          <option [value]="municipio.codigoIbge">
                            {{ municipio.nome }} — {{ municipio.uf }}
                          </option>
                        }
                      </select>
                    </div>
                    @if (estadoBuscaMunicipio(index).carregando) {
                      <span class="field__hint" role="status">Consultando a API Geo…</span>
                    } @else if (estadoBuscaMunicipio(index).erro) {
                      <span class="field__error" role="alert">
                        Não foi possível buscar os municípios.
                        <button
                          type="button"
                          class="cfg-link-button"
                          (click)="recarregarMunicipios(index)"
                        >
                          Tentar novamente
                        </button>
                      </span>
                    } @else if (buscaSemResultado(index)) {
                      <span class="field__hint">Nenhum município encontrado para essa busca.</span>
                    } @else if (municipioSelecionado(index); as municipio) {
                      <span class="field__hint">
                        Selecionado: {{ municipio.nome }} — {{ municipio.uf }}
                      </span>
                    } @else {
                      <span class="field__hint">
                        A busca usa o nome; o código IBGE é preenchido automaticamente.
                      </span>
                    }
                    @if (erroDoCampoDiasNaoUteis('codigoMunicipio', index)) {
                      <span class="field__error">{{
                        erroDoCampoDiasNaoUteis('codigoMunicipio', index)
                      }}</span>
                    }
                  </div>
                }

                <label class="field" [class.is-error]="erroDoCampoDiasNaoUteis('data', index)">
                  <span class="field__label is-required">Data</span>
                  <input [id]="'data-' + index" class="input" type="date" formControlName="data" />
                  <span class="field__hint">Não repita a mesma data, abrangência e região.</span>
                  @if (erroDoCampoDiasNaoUteis('data', index)) {
                    <span class="field__error">{{ erroDoCampoDiasNaoUteis('data', index) }}</span>
                  }
                </label>

                <label
                  class="field field--full cfg-dia-card__descricao-field"
                  [class.is-error]="erroDoCampoDiasNaoUteis('descricao', index)"
                >
                  <span class="field__label is-required">Descrição</span>
                  <textarea
                    [id]="'descricao-' + index"
                    class="textarea cfg-dia-card__descricao"
                    formControlName="descricao"
                    placeholder="Ex.: Aniversário do município"
                  ></textarea>
                  <span class="field__hint">Até 200 caracteres.</span>
                  @if (erroDoCampoDiasNaoUteis('descricao', index)) {
                    <span class="field__error">{{
                      erroDoCampoDiasNaoUteis('descricao', index)
                    }}</span>
                  }
                </label>
              </div>
            </article>
          }
        </ng-container>
      </section>
    </form>
    <div class="cfg-form-footer cfg-calendario-form__footer">
      <a [routerLink]="['/calendario-dias-uteis']" class="btn btn--tertiary btn--rect">Cancelar</a>
      <button
        type="submit"
        form="cfg-calendario-dias-uteis-form"
        class="btn btn--primary"
        [disabled]="saving() || form.invalid"
      >
        Criar calendário
      </button>
    </div>
  `,
  styles: `
    .cfg-calendario-form {
      gap: var(--space-7);
      overflow: visible;
    }

    .cfg-calendario-form__identificacao,
    .cfg-calendario-form__versao {
      max-width: 34rem;
    }

    .cfg-calendario-dias__header {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-4);
    }

    .cfg-calendario-dias__header .btn {
      justify-content: center;
    }

    .cfg-calendario-dias__descricao {
      margin: var(--space-1) 0 0;
      color: var(--text-secondary);
      font-size: var(--text-sm);
    }

    .cfg-calendario-dias__empty {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-height: 7rem;
      padding: var(--space-5);
      color: var(--text-secondary);
      background: var(--surface-subtle);
      border: 1px dashed var(--border-default);
      border-radius: var(--radius-lg);
    }

    .cfg-calendario-dias__empty > i {
      color: var(--color-primary);
      font-size: var(--text-xl);
    }

    .cfg-calendario-dias__empty div {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .cfg-calendario-dias__empty strong {
      color: var(--text-heading);
    }

    .cfg-dia-card {
      overflow: hidden;
      background: var(--surface-card);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-1);
    }

    .cfg-dia-card + .cfg-dia-card {
      margin-top: var(--space-4);
    }

    .cfg-dia-card__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-4);
      background: var(--surface-subtle);
      border-bottom: 1px solid var(--border-subtle);
    }

    .cfg-dia-card__titulo {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-width: 0;
    }

    .cfg-dia-card__titulo h3 {
      margin: 0;
      color: var(--text-heading);
      font-size: var(--text-base);
    }

    .cfg-dia-card__titulo div > span {
      display: block;
      margin-top: 2px;
      color: var(--text-secondary);
      font-size: var(--text-xs);
    }

    .cfg-dia-card__numero {
      display: inline-flex;
      flex: 0 0 2rem;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      color: var(--color-primary);
      background: var(--surface-page);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-pill);
      font-size: var(--text-sm);
      font-weight: var(--weight-bold);
    }

    .cfg-dia-card__remover span {
      display: none;
    }

    .cfg-dia-card__grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-4);
      padding: var(--space-4);
    }

    .cfg-dia-card__municipio {
      min-width: 0;
    }

    .cfg-municipio-busca {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-2);
    }

    .cfg-municipio-busca__input {
      position: relative;
    }

    .cfg-municipio-busca__input > i {
      position: absolute;
      top: 50%;
      left: var(--space-3);
      z-index: 1;
      color: var(--text-muted);
      transform: translateY(-50%);
      pointer-events: none;
    }

    .cfg-municipio-busca__input .input {
      padding-left: calc(var(--space-3) + 1.25rem);
    }

    .cfg-dia-card__descricao {
      min-height: 5rem;
    }

    .cfg-dia-card__descricao-field {
      grid-column: 1 / -1;
    }

    .cfg-calendario-form__footer {
      margin-top: auto;
    }

    @media (max-width: 479px) {
      .cfg-calendario-form__footer > .btn {
        flex: 1 1 auto;
        justify-content: center;
      }
    }

    @media (min-width: 720px) {
      .cfg-calendario-dias__header {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
      }

      .cfg-dia-card__header,
      .cfg-dia-card__grid {
        padding: var(--space-5);
      }

      .cfg-dia-card__remover span {
        display: inline;
      }

      .cfg-dia-card__grid,
      .cfg-municipio-busca {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
  host: { class: 'cfg-page' },
})
export class CalendarioDiasUteisNovoPage {
  private readonly api = inject(CalendarioDiasUteisApi);
  private readonly geo = inject(GeoApi);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  protected readonly form: FormGroup<CalendarioDiaUtilFormGroup> = new FormGroup({
    versaoDataset: new FormControl('', {
      nonNullable: true,
      validators: [textoNormalizado(60)],
    }),
    diasNaoUteis: new FormArray<FormGroup<DiaNaoUtilFormGroup>>([], {
      validators: [datasNaoUteisSemDuplicidade],
    }),
  });
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly abrangencias = signal(ABRANGENCIAS);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());
  protected readonly unidadesFederativas = signal(UNIDADES_FEDERATIVAS);
  protected readonly estadosBuscaMunicipio = signal<readonly MunicipioBuscaState[]>([]);
  private readonly buscaMunicipioRequests = new Subject<MunicipioBuscaRequest>();

  constructor() {
    this.buscaMunicipioRequests
      .pipe(
        // Debounce e cancelamento são por linha: com um fluxo único, digitar
        // numa segunda linha municipal descartava a busca da primeira, que
        // ficava em "Buscando…" para sempre — e sem snapshot não há como salvar.
        //
        // O grupo de cada linha vive enquanto a página viver (encerrado em bloco
        // pelo `takeUntilDestroyed`). Expirá-lo por inatividade quebraria o
        // cancelamento: uma requisição ainda em voo sobreviveria ao grupo, e a
        // busca seguinte nasceria noutro `switchMap`, sem cancelá-la — duas
        // respostas para a mesma linha, com a antiga podendo chegar por último.
        // O preço é reter o grupo de uma linha removida, que é irrisório perto
        // de aceitar resultado obsoleto.
        groupBy((request) => request.grupo),
        mergeMap((linha) =>
          linha.pipe(
            debounceTime(MUNICIPIO_BUSCA_DEBOUNCE_MS),
            switchMap((request) =>
              this.geo
                .listarCidades({ uf: request.uf, q: request.termo, limit: MUNICIPIOS_LIMIT })
                .pipe(map((result) => ({ request, result }))),
            ),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ request, result }) => this.aplicarResultadoMunicipios(request, result));
  }

  protected salvar(): void {
    if (this.saving()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // Validação client-side: obrigatório ter pelo menos um dia não útil para cadastrar
    if (this.form.controls.diasNaoUteis.length === 0) {
      this.notifications.error('ao menos um dia não útil é obrigatório');
      this.formError.set('Ao menos um dia não útil é obrigatório');
      return;
    }

    this.saving.set(true);
    const command: CriarCalendarioDiasUteisCommand = {
      versaoDataset: this.form.controls.versaoDataset.value.trim(),
      diasNaoUteis: this.form.controls.diasNaoUteis.controls.map((control, index) => {
        const abrangencia = control.controls.abrangencia.value;
        // Snapshot da ADR-0090: os três campos saem juntos da opção da Geo e só
        // existem em MUNICIPAL — o backend recusa qualquer um deles fora dela.
        const municipio = abrangencia === 'MUNICIPAL' ? this.municipioSelecionado(index) : null;
        return {
          abrangencia,
          data: control.controls.data.value,
          uf: abrangencia === 'ESTADUAL' ? control.controls.uf.value || null : null,
          municipioIbge: municipio?.codigoIbge ?? null,
          municipioNome: municipio?.nome ?? null,
          municipioUf: municipio?.uf ?? null,
          descricao: control.controls.descricao.value.trim(),
        };
      }),
    };

    this.api
      .criar(command, withIdempotencyKey(this.idempotencyKeyAtual()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result));
  }

  private renovarIdempotencyKey(): void {
    this.idempotencyKeyAtual.set(idempotencyKey.create());
  }

  private aplicarFalha(problem: ProblemDetails): void {
    if (problem.status === 422 && problem.code === DATA_DUPLICADA_DATASET_CODE) {
      this.notifications.errorFromProblem(problem);
      this.renovarIdempotencyKey();
      this.marcarDatasDuplicadasComoTocadas(problem);
      return;
    }

    if (problem.status === 422 && problem.code?.startsWith(CIDADE_REFERENCIA_CODE_PREFIX)) {
      this.notifications.errorFromProblem(problem);
      this.renovarIdempotencyKey();
      // O erro da referência de cidade não carrega a data no `detail`, então só
      // dá para apontar a linha quando existe uma única municipal no dataset.
      const municipais = this.diasNaoUteis.controls.filter(
        (control) => control.controls.abrangencia.value === 'MUNICIPAL',
      );
      if (municipais.length === 1 && problem.detail) {
        const municipio = municipais[0].controls.codigoMunicipio;
        municipio.setErrors({
          ...municipio.errors,
          backend: { code: problem.code, message: problem.detail },
        });
        municipio.markAsTouched();
      }
      return;
    }

    this.notifications.errorFromProblem(problem);
    if (problem.status === 422) {
      this.renovarIdempotencyKey();
    }
  }

  private marcarDatasDuplicadasComoTocadas(problem: ProblemDetails): void {
    const data = this.extrairData(problem);
    if (!data) {
      return;
    }
    this.diasNaoUteis.controls.forEach((grupo, index) => {
      if (grupo.controls.data.value === data && this.linhaDuplicada(index)) {
        grupo.controls.data.markAsTouched();
      }
    });
  }

  private extrairData(problem: ProblemDetails): string | null {
    return problem.detail?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
  }

  private handleSalvarResult(result: ApiResult<string | void>): void {
    this.saving.set(false);
    if (result.ok) {
      this.notifications.success('Calendário criado');
      this.router.navigateByUrl('/calendario-dias-uteis');
      return;
    }
    this.aplicarFalha(result.problem);
  }

  protected erroDoCampoDiasNaoUteis(nome: keyof DiaNaoUtilFormGroup, index: number): string | null {
    const grupo = this.diasNaoUteis.controls[index];
    const control = grupo.get(nome);
    if (!control) {
      return null;
    }
    const shouldShowError = control.touched || control.dirty;
    if (!shouldShowError) {
      return null;
    }
    if (nome === 'data' && this.linhaDuplicada(index)) {
      return DATA_DUPLICADA_MESSAGE;
    }
    // O snapshot incompleto é erro do grupo (nome e UF não têm campo próprio na
    // tela), mas quem o resolve é a seleção no campo Município.
    if (nome === 'codigoMunicipio' && grupo.errors?.['snapshotMunicipal']) {
      return MUNICIPIO_OBRIGATORIO_MESSAGE;
    }
    if (control.errors === null) {
      return null;
    }
    if (control.errors['backend']) {
      const backend = control.errors['backend'] as { code: string; message: string };
      return backend.message;
    }
    if (control.errors['required']) return 'Campo obrigatório.';
    if (control.errors['minlength'])
      return `Informe ao menos ${control.errors['minlength']['requiredLength']} caracteres.`;
    if (control.errors['maxlength']) return 'Valor acima do tamanho permitido.';
    return 'Valor inválido.';
  }

  protected erroDoCampo(nome: keyof CalendarioDiaUtilFormGroup): string | null {
    const control = this.form.controls[nome];
    const shouldShowError = control.touched || control.dirty;
    if (!shouldShowError || control.errors === null) {
      return null;
    }
    if (control.errors['backend']) {
      const backend = control.errors['backend'] as { code: string; message: string };
      return backend.message;
    }
    if (control.errors['required']) return 'Campo obrigatório.';
    if (control.errors['minlength'])
      return `Informe ao menos ${control.errors['minlength']['requiredLength']} caracteres.`;
    if (control.errors['maxlength']) return 'Valor acima do tamanho permitido.';
    return 'Valor inválido.';
  }

  protected mudaAbrangencia(index: number): void {
    const control = this.form.controls.diasNaoUteis.at(index);
    if (!control) {
      return;
    }
    const abrangencia = control.controls.abrangencia.value;
    const municipio = control.controls.codigoMunicipio;
    const uf = control.controls.uf;
    const buscaMunicipio = control.controls.buscaMunicipio;

    municipio.clearValidators();
    uf.clearValidators();
    this.limparSnapshotMunicipal(control);

    if (abrangencia === 'MUNICIPAL') {
      // A UF aqui é só o filtro da busca na Geo — não é persistida (o backend
      // recusa `uf` fora de ESTADUAL); a UF do município vem no snapshot.
      uf.setValue(PARA_SIGLA);
      uf.setValidators([Validators.required, Validators.pattern(/^[A-Z]{2}$/)]);
      municipio.setValidators([Validators.required, Validators.pattern(CODIGO_MUNICIPIO_PATTERN)]);
      this.atualizarEstadoMunicipio(index, MUNICIPIO_BUSCA_VAZIA);
    } else if (abrangencia === 'ESTADUAL') {
      uf.setValue(PARA_SIGLA);
      buscaMunicipio.reset('');
      uf.setValidators([Validators.required, Validators.pattern(/^[A-Z]{2}$/)]);
      this.atualizarEstadoMunicipio(index, MUNICIPIO_BUSCA_VAZIA);
    } else {
      uf.reset('');
      buscaMunicipio.reset('');
      this.atualizarEstadoMunicipio(index, MUNICIPIO_BUSCA_VAZIA);
    }

    municipio.updateValueAndValidity();
    uf.updateValueAndValidity();
  }

  /**
   * Descarta a tripla inteira — código, nome e UF andam juntos, sob pena de
   * sobrar um display cache de um município que não é mais o selecionado.
   */
  private limparSnapshotMunicipal(grupo: FormGroup<DiaNaoUtilFormGroup>): void {
    grupo.controls.codigoMunicipio.reset('');
    grupo.controls.municipioNome.reset(null);
    grupo.controls.municipioUf.reset(null);
  }

  protected mudaUf(index: number): void {
    const grupo = this.diasNaoUteis.at(index);
    if (!grupo || grupo.controls.abrangencia.value !== 'MUNICIPAL') {
      return;
    }

    // Trocar o estado da busca invalida o município escolhido no estado anterior.
    this.limparSnapshotMunicipal(grupo);
    grupo.controls.buscaMunicipio.reset('');
    this.atualizarEstadoMunicipio(index, MUNICIPIO_BUSCA_VAZIA);
    grupo.controls.codigoMunicipio.updateValueAndValidity();
  }

  protected buscarMunicipios(index: number, termo: string): void {
    const grupo = this.diasNaoUteis.at(index);
    const uf = grupo?.controls.uf.value?.trim().toUpperCase() ?? '';
    const normalizado = termo.trim();
    if (!grupo || grupo.controls.abrangencia.value !== 'MUNICIPAL') {
      return;
    }

    grupo.controls.buscaMunicipio.setValue(termo, { emitEvent: false });
    const selecionado = this.municipioSelecionado(index);
    if (
      selecionado &&
      normalizado.localeCompare(selecionado.nome, 'pt-BR', { sensitivity: 'base' }) !== 0
    ) {
      this.limparSnapshotMunicipal(grupo);
    }
    if (normalizado.length < 2 || uf.length !== 2) {
      this.atualizarEstadoMunicipio(index, {
        opcoes: [],
        carregando: false,
        erro: false,
      });
      return;
    }

    this.atualizarEstadoMunicipio(index, {
      ...this.estadoBuscaMunicipio(index),
      carregando: true,
      erro: false,
    });
    this.buscaMunicipioRequests.next({ grupo, termo: normalizado, uf });
  }

  protected recarregarMunicipios(index: number): void {
    const grupo = this.diasNaoUteis.at(index);
    if (!grupo) {
      return;
    }
    const termo = grupo.controls.buscaMunicipio.value.trim();
    const uf = grupo.controls.uf.value?.trim().toUpperCase() ?? '';
    if (termo.length < 2 || uf.length !== 2) {
      return;
    }
    this.atualizarEstadoMunicipio(index, {
      ...this.estadoBuscaMunicipio(index),
      carregando: true,
      erro: false,
    });
    this.buscaMunicipioRequests.next({ grupo, termo, uf });
  }

  /**
   * Grava a tripla da opção escolhida no `<select>` alimentado pela Geo. É o
   * único ponto que escreve o snapshot: nome e UF nunca vêm do que foi digitado.
   */
  protected selecionarMunicipio(index: number): void {
    const grupo = this.diasNaoUteis.at(index);
    if (!grupo) {
      return;
    }
    const codigo = grupo.controls.codigoMunicipio.value;
    const opcao = this.estadoBuscaMunicipio(index).opcoes.find(
      (candidata) => candidata.codigoIbge === codigo,
    );
    if (!opcao) {
      this.limparSnapshotMunicipal(grupo);
      return;
    }
    grupo.controls.municipioNome.setValue(opcao.nome);
    grupo.controls.municipioUf.setValue(opcao.uf);
    grupo.controls.buscaMunicipio.setValue(opcao.nome, { emitEvent: false });
  }

  protected estadoBuscaMunicipio(index: number): MunicipioBuscaState {
    return this.estadosBuscaMunicipio()[index] ?? MUNICIPIO_BUSCA_VAZIA;
  }

  /** Snapshot já gravado na linha — independe da lista de busca vigente. */
  protected municipioSelecionado(index: number): MunicipioOpcao | null {
    const grupo = this.diasNaoUteis.at(index);
    const codigoIbge = grupo?.controls.codigoMunicipio.value?.trim();
    const nome = grupo?.controls.municipioNome.value?.trim();
    const uf = grupo?.controls.municipioUf.value?.trim();
    return codigoIbge && nome && uf ? { codigoIbge, nome, uf } : null;
  }

  protected buscaSemResultado(index: number): boolean {
    const grupo = this.diasNaoUteis.at(index);
    const state = this.estadoBuscaMunicipio(index);
    return (
      (grupo?.controls.buscaMunicipio.value.trim().length ?? 0) >= 2 &&
      !state.carregando &&
      !state.erro &&
      state.opcoes.length === 0
    );
  }

  protected valorDoInput(event: Event): string {
    return event.target instanceof HTMLInputElement ? event.target.value : '';
  }

  private aplicarResultadoMunicipios(
    request: MunicipioBuscaRequest,
    result: ApiResult<readonly CidadeResumoDto[]>,
  ): void {
    const index = this.diasNaoUteis.controls.indexOf(request.grupo);
    if (index < 0) {
      return;
    }
    const termoAtual = request.grupo.controls.buscaMunicipio.value.trim();
    const ufAtual = request.grupo.controls.uf.value?.trim().toUpperCase();
    if (termoAtual !== request.termo || ufAtual !== request.uf) {
      return;
    }

    const state = this.estadoBuscaMunicipio(index);
    const selecionado = this.municipioSelecionado(index);
    const opcoes: MunicipioOpcao[] = result.ok ? [...result.data] : [...state.opcoes];
    if (selecionado && !opcoes.some((opcao) => opcao.codigoIbge === selecionado.codigoIbge)) {
      opcoes.unshift(selecionado);
    }
    this.atualizarEstadoMunicipio(index, {
      opcoes,
      carregando: false,
      erro: !result.ok,
    });
  }

  private atualizarEstadoMunicipio(index: number, state: MunicipioBuscaState): void {
    this.estadosBuscaMunicipio.update((estados) => {
      const atualizados = [...estados];
      atualizados[index] = state;
      return atualizados;
    });
  }

  private linhaDuplicada(index: number): boolean {
    const grupo = this.diasNaoUteis.at(index);
    const chave = grupo ? chaveDuplicidade(grupo) : null;
    return (
      chave !== null &&
      this.diasNaoUteis.controls.filter((candidato) => chaveDuplicidade(candidato) === chave)
        .length > 1
    );
  }

  private criaDiaNaoUtilFormGroup(): FormGroup<DiaNaoUtilFormGroup> {
    return new FormGroup<DiaNaoUtilFormGroup>(
      {
        abrangencia: new FormControl('ESTADUAL', {
          nonNullable: true,
          validators: [Validators.required],
        }),
        codigoMunicipio: new FormControl('', {
          nonNullable: false,
          validators: [],
        }),
        municipioNome: new FormControl(null, { nonNullable: false }),
        municipioUf: new FormControl(null, { nonNullable: false }),
        buscaMunicipio: new FormControl('', {
          nonNullable: true,
        }),
        uf: new FormControl(PARA_SIGLA, {
          nonNullable: false,
          validators: [Validators.required, Validators.pattern(/^[A-Z]{2}$/)],
        }),
        data: new FormControl('', {
          nonNullable: true,
          validators: [Validators.required],
        }),
        descricao: new FormControl('', {
          nonNullable: true,
          validators: [textoNormalizado(200)],
        }),
      },
      { validators: [snapshotMunicipalCoerente] },
    );
  }

  protected get diasNaoUteis(): FormArray<FormGroup<DiaNaoUtilFormGroup>> {
    return this.form.controls.diasNaoUteis;
  }

  protected removerLinhaPeloIndice(index: number): void {
    this.diasNaoUteis.removeAt(index);
    this.estadosBuscaMunicipio.update((estados) => estados.filter((_, i) => i !== index));
  }

  protected adicionaNovoDiaNaoUtilFormGroup(): void {
    this.form.controls.diasNaoUteis.push(this.criaDiaNaoUtilFormGroup());
    this.estadosBuscaMunicipio.update((estados) => [...estados, MUNICIPIO_BUSCA_VAZIA]);
  }

  protected erroDoCampoDiaNaoUtil(
    index: number,
    nome: DiaNaoUtilFormGroupCampoNome,
  ): string | null {
    const grupo = this.form.controls.diasNaoUteis.at(index);
    if (!grupo) {
      return null;
    }
    return this.erroDeControle(grupo.controls[nome]);
  }

  private erroDeControle(control: AbstractControl): string | null {
    const shouldShowError = control.touched || control.dirty;
    if (!shouldShowError || control.errors === null) {
      return null;
    }
    if (control.errors['backend']) {
      const backend = control.errors['backend'] as { code: string; message: string };
      return backend.message;
    }
    if (control.errors['required']) {
      return 'Campo obrigatório.';
    }

    if (control.errors['maxlength']) {
      return 'Valor acima do tamanho permitido.';
    }
    return 'Valor inválido.';
  }
}
