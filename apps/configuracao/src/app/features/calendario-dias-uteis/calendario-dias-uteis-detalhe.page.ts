import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  model,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  ApiResult,
  idempotencyKey,
  ProblemDetails,
  ProblemI18nService,
  useApiResource,
  withIdempotencyKey,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { formatIsoDateBr, formatIsoDateLong } from '@uniplus/shared-data/utils';
import {
  ABRANGENCIAS,
  CalendarioDiasUteisApi,
  CalendarioDiasUteisDto,
  CONFIGURACAO_BASE_PATH,
  DiaNaoUtilCommandItem,
  DiaNaoUtilDto,
  UNIDADES_FEDERATIVAS,
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  DialogComponent,
  DrawerComponent,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { debounceTime, groupBy, map, mergeMap, Subject, switchMap, tap } from 'rxjs';

import {
  agruparPorMes,
  anosDoCalendario,
  type CelulaCalendarioMensal,
} from './calendario-mensal.util';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CODIGO_MUNICIPIO_PATTERN,
  DIAS_SEMANA,
  MUNICIPIO_BUSCA_DEBOUNCE_MS,
  MUNICIPIO_BUSCA_VAZIA,
  MunicipioBuscaRequest,
  MunicipioBuscaState,
  MunicipioOpcao,
  MUNICIPIOS_LIMIT,
  nullIfBlank,
  PARA_SIGLA,
  PREFIXO_IBGE_POR_UF,
  textoNormalizado,
} from './calendario-dias-uteis.util';
import {
  CIDADE_REFERENCIA_CODE_PREFIX,
  DATA_DUPLICADA_DATASET_CODE,
} from './calendario-dias-uteis-novo.page';
import { DATA_PATTERN } from './calendario-dias-uteis.util';
import { type CidadeResumoDto, GeoApi } from '@uniplus/shared-data/geo';

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

@Component({
  selector: 'cfg-calendario-dias-uteis-detalhe',
  imports: [
    RouterLink,
    AlertComponent,
    SpinnerComponent,
    DrawerComponent,
    TagComponent,
    ReactiveFormsModule,
    DialogComponent,
  ],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header--form">
      <a class="btn btn--tertiary btn--sm btn--rect cfg-voltar" routerLink="/calendario-dias-uteis">
        <i class="pi pi-chevron-left" aria-hidden="true"></i>
        Voltar à lista
      </a>
      <div class="page-header__content">
        <h1 class="page-header__title" tabindex="-1">Detalhes</h1>
      </div>
    </div>
    @if (calendarioResource.isLoading()) {
      <div class="cfg-loading" role="status"><ui-spinner /> Carregando calendário</div>
    } @else if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar o calendário">
        {{ errorMessage() }}
        <div class="cfg-calendario-dias-uteis__retry">
          <button type="button" class="btn btn--secondary btn--sm" (click)="tentarNovamente()">
            Tentar novamente
          </button>
        </div>
      </ui-alert>
    } @else if (calendario(); as calendarioAtual) {
      <dl class="cfg-calendario-resumo">
        <div class="cfg-calendario-resumo__item">
          <dt>Versão do dataset</dt>
          <dd>{{ calendarioAtual.versaoDataset }}</dd>
        </div>
        <div class="cfg-calendario-resumo__item">
          <dt>Situação</dt>
          <dd>
            @if (calendarioAtual.vigente) {
              <ui-tag variant="success">Vigente</ui-tag>
            } @else {
              <ui-tag>Não vigente</ui-tag>
            }
          </dd>
        </div>
        <div class="cfg-calendario-resumo__item">
          <dt>Dias não úteis</dt>
          <dd>{{ totalDiasNaoUteis() }}</dd>
        </div>
      </dl>

      <div class="cfg-calendario-mensal__lista">
        @for (mes of meses(); track mes.chave) {
          <section
            class="cfg-calendario-mensal"
            [attr.aria-labelledby]="'cfg-mes-titulo-' + mes.chave"
          >
            <h2 [id]="'cfg-mes-titulo-' + mes.chave" class="cfg-calendario-mensal__titulo">
              {{ mes.rotulo }}
            </h2>
            <table class="cfg-calendario-mensal__tabela">
              <caption class="sr-only">
                Calendário de
                {{
                  mes.rotulo
                }}
              </caption>
              <thead>
                <tr>
                  @for (diaSemana of diasSemana; track diaSemana.abrev) {
                    <th scope="col">
                      <span aria-hidden="true">{{ diaSemana.abrev }}</span>
                      <span class="sr-only">{{ diaSemana.nome }}</span>
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (semana of mes.semanas; track $index) {
                  <tr>
                    @for (celula of semana; track $index) {
                      <td>
                        @if (celula) {
                          @if (celula.ocorrencias.length > 0) {
                            <button
                              type="button"
                              class="cfg-calendario-mensal__dia cfg-calendario-mensal__dia--feriado"
                              [attr.aria-label]="ariaLabelDia(celula)"
                              (click)="abrirDrawer(celula)"
                              (mouseenter)="mostrarPreview(celula.data)"
                              (mouseleave)="ocultarPreviewSeSemFoco($event)"
                              (focus)="mostrarPreview(celula.data)"
                              (blur)="ocultarPreviewSeSemHover($event)"
                              (keydown.escape)="ocultarPreview()"
                            >
                              <span aria-hidden="true">{{ celula.dia }}</span>
                              <span
                                class="cfg-calendario-mensal__marcador"
                                aria-hidden="true"
                              ></span>
                              @if (celula.ocorrencias.length > 1) {
                                <!-- Contador pintado em ::before (ver styles) — SC 2.5.3. -->
                                <span
                                  class="cfg-calendario-mensal__contador"
                                  aria-hidden="true"
                                  [attr.data-contador]="celula.ocorrencias.length"
                                ></span>
                              }
                              @if (diaEmPreview() === celula.data) {
                                <span class="cfg-calendario-mensal__preview" aria-hidden="true">
                                  {{ previewTexto(celula) }}
                                </span>
                              }
                            </button>
                          } @else {
                            <button
                              class="cfg-calendario-mensal__dia"
                              (click)="abrirDrawer(celula)"
                            >
                              {{ celula.dia }}
                            </button>
                          }
                        }
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </section>
        }
      </div>

      <ui-drawer
        [(visible)]="drawerVisivel"
        [heading]="tituloDrawer()"
        [ariaLabel]="tituloDrawer()"
        (closed)="resetaFormulario()"
      >
        @for (ocorrencia of ocorrenciasSelecionadas(); track ocorrencia.id) {
          <article class="cfg-calendario-mensal__ocorrencia">
            <h3>{{ ocorrencia.descricao }}</h3>
            <dl>
              <div>
                <dt>Abrangência</dt>
                <dd>{{ abrangenciaLegivel(ocorrencia.abrangencia) }}</dd>
              </div>
              <div>
                <dt>Data</dt>
                <dd>{{ formatarDataCurta(ocorrencia.data) }}</dd>
              </div>
              @if (ocorrencia.abrangencia === 'MUNICIPAL') {
                <div>
                  <dt>Município</dt>
                  <dd>
                    <span>{{ municipioLegivel(ocorrencia) }}</span>
                    <span class="field__hint">Código IBGE: {{ ocorrencia.municipioIbge }}</span>
                  </dd>
                </div>
              }
              @if (ocorrencia.abrangencia === 'ESTADUAL') {
                <div>
                  <dt>Unidade Federativa (UF)</dt>
                  <dd>{{ ufLegivel(ocorrencia.uf) }}</dd>
                </div>
              }
            </dl>
          </article>
        } @empty {
          <div class="cfg-calendario-mensal__ocorrencia_vazia">Não há feriados cadastrados.</div>
        }
        <div class="cfg-calendario-mensal__actions">
          <button type="button" class="btn btn--primary btn--rect" (click)="abrirDialog()">
            <i class="pi pi-plus" aria-hidden="true"></i>
            Adicionar feriado
          </button>
        </div>
      </ui-drawer>
      <ui-dialog
        [(visible)]="dialogOpen"
        [heading]="'Adicionar novo feriado ao calendário'"
        (closed)="ocultarPreview()"
        (close)="resetaFormulario(); dialogOpen.set(false)"
        [hasFooter]="true"
      >
        <form
          id="cfg-calendario-dias-uteis-form"
          [formGroup]="form"
          class="cfg-form cfg-calendario-form"
          (ngSubmit)="salvar()"
        >
          <section
            class="form-section cfg-calendario-dias"
            aria-labelledby="cfg-mod-dias-nao-uteis"
          >
            <article class="cfg-dia-card">
              <div class="form-grid form-grid--1col">
                <label
                  class="field field--full"
                  [class.is-error]="erroDoCampoDiasNaoUteis('abrangencia')"
                  [attr.for]="'abrangencia'"
                >
                  <span class="field__label is-required">Abrangência</span>
                  <select
                    [id]="'abrangencia'"
                    class="select"
                    [attr.aria-invalid]="erroDoCampoDiasNaoUteis('abrangencia') ? 'true' : null"
                    (change)="mudaAbrangencia()"
                    formControlName="abrangencia"
                  >
                    @for (abrangencia of abrangencias(); track abrangencia.value) {
                      <option [value]="abrangencia.value">{{ abrangencia.label }}</option>
                    }
                  </select>
                  @if (erroDoCampoDiasNaoUteis('abrangencia')) {
                    <span class="field__error">{{ erroDoCampoDiasNaoUteis('abrangencia') }}</span>
                  }
                </label>

                @if (
                  form.controls.abrangencia.value === 'MUNICIPAL' ||
                  form.controls.abrangencia.value === 'ESTADUAL'
                ) {
                  <label class="field field--full" [class.is-error]="erroDoCampoDiasNaoUteis('uf')">
                    <span class="field__label is-required">
                      {{
                        form.controls.abrangencia.value === 'MUNICIPAL'
                          ? 'Estado para busca'
                          : 'Unidade Federativa (UF)'
                      }}
                    </span>
                    <select
                      [id]="'uf'"
                      class="select"
                      [attr.aria-invalid]="erroDoCampoDiasNaoUteis('uf') ? 'true' : null"
                      formControlName="uf"
                      (change)="mudaUf()"
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
                    @if (erroDoCampoDiasNaoUteis('uf')) {
                      <span class="field__error">{{ erroDoCampoDiasNaoUteis('uf') }}</span>
                    }
                  </label>
                }

                @if (this.form.controls.abrangencia.value === 'MUNICIPAL') {
                  <div
                    class="field field--full cfg-dia-card__municipio"
                    [class.is-error]="erroDoCampoDiasNaoUteis('codigoMunicipio')"
                  >
                    <label [for]="'busca-municipio-'" class="field__label is-required">
                      Município
                    </label>
                    <div class="cfg-municipio-busca">
                      <div class="cfg-municipio-busca__input">
                        <i class="pi pi-search" aria-hidden="true"></i>
                        <input
                          [id]="'busca-municipio-'"
                          type="search"
                          autocomplete="off"
                          class="input"
                          formControlName="buscaMunicipio"
                          placeholder="Digite ao menos 2 letras"
                          (input)="buscarMunicipios(valorDoInput($event))"
                        />
                      </div>
                      <select
                        [id]="'codigo-municipio-'"
                        class="select"
                        formControlName="codigoMunicipio"
                        aria-label="Selecionar município"
                        [attr.aria-invalid]="
                          erroDoCampoDiasNaoUteis('codigoMunicipio') ? 'true' : null
                        "
                        (change)="selecionarMunicipio()"
                      >
                        <option value="" disabled>
                          {{
                            estadoBuscaMunicipio().carregando
                              ? 'Buscando…'
                              : 'Selecione o município'
                          }}
                        </option>
                        @for (
                          municipio of estadoBuscaMunicipio().opcoes;
                          track municipio.codigoIbge
                        ) {
                          <option [value]="municipio.codigoIbge">
                            {{ municipio.nome }} — {{ municipio.uf }}
                          </option>
                        }
                      </select>
                    </div>
                    @if (estadoBuscaMunicipio().carregando) {
                      <span class="field__hint" role="status">Consultando a API Geo…</span>
                    } @else if (estadoBuscaMunicipio().erro) {
                      <span class="field__error" role="alert">
                        Não foi possível buscar os municípios.
                        <button
                          type="button"
                          class="cfg-link-button"
                          (click)="recarregarMunicipios()"
                        >
                          Tentar novamente
                        </button>
                      </span>
                    } @else if (buscaSemResultado()) {
                      <span class="field__hint">Nenhum município encontrado para essa busca.</span>
                    } @else if (municipioSelecionado(); as municipio) {
                      <span class="field__hint">
                        Selecionado: {{ municipio.nome }} — {{ municipio.uf }}
                      </span>
                    } @else {
                      <span class="field__hint">
                        A busca usa o nome; o código IBGE é preenchido automaticamente.
                      </span>
                    }
                    @if (erroDoCampoDiasNaoUteis('codigoMunicipio')) {
                      <span class="field__error">{{
                        erroDoCampoDiasNaoUteis('codigoMunicipio')
                      }}</span>
                    }
                  </div>
                }

                <label class="field" [class.is-error]="erroDoCampoDiasNaoUteis('data')">
                  <span class="field__label is-required">Data</span>
                  <input [id]="'data-'" class="input" type="date" formControlName="data" />
                  <span class="field__hint">Não repita a mesma data, abrangência e região.</span>
                  @if (erroDoCampoDiasNaoUteis('data')) {
                    <span class="field__error">{{ erroDoCampoDiasNaoUteis('data') }}</span>
                  }
                </label>
                @let erroDoCampoDescricao = erroDoCampoDiasNaoUteis('descricao');
                <label
                  class="field field--full cfg-dia-card__descricao-field"
                  [class.is-error]="erroDoCampoDescricao"
                >
                  <span class="field__label is-required">Descrição</span>
                  <textarea
                    class="textarea cfg-dia-card__descricao"
                    formControlName="descricao"
                    placeholder="Ex.: Aniversário do município"
                  ></textarea>
                  <span class="field__hint">Até 200 caracteres.</span>
                  @if (erroDoCampoDescricao) {
                    <span class="field__error">{{ erroDoCampoDescricao }}</span>
                  }
                </label>
              </div>
            </article>
          </section>
        </form>
        <div uiDialogFooter>
          <button
            class="btn btn--tertiary"
            type="button"
            [disabled]="saving()"
            (click)="dialogOpen.set(false)"
          >
            Cancelar
          </button>
          <!-- Continua habilitado enquanto grava, e de propósito: é o único controle
               que resta no diálogo nesse estado, e desabilitá-lo deixaria a janela
               aberta sem destino de foco nem de Tab. O acionamento repetido é
               inofensivo — \`confirmarGravacao()\` sai cedo com a gravação em curso —
               e \`aria-busy\` com \`aria-disabled\` dizem ao leitor de tela que ele está
               ocupado e não aceita nova ação. -->
          <button
            class="btn btn--primary"
            type="submit"
            [attr.aria-busy]="saving()"
            [attr.aria-disabled]="saving()"
            (click)="salvar()"
          >
            Adicionar
          </button>
        </div>
      </ui-dialog>
    }
  `,
  styleUrls: ['./calendario-dias-uteis.css', './calendario-dias-uteis-detalhe.page.css'],
  host: { class: 'cfg-page' },
})
export class CalendarioDiasUteisDetalhePage {
  private readonly route = inject(ActivatedRoute);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  private readonly api = inject(CalendarioDiasUteisApi);
  private readonly geo = inject(GeoApi);
  protected readonly calendarioDiaUtilId = signal(this.route.snapshot.paramMap.get('id') ?? '');
  protected readonly diasSemana = DIAS_SEMANA;
  private readonly notifications = inject(NotificationService);

  protected readonly calendarioResource = useApiResource<CalendarioDiasUteisDto>(() => ({
    url: `${this.basePath}/api/configuracao/calendarios-dias-uteis/${this.calendarioDiaUtilId()}`,
    context: withVendorMime('calendario-dias-uteis', 1),
  }));

  constructor() {
    this.route.params
      .pipe(
        tap((params) => {
          this.calendarioDiaUtilId.set(params['id'] ?? '');
          // O Angular Router reaproveita esta instância ao navegar entre duas
          // rotas :id sem passar pela lista — sem isto, o drawer reabriria
          // sozinho com o dia selecionado do calendário anterior assim que o
          // novo carregasse, e a prévia reapareceria sem hover/foco se o novo
          // calendário tivesse feriado na mesma data (comum em datas
          // nacionais), sem o Escape do botão disponível para dispensá-la
          // porque o foco já se perdeu com a grade antiga.
          this.drawerVisivel.set(false);
          this.diaSelecionado.set(null);
          this.diaEmPreview.set(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
    this.buscaMunicipioRequests
      .pipe(
        // Debounce e cancelamento são por linha:' com um fluxo único, digitar
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
        groupBy((request) => request),
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

  protected calendario = computed(() => {
    return this.calendarioResource.data();
  });

  protected readonly errorMessage = computed<string | null>(() => {
    const problem = this.calendarioResource.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.calendarioResource.error() ? 'Erro inesperado ao carregar o calendário.' : null;
  });

  protected readonly meses = computed(() => {
    const dias = this.calendario()?.diasNaoUteis ?? [];
    return anosDoCalendario(dias).flatMap((ano) => agruparPorMes(dias, ano));
  });
  /**
   * Registros do dataset, não datas do calendário. Duas ocorrências no mesmo
   * dia — abrangências diferentes, como um feriado municipal que cai num
   * nacional — são duas entradas próprias, e é por entrada que o dataset é
   * conferido antes de virar vigente.
   */
  protected readonly totalDiasNaoUteis = computed(
    () => this.calendario()?.diasNaoUteis.length ?? 0,
  );

  protected readonly diaEmPreview = signal<string | null>(null);
  protected readonly drawerVisivel = model(false);
  protected readonly diaSelecionado = signal<CelulaCalendarioMensal | null>(null);

  protected readonly ocorrenciasSelecionadas = computed(
    () => this.diaSelecionado()?.ocorrencias ?? [],
  );
  protected readonly tituloDrawer = computed(() => {
    const celula = this.diaSelecionado();
    return celula ? formatIsoDateLong(celula.data) : '';
  });
  protected readonly formError = signal<string | null>(null);
  protected readonly saving = signal(false);
  readonly submitting = signal(false);
  protected readonly formOpen = signal(false);
  readonly form = this.criaDiaNaoUtilFormGroup();
  protected readonly abrangencias = signal(ABRANGENCIAS);
  protected readonly unidadesFederativas = signal(UNIDADES_FEDERATIVAS);
  private readonly buscaMunicipioRequests = new Subject<MunicipioBuscaRequest>();
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());

  readonly dialogOpen = signal(false);
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

  protected readonly estadosBuscaMunicipio = signal<readonly MunicipioBuscaState[]>([]);

  protected mudaAbrangencia(): void {
    const abrangencia = this.form.controls.abrangencia.value;
    const municipio = this.form.controls.codigoMunicipio;
    const uf = this.form.controls.uf;
    const buscaMunicipio = this.form.controls.buscaMunicipio;

    municipio.clearValidators();
    uf.clearValidators();
    this.limparSnapshotMunicipal();

    if (abrangencia === 'MUNICIPAL') {
      // A UF aqui é só o filtro da busca na Geo — não é persistida (o backend
      // recusa `uf` fora de ESTADUAL); a UF do município vem no snapshot.
      uf.setValue(PARA_SIGLA);
      uf.setValidators([Validators.required, Validators.pattern(/^[A-Z]{2}$/)]);
      municipio.setValidators([Validators.required, Validators.pattern(CODIGO_MUNICIPIO_PATTERN)]);
      this.atualizarEstadoMunicipio(MUNICIPIO_BUSCA_VAZIA);
    } else if (abrangencia === 'ESTADUAL') {
      uf.setValue(PARA_SIGLA);
      buscaMunicipio.reset('');
      uf.setValidators([Validators.required, Validators.pattern(/^[A-Z]{2}$/)]);
      this.atualizarEstadoMunicipio(MUNICIPIO_BUSCA_VAZIA);
    } else {
      uf.reset('');
      buscaMunicipio.reset('');
      this.atualizarEstadoMunicipio(MUNICIPIO_BUSCA_VAZIA);
    }

    municipio.updateValueAndValidity();
    uf.updateValueAndValidity();
  }

  /**
   * Descarta a tripla inteira — código, nome e UF andam juntos, sob pena de
   * sobrar um display cache de um município que não é mais o selecionado.
   */
  private limparSnapshotMunicipal(): void {
    this.form.controls.codigoMunicipio.reset('');
    this.form.controls.municipioNome.reset(null);
    this.form.controls.municipioUf.reset(null);
  }

  protected mudaUf(): void {
    if (
      !this.form.controls.abrangencia.value ||
      this.form.controls.abrangencia.value !== 'MUNICIPAL'
    ) {
      return;
    }

    // Trocar o estado da busca invalida o município escolhido no estado anterior.
    this.limparSnapshotMunicipal();
    this.form.controls.buscaMunicipio.reset('');
    this.atualizarEstadoMunicipio(MUNICIPIO_BUSCA_VAZIA);
    this.form.controls.codigoMunicipio.updateValueAndValidity();
  }

  private atualizarEstadoMunicipio(state: MunicipioBuscaState): void {
    this.estadosBuscaMunicipio.update((estados) => {
      const atualizados = [...estados];
      atualizados[0] = state;
      return atualizados;
    });
  }

  protected estadoBuscaMunicipio(): MunicipioBuscaState {
    return this.estadosBuscaMunicipio()[0] ?? MUNICIPIO_BUSCA_VAZIA;
  }

  /** Snapshot já gravado na linha — independe da lista de busca vigente. */
  protected municipioSelecionado(): MunicipioOpcao | null {
    const codigoIbge = this.form.controls.codigoMunicipio.value?.trim();
    const nome = this.form.controls.municipioNome.value?.trim();
    const uf = this.form.controls.municipioUf.value?.trim();
    return codigoIbge && nome && uf ? { codigoIbge, nome, uf } : null;
  }

  protected tentarNovamente(): void {
    if (!this.calendarioResource.isLoading()) {
      this.calendarioResource.reload();
    }
  }

  protected mostrarPreview(data: string): void {
    this.diaEmPreview.set(data);
  }

  protected ocultarPreview(): void {
    this.diaEmPreview.set(null);
  }

  // Mouse sai do botão que segue com foco de teclado (cursor pousado nele
  // ao tabular, ou o usuário usa mouse e teclado juntos): sem este guard, a
  // prévia some e só volta se o usuário tabular para longe e de volta.
  protected ocultarPreviewSeSemFoco(event: MouseEvent): void {
    if (document.activeElement !== event.currentTarget) {
      this.ocultarPreview();
    }
  }

  protected ocultarPreviewSeSemHover(event: FocusEvent): void {
    const alvo = event.target as HTMLElement;
    if (!alvo.matches(':hover')) {
      this.ocultarPreview();
    }
  }

  protected abrirDrawer(celula: CelulaCalendarioMensal): void {
    this.diaSelecionado.set(celula);
    this.drawerVisivel.set(true);
  }

  /** Nome acessível do dia — cobre a mesma informação da prévia visual (CA-06), sem depender de hover. */
  protected ariaLabelDia(celula: CelulaCalendarioMensal): string {
    const dataPorExtenso = formatIsoDateLong(celula.data);
    if (celula.ocorrencias.length === 1) {
      const [ocorrencia] = celula.ocorrencias;
      return `${dataPorExtenso}: ${ocorrencia.descricao} (${this.abrangenciaLegivel(ocorrencia.abrangencia)})`;
    }
    const resumo = celula.ocorrencias
      .map(
        (ocorrencia) =>
          `${ocorrencia.descricao} (${this.abrangenciaLegivel(ocorrencia.abrangencia)})`,
      )
      .join(', ');
    return `${dataPorExtenso}: ${celula.ocorrencias.length} ocorrências — ${resumo}`;
  }

  protected previewTexto(celula: CelulaCalendarioMensal): string {
    if (celula.ocorrencias.length === 1) {
      const [ocorrencia] = celula.ocorrencias;
      return `${ocorrencia.descricao} — ${this.abrangenciaLegivel(ocorrencia.abrangencia)}`;
    }
    return `${celula.ocorrencias.length} ocorrências nesta data`;
  }

  protected abrangenciaLegivel(abrangencia: string): string {
    return ABRANGENCIAS.find((candidata) => candidata.value === abrangencia)?.label ?? abrangencia;
  }

  protected formatarDataCurta(data: string): string {
    return formatIsoDateBr(data);
  }

  /**
   * Nome e UF do município vêm do snapshot persistido no dataset (ADR-0090) —
   * a tela não consulta a Geo para resolver localidade já gravada. Registros
   * anteriores ao snapshot ficam sem nome e sem UF; não há fallback para eles
   * (a base de desenvolvimento é recriada), mas o que falta some da tela em vez
   * de virar a palavra "null" ao lado do código IBGE.
   */
  protected municipioLegivel(diaNaoUtil: DiaNaoUtilDto): string {
    return [diaNaoUtil.municipioNome, diaNaoUtil.municipioUf].filter(Boolean).join(' — ');
  }

  /** UF por extenso mais a sigla, ex.: `Pará — PA`. */
  protected ufLegivel(uf: string | null): string {
    const unidade = UNIDADES_FEDERATIVAS.find((candidata) => candidata.sigla === uf);
    return unidade ? `${unidade.nome} — ${unidade.sigla}` : (uf ?? '');
  }

  protected erroDoCampoDiasNaoUteis(nome: keyof DiaNaoUtilFormGroup): string | null {
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

  protected salvar(): void {
    if (this.saving()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const abrangencia = this.form.controls.abrangencia.value;
    const municipio = abrangencia === 'MUNICIPAL' ? this.municipioSelecionado() : null;
    const command: DiaNaoUtilCommandItem = {
      abrangencia: this.form.controls.abrangencia.value,
      data: this.form.controls.data.value,
      uf:
        this.form.controls.abrangencia.value === 'ESTADUAL'
          ? this.form.controls.uf.value || null
          : null,
      municipioIbge: municipio?.codigoIbge ?? null,
      municipioNome: municipio?.nome ?? null,
      municipioUf: municipio?.uf ?? null,
      descricao: nullIfBlank(this.form.controls.descricao.value),
    };
    this.api
      .criaNovaData(
        this.calendarioDiaUtilId(),
        command,
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result));
  }

  resetaFormulario(): void {
    this.form.reset({
      data: '',
      abrangencia: 'ESTADUAL',
      codigoMunicipio: '',
      uf: PARA_SIGLA,
      buscaMunicipio: '',
      descricao: '',
      municipioNome: null,
      municipioUf: null,
    });
    this.form.updateValueAndValidity();
  }

  private handleSalvarResult(result: ApiResult<CalendarioDiasUteisDto | void>): void {
    this.saving.set(false);
    if (result.ok) {
      this.notifications.success('Dia não útil adicionado');
      this.dialogOpen.set(false);
      this.drawerVisivel.set(false);
      this.calendarioResource.reload();
      return;
    }
    this.aplicarFalha(result.problem);
  }

  private aplicarResultadoMunicipios(
    request: MunicipioBuscaRequest,
    result: ApiResult<readonly CidadeResumoDto[]>,
  ): void {
    const termoAtual = request.grupo.controls.buscaMunicipio.value.trim();
    const ufAtual = request.grupo.controls.uf.value?.trim().toUpperCase();
    if (termoAtual !== request.termo || ufAtual !== request.uf) {
      return;
    }

    const state = this.estadoBuscaMunicipio();
    const selecionado = this.municipioSelecionado();
    const opcoes: MunicipioOpcao[] = result.ok ? [...result.data] : [...state.opcoes];
    if (selecionado && !opcoes.some((opcao) => opcao.codigoIbge === selecionado.codigoIbge)) {
      opcoes.unshift(selecionado);
    }
    this.atualizarEstadoMunicipio({
      opcoes,
      carregando: false,
      erro: !result.ok,
    });
  }

  private extrairData(problem: ProblemDetails): string | null {
    return problem.detail?.match(DATA_PATTERN)?.[0] ?? null;
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
      if (this.form.controls.abrangencia.value === 'MUNICIPAL') {
        const municipioControl = this.form.controls.codigoMunicipio;
        municipioControl.setErrors({
          ...municipioControl.errors,
          backend: { code: problem.code, message: problem.detail },
        });
        municipioControl.markAsTouched();
      }
      return;
    }

    this.notifications.errorFromProblem(problem);
    if (problem.status === 422) {
      this.renovarIdempotencyKey();
    }
  }

  protected recarregarMunicipios(): void {
    const termo = this.form.controls.buscaMunicipio.value.trim();
    const uf = this.form.controls.uf.value?.trim().toUpperCase() ?? '';
    if (termo.length < 2 || uf.length !== 2) {
      return;
    }
    this.atualizarEstadoMunicipio({
      ...this.estadoBuscaMunicipio(),
      carregando: true,
      erro: false,
    });
    this.buscaMunicipioRequests.next({ grupo: new FormGroup(this.form.controls), termo, uf });
  }

  private renovarIdempotencyKey(): void {
    this.idempotencyKeyAtual.set(idempotencyKey.create());
  }

  /**
   * Grava a tripla da opção escolhida no `<select>` alimentado pela Geo. É o
   * único ponto que escreve o snapshot: nome e UF nunca vêm do que foi digitado.
   */
  protected selecionarMunicipio(): void {
    const codigo = this.form.controls.codigoMunicipio.value;
    const opcao = this.estadoBuscaMunicipio().opcoes.find(
      (candidata) => candidata.codigoIbge === codigo,
    );
    if (!opcao) {
      this.limparSnapshotMunicipal();
      return;
    }
    this.form.controls.municipioNome.setValue(opcao.nome);
    this.form.controls.municipioUf.setValue(opcao.uf);
    this.form.controls.buscaMunicipio.setValue(opcao.nome);
    this.form.updateValueAndValidity();
  }

  protected valorDoInput(event: Event): string {
    return event.target instanceof HTMLInputElement ? event.target.value : '';
  }

  protected buscaSemResultado(): boolean {
    const state = this.estadoBuscaMunicipio();
    return (
      (this.form?.controls.buscaMunicipio.value.trim().length ?? 0) >= 2 &&
      !state.carregando &&
      !state.erro &&
      state.opcoes.length === 0
    );
  }
  protected buscarMunicipios(termo: string): void {
    const uf = this.form?.controls.uf.value?.trim().toUpperCase() ?? '';
    const normalizado = termo.trim();
    if (
      !this.form.controls.abrangencia.value ||
      this.form.controls.abrangencia.value !== 'MUNICIPAL'
    ) {
      return;
    }

    this.form.controls.buscaMunicipio.setValue(termo, { emitEvent: false });
    const selecionado = this.municipioSelecionado();
    if (
      selecionado &&
      normalizado.localeCompare(selecionado.nome, 'pt-BR', { sensitivity: 'base' }) !== 0
    ) {
      this.limparSnapshotMunicipal();
    }
    if (normalizado.length < 2 || uf.length !== 2) {
      this.atualizarEstadoMunicipio({
        opcoes: [],
        carregando: false,
        erro: false,
      });
      return;
    }

    this.atualizarEstadoMunicipio({
      ...this.estadoBuscaMunicipio(),
      carregando: true,
      erro: false,
    });
    const grupo = new FormGroup(this.form.controls);
    this.buscaMunicipioRequests.next({ grupo, termo: normalizado, uf });
  }

  abrirDialog(): void {
    this.form.controls.data.setValue(this.diaSelecionado()?.data ?? '');
    this.form.controls.data.disable();
    this.dialogOpen.set(true);
  }

  private marcarDatasDuplicadasComoTocadas(problem: ProblemDetails): void {
    const data = this.extrairData(problem);
    if (!data) {
      return;
    }
    if (this.form.controls.data.value === data) {
      this.form.controls.data.markAsTouched();
    }
  }
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
