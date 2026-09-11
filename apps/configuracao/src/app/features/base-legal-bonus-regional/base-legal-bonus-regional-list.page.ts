import { HttpParams } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Subject, map, of, switchMap, timer } from 'rxjs';
import {
  ApiResult,
  Cursor,
  PaginationDirection,
  ProblemDetails,
  ProblemI18nService,
  ResolucaoDeVinculo,
  cursorToString,
  deveRotacionarIdempotencyKey,
  ehCursorDePaginacaoObsoleto,
  extractNextCursor,
  extractPrevCursor,
  idempotencyKey,
  resolverVinculo,
  useApiResource,
  withIdempotencyKey,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  BaseLegalBonusRegionalApi,
  BaseLegalBonusRegionalDto,
  BaseLegalBonusRegionalMunicipioDto,
  CONFIGURACAO_BASE_PATH,
  CriarBaseLegalBonusRegionalCommand,
} from '@uniplus/shared-data/configuracao';
import { type CidadeResumoDto, GeoApi } from '@uniplus/shared-data/geo';
import {
  AlertComponent,
  ConfirmDialogComponent,
  DrawerComponent,
  EmptyStateComponent,
  FilterBarComponent,
  LookupAlertComponent,
  LookupLabelComponent,
  PagerComponent,
  SpinnerComponent,
  type UiLookupFalho,
} from '@uniplus/shared-ui/components';
import { CatalogoTiposInstrumentoNormativo } from '../../shared/tipos-instrumento-normativo';

/** Tamanho da janela de cada página (cursor pagination, ADR-0026). */
const PAGE_SIZE = 50;

/** Espera após a última tecla antes de buscar municípios (mesmo valor do calendário de dias úteis). */
const MUNICIPIO_BUSCA_DEBOUNCE_MS = 300;

/** Nome completo evita lista poluída com resultados irrelevantes (CA-04 da issue). */
const MUNICIPIO_BUSCA_MIN_CHARS = 3;

/** Janela de resultados da busca de município (mesmo valor do calendário de dias úteis). */
const MUNICIPIOS_LIMIT = 20;

type ModoFormulario = 'criar' | 'editar';

interface BaseLegalForm {
  tipoInstrumento: FormControl<string>;
  identificacao: FormControl<string>;
  descricao: FormControl<string>;
}

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * `Validators.required`/`minLength` avaliam o valor cru — espaços não contam para o
 * backend, que sempre confere o texto aparado (`nullIfBlank`). Sem isso, "   " ou "ab "
 * passavam no cliente e só voltavam como 422 depois de uma viagem ao servidor.
 */
function validadorTextoAparado(minimo: number): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const aparado = (control.value ?? '').trim();
    if (aparado.length === 0) {
      return { required: true };
    }
    if (aparado.length < minimo) {
      return { minlength: { requiredLength: minimo, actualLength: aparado.length } };
    }
    return null;
  };
}

function controlNameFromBackendField(field: string): keyof BaseLegalForm | null {
  const camposConhecidos: readonly (keyof BaseLegalForm)[] = [
    'tipoInstrumento',
    'identificacao',
    'descricao',
  ];
  return camposConhecidos.includes(field as keyof BaseLegalForm)
    ? (field as keyof BaseLegalForm)
    : null;
}

@Component({
  selector: 'cfg-base-legal-bonus-regional-list-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ConfirmDialogComponent,
    DrawerComponent,
    EmptyStateComponent,
    FilterBarComponent,
    LookupAlertComponent,
    LookupLabelComponent,
    PagerComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Base Legal de Bônus Regional</h1>
        <p class="page-header__desc">
          Documento formal (Lei, Decreto, Portaria, Resolução, Instrução Normativa ou Parecer) e os
          municípios que ele beneficia com o bônus regional. O Passo 8 do Processo Seletivo
          referencia este cadastro e congela um snapshot no momento da configuração.
        </p>
      </div>
    </div>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar as bases legais">
        {{ errorMessage() }}
        <div class="cfg-list__retry">
          <button
            type="button"
            class="btn btn--secondary btn--sm"
            [disabled]="loading()"
            (click)="tentarNovamente()"
          >
            Tentar novamente
          </button>
        </div>
      </ui-alert>
    }

    <ui-filter-bar
      ariaLabel="Filtrar bases legais de bônus regional"
      searchPlaceholder="Buscar por identificação…"
      searchAriaLabel="Buscar base legal"
      [(searchValue)]="termoBusca"
    />

    <section class="panel" aria-labelledby="cfg-base-legal-list-title">
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 id="cfg-base-legal-list-title">Bases legais</h2>
          @if (loading()) {
            <span class="cfg-list__loading"><ui-spinner size="sm" /> Carregando</span>
          }
        </div>
        <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
          <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
          Nova base legal
        </button>
      </div>

      <ui-lookup-alert [falhas]="lookupsComFalha()" />

      @if (registrosBuscados().length > 0) {
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th scope="col">Tipo</th>
                <th scope="col">Identificação</th>
                <th scope="col">Municípios</th>
                <th scope="col"><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              @for (base of registrosBuscados(); track base.id) {
                <tr>
                  <td data-label="Tipo">
                    <ui-lookup-label
                      [resolucao]="tipoInstrumentoDoRegistro(base.tipoInstrumento)"
                    />
                  </td>
                  <td data-label="Identificação">{{ base.identificacao }}</td>
                  <td data-label="Municípios" class="u-caption">{{ base.municipios.length }}</td>
                  <td class="table-responsive__actions" data-label="Ações">
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm btn--rect"
                      [disabled]="loading()"
                      (click)="abrirEdicao(base)"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm btn--rect"
                      [disabled]="loading()"
                      (click)="pedirDesativacao(base)"
                    >
                      Desativar
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (!loading() && !errorMessage()) {
        @if (temFiltro()) {
          <ui-empty-state
            heading="Nenhuma base legal encontrada"
            description="Ajuste a busca para ver resultados."
          >
            <button type="button" class="btn btn--secondary" (click)="termoBusca.set('')">
              Limpar busca
            </button>
          </ui-empty-state>
        } @else {
          <ui-empty-state
            heading="Nenhuma base legal cadastrada"
            description="Cadastre a primeira base legal para referenciá-la no bônus regional de um processo."
          >
            <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
              Cadastrar a primeira base legal
            </button>
          </ui-empty-state>
        }
      }

      @if (prevCursor() !== null || nextCursor() !== null) {
        <ui-pager
          statusText="Navegação por páginas"
          navigationLabel="Paginação de bases legais de bônus regional"
          [hasPrevious]="prevCursor() !== null"
          [hasNext]="nextCursor() !== null"
          [isDisabled]="loading()"
          (previous)="paginaAnterior()"
          (next)="proximaPagina()"
        />
      }
    </section>

    <ui-drawer
      class="cfg-form-drawer"
      [(visible)]="formOpen"
      [closable]="!savingForm()"
      [heading]="formHeading()"
      ariaLabel="Formulário de base legal de bônus regional"
      position="right"
    >
      @if (formError()) {
        <ui-alert variant="danger" heading="Não foi possível salvar">{{ formError() }}</ui-alert>
      }

      @if (tiposInstrumento.comErro()) {
        <ui-alert variant="warning" heading="Tipos de instrumento não carregados">
          Sem o vocabulário de tipos não é possível classificar a base legal.
          <div class="cfg-list__retry">
            <button
              type="button"
              class="btn btn--secondary btn--sm"
              (click)="tiposInstrumento.recarregar()"
            >
              Tentar novamente
            </button>
          </div>
        </ui-alert>
      }

      <form
        [formGroup]="form"
        id="cfg-base-legal-form"
        (ngSubmit)="salvar()"
        novalidate
        class="cfg-form"
      >
        <div class="form-grid">
          <label class="field" [class.is-error]="erroDoCampo('tipoInstrumento')">
            <span class="field__label is-required">Tipo de instrumento</span>
            <select
              #tipoInstrumentoSelect
              class="select"
              formControlName="tipoInstrumento"
              [attr.aria-busy]="tiposInstrumento.pendente() ? 'true' : null"
              [attr.aria-invalid]="erroDoCampo('tipoInstrumento') ? 'true' : null"
              [attr.aria-describedby]="erroDoCampo('tipoInstrumento') ? 'cfg-blbr-tipo-erro' : null"
            >
              <option value="">Selecione…</option>
              @if (tipoInstrumentoForaDasOpcoes(); as codigoAtual) {
                <option [value]="codigoAtual">{{ codigoAtual }}</option>
              }
              @for (opcao of tiposInstrumento.opcoes(); track opcao.codigo) {
                <option [value]="opcao.codigo">{{ opcao.nome }}</option>
              }
            </select>
            @if (erroDoCampo('tipoInstrumento')) {
              <span class="field__error" id="cfg-blbr-tipo-erro" role="alert">{{
                erroDoCampo('tipoInstrumento')
              }}</span>
            }
          </label>

          <label class="field field--full" [class.is-error]="erroDoCampo('identificacao')">
            <span class="field__label is-required">Identificação</span>
            <input
              #identificacaoInput
              class="input"
              type="text"
              placeholder="Ex.: Portaria Unifesspa nº 2514/2023"
              formControlName="identificacao"
              [attr.aria-invalid]="erroDoCampo('identificacao') ? 'true' : null"
              [attr.aria-describedby]="
                erroDoCampo('identificacao') ? 'cfg-blbr-identificacao-erro' : null
              "
            />
            @if (erroDoCampo('identificacao')) {
              <span class="field__error" id="cfg-blbr-identificacao-erro" role="alert">{{
                erroDoCampo('identificacao')
              }}</span>
            }
          </label>

          <label class="field field--full" [class.is-error]="erroDoCampo('descricao')">
            <span class="field__label is-required">Descrição</span>
            <textarea
              #descricaoTextarea
              class="textarea"
              rows="3"
              formControlName="descricao"
              [attr.aria-invalid]="erroDoCampo('descricao') ? 'true' : null"
              [attr.aria-describedby]="erroDoCampo('descricao') ? 'cfg-blbr-descricao-erro' : null"
            ></textarea>
            @if (erroDoCampo('descricao')) {
              <span class="field__error" id="cfg-blbr-descricao-erro" role="alert">{{
                erroDoCampo('descricao')
              }}</span>
            }
          </label>

          <div class="field field--full" [class.is-error]="municipiosErro() !== null">
            <span class="field__label is-required" id="cfg-blbr-municipios-label">Municípios</span>
            <div class="cfg-municipio-busca">
              <div class="cfg-municipio-busca__input">
                <i class="pi pi-search" aria-hidden="true"></i>
                <input
                  #municipioBuscaInput
                  class="input"
                  type="text"
                  autocomplete="off"
                  placeholder="Digite o nome completo do município…"
                  aria-labelledby="cfg-blbr-municipios-label"
                  [attr.aria-invalid]="municipiosErro() !== null || buscaMunicipioErro() ? 'true' : null"
                  [attr.aria-describedby]="municipioBuscaDescribedBy()"
                  [value]="buscaMunicipioTermo()"
                  [disabled]="savingForm()"
                  (input)="buscarMunicipios(valorDoInput($event))"
                />
              </div>
              @if (buscaMunicipioCarregando()) {
                <span class="cfg-list__loading"><ui-spinner size="sm" /> Buscando</span>
              } @else if (buscaMunicipioErro()) {
                <span class="field__error" id="cfg-blbr-municipio-busca-erro" role="alert">
                  Não foi possível buscar municípios.
                </span>
              } @else if (buscaMunicipioResultados().length > 0) {
                <ul class="cfg-municipio-resultados">
                  @for (cidade of buscaMunicipioResultados(); track cidade.codigoIbge) {
                    <li>
                      <button
                        type="button"
                        class="btn btn--tertiary btn--sm"
                        [disabled]="savingForm()"
                        (click)="adicionarMunicipio(cidade)"
                      >
                        {{ cidade.nome }} — {{ cidade.uf }}
                      </button>
                    </li>
                  }
                </ul>
              } @else if (buscaMunicipioTermo().trim().length >= municipioBuscaMinChars) {
                <span class="field__hint">Nenhum município encontrado.</span>
              }
            </div>

            @if (municipiosSelecionados().length > 0) {
              <ul class="cfg-municipio-selecionados" aria-label="Municípios selecionados">
                @for (municipio of municipiosSelecionados(); track municipio.codigoIbge) {
                  <li>
                    <span>{{ municipio.nome }} — {{ municipio.uf }}</span>
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm btn--rect"
                      [attr.aria-label]="'Remover ' + municipio.nome"
                      [disabled]="savingForm()"
                      (click)="removerMunicipio(municipio.codigoIbge)"
                    >
                      Remover
                    </button>
                  </li>
                }
              </ul>
            } @else {
              <span class="field__hint">Nenhum município adicionado ainda.</span>
            }

            @if (municipiosErro(); as erro) {
              <span class="field__error" id="cfg-blbr-municipios-erro" role="alert">{{ erro }}</span>
            }
          </div>
        </div>
      </form>

      <div class="cfg-form-footer">
        <button
          type="button"
          class="btn btn--tertiary btn--rect"
          [disabled]="savingForm()"
          (click)="formOpen.set(false)"
        >
          Cancelar
        </button>
        <button
          type="submit"
          form="cfg-base-legal-form"
          class="btn btn--primary"
          [disabled]="savingForm()"
        >
          @if (savingForm()) {
            <ui-spinner size="sm" />
          }
          {{
            savingForm() ? 'Salvando...' : modo() === 'criar' ? 'Criar base legal' : 'Salvar base legal'
          }}
        </button>
      </div>
    </ui-drawer>

    <ui-confirm-dialog
      [(visible)]="confirmDesativarAberto"
      heading="Desativar base legal"
      [message]="confirmDesativarMensagem()"
      confirmLabel="Desativar"
      confirmVariant="danger"
      (confirmed)="confirmarDesativacao()"
    />
  `,
  styles: `
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

    .cfg-municipio-resultados,
    .cfg-municipio-selecionados {
      display: grid;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .cfg-municipio-selecionados {
      margin-top: var(--space-2);
    }

    .cfg-municipio-selecionados li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
    }
  `,
  host: { class: 'cfg-page' },
})
export class BaseLegalBonusRegionalListPage {
  private readonly api = inject(BaseLegalBonusRegionalApi);
  private readonly geo = inject(GeoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  protected readonly tiposInstrumento = inject(CatalogoTiposInstrumentoNormativo);

  protected readonly municipioBuscaMinChars = MUNICIPIO_BUSCA_MIN_CHARS;

  protected readonly termoBusca = signal('');
  protected readonly temFiltro = computed(() => this.termoBusca().trim().length > 0);

  protected readonly lookupsComFalha = computed<readonly UiLookupFalho[]>(() =>
    this.tiposInstrumento.comErro()
      ? [{ nome: 'tipos de instrumento', recarregar: () => this.tiposInstrumento.recarregar() }]
      : [],
  );

  protected readonly formOpen = signal(false);
  protected readonly modo = signal<ModoFormulario>('criar');
  protected readonly baseEmEdicaoId = signal<string | null>(null);
  /** Estados de "em voo" independentes — salvar/editar e desativar não competem pelo mesmo sinal. */
  protected readonly savingForm = signal(false);
  protected readonly savingDesativar = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());

  protected readonly municipiosSelecionados = signal<readonly BaseLegalBonusRegionalMunicipioDto[]>(
    [],
  );
  protected readonly municipiosTocado = signal(false);
  protected readonly municipiosErroBackend = signal<string | null>(null);
  protected readonly municipiosErro = computed(() => {
    if (this.municipiosErroBackend()) {
      return this.municipiosErroBackend();
    }
    return this.municipiosTocado() && this.municipiosSelecionados().length === 0
      ? 'Adicione ao menos um município.'
      : null;
  });

  protected readonly buscaMunicipioTermo = signal('');
  protected readonly buscaMunicipioResultados = signal<readonly CidadeResumoDto[]>([]);
  protected readonly buscaMunicipioCarregando = signal(false);
  protected readonly buscaMunicipioErro = signal(false);
  private readonly buscaMunicipioRequests = new Subject<string>();

  /** ids dos erros que descrevem o campo de busca — vazio o suficiente vira `null`. */
  protected readonly municipioBuscaDescribedBy = computed<string | null>(() => {
    const ids: string[] = [];
    if (this.buscaMunicipioErro()) {
      ids.push('cfg-blbr-municipio-busca-erro');
    }
    if (this.municipiosErro() !== null) {
      ids.push('cfg-blbr-municipios-erro');
    }
    return ids.length > 0 ? ids.join(' ') : null;
  });

  protected readonly confirmDesativarAberto = signal(false);
  protected readonly baseParaDesativar = signal<BaseLegalBonusRegionalDto | null>(null);
  /** Incrementado a cada abertura da confirmação — identifica a que pedido uma resposta pertence. */
  private readonly desativacaoSessao = signal(0);
  protected readonly confirmDesativarMensagem = computed(() => {
    const base = this.baseParaDesativar();
    return base
      ? `Tem certeza que deseja desativar "${base.identificacao}"? Processos que já a referenciam mantêm o snapshot congelado.`
      : '';
  });

  protected readonly form: FormGroup<BaseLegalForm> = new FormGroup({
    tipoInstrumento: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    identificacao: new FormControl('', {
      nonNullable: true,
      validators: [validadorTextoAparado(3), Validators.maxLength(500)],
    }),
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [validadorTextoAparado(3), Validators.maxLength(2000)],
    }),
  });

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  /**
   * Código que o formulário carrega e o vocabulário não oferece — vocabulário ainda não
   * chegou, falhou, ou (edição) o registro traz um código que o vocabulário atual não tem.
   * Sem uma option com esse valor o select renderiza em branco, mas o control continua com
   * o código antigo — e o envio reenviaria um tipo que o operador nunca viu selecionado.
   */
  protected readonly tipoInstrumentoForaDasOpcoes = computed<string | null>(() => {
    const escolhido = this.formValue().tipoInstrumento;
    if (escolhido === '') {
      return null;
    }
    return this.tiposInstrumento.porCodigo().has(escolhido) ? null : escolhido;
  });

  private readonly pagina = signal<
    { readonly cursor: Cursor; readonly direction: PaginationDirection } | undefined
  >(undefined);

  private readonly lista = useApiResource<readonly BaseLegalBonusRegionalDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/base-legal-bonus-regional`,
    params: this.montarParams(),
    context: withVendorMime('base-legal-bonus-regional', 1),
  }));

  protected readonly loading = this.lista.isLoading;

  private readonly cursores = linkedSignal<
    ApiResult<readonly BaseLegalBonusRegionalDto[]> | undefined,
    { readonly prev: Cursor | null; readonly next: Cursor | null }
  >({
    source: () => this.lista.value(),
    computation: (envelope, previous) => {
      const atual = previous?.value ?? { prev: null, next: null };
      if (envelope === undefined) {
        return atual;
      }
      const primeiraPagina = untracked(() => this.pagina() === undefined);
      if (!envelope.ok) {
        return primeiraPagina ? { prev: null, next: null } : atual;
      }
      const link = untracked(() => this.lista.headers()?.get('Link') ?? null);
      return { prev: extractPrevCursor(link), next: extractNextCursor(link) };
    },
  });

  protected readonly prevCursor = computed(() => this.cursores().prev);
  protected readonly nextCursor = computed(() => this.cursores().next);

  protected readonly basesLegais = linkedSignal<
    ApiResult<readonly BaseLegalBonusRegionalDto[]> | undefined,
    readonly BaseLegalBonusRegionalDto[]
  >({
    source: () => this.lista.value(),
    computation: (envelope, previous) => {
      const atual = previous?.value ?? [];
      if (envelope === undefined) {
        return atual;
      }
      const primeiraPagina = untracked(() => this.pagina() === undefined);
      if (!envelope.ok) {
        return primeiraPagina ? [] : atual;
      }
      return [...envelope.data];
    },
  });

  protected readonly errorMessage = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar as bases legais.' : null;
  });

  // Busca client-side sobre a página carregada: o backend só pagina por
  // cursor, sem filtro de texto no contrato.
  protected readonly registrosBuscados = computed(() => {
    const termo = this.termoBusca().trim().toLocaleLowerCase('pt-BR');
    const registros = this.basesLegais();
    if (termo.length === 0) {
      return registros;
    }
    return registros.filter((base) =>
      base.identificacao.toLocaleLowerCase('pt-BR').includes(termo),
    );
  });

  constructor() {
    this.tiposInstrumento.garantirCarregado();

    this.buscaMunicipioRequests
      .pipe(
        // switchMap direto no Subject cru: cancela a busca em voo assim que QUALQUER termo
        // novo chega, mesmo uma limpeza (''). Com debounceTime antes do switchMap, o termo
        // vazio ficava até 300ms esperando para chegar lá — janela em que a resposta antiga
        // ainda podia repopular a lista já limpa. A espera de digitação agora vive dentro do
        // observable interno (timer), só quando há termo suficiente para buscar de verdade.
        switchMap((termo) => {
          if (termo.trim().length < MUNICIPIO_BUSCA_MIN_CHARS) {
            return of(null);
          }
          this.buscaMunicipioCarregando.set(true);
          return timer(MUNICIPIO_BUSCA_DEBOUNCE_MS).pipe(
            switchMap(() => this.geo.listarCidades({ q: termo, limit: MUNICIPIOS_LIMIT })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.buscaMunicipioCarregando.set(false);
        if (result === null) {
          this.buscaMunicipioResultados.set([]);
          this.buscaMunicipioErro.set(false);
          return;
        }
        if (!result.ok) {
          this.buscaMunicipioErro.set(true);
          this.buscaMunicipioResultados.set([]);
          return;
        }
        this.buscaMunicipioErro.set(false);
        const jaSelecionados = new Set(this.municipiosSelecionados().map((m) => m.codigoIbge));
        this.buscaMunicipioResultados.set(
          result.data.filter((cidade) => !jaSelecionados.has(cidade.codigoIbge)),
        );
      });
  }

  protected valorDoInput(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  /**
   * Resolução do tipo de instrumento para exibição na listagem — nunca o
   * token cru do backend quando o vocabulário falha ou ainda não chegou
   * (mesmo padrão de `categoriaDoTipo` em Tipo de Documento, #579).
   */
  protected tipoInstrumentoDoRegistro(codigo: string): ResolucaoDeVinculo {
    return resolverVinculo(
      this.tiposInstrumento,
      this.tiposInstrumento.porCodigo().get(codigo),
      (tipo) => tipo.nome,
    );
  }

  protected proximaPagina(): void {
    const proximo = this.nextCursor();
    if (proximo !== null && !this.loading()) {
      this.pagina.set({ cursor: proximo, direction: 'next' });
    }
  }

  protected paginaAnterior(): void {
    const anterior = this.prevCursor();
    if (anterior !== null && !this.loading()) {
      this.pagina.set({ cursor: anterior, direction: 'prev' });
    }
  }

  /**
   * Um cursor rejeitado (400/410) nunca se torna válido de novo — repetir a mesma
   * página travaria "Tentar novamente" num loop de erro. Reinicia a listagem do
   * início em vez de recarregar a página atual.
   */
  protected tentarNovamente(): void {
    if (this.loading()) {
      return;
    }
    const problem = this.lista.problem();
    if (problem && ehCursorDePaginacaoObsoleto(problem)) {
      this.recarregar();
      return;
    }
    this.lista.reload();
  }

  protected formHeading(): string {
    return this.modo() === 'criar' ? 'Nova base legal' : 'Editar base legal';
  }

  /**
   * A guarda vale independentemente de como a reabertura chega — clique bloqueado pelo
   * drawer nativo (`<dialog>` modal), Esc ou uma chamada direta — nenhuma delas deve
   * descartar o estado de um envio ainda em voo.
   */
  protected abrirCadastro(): void {
    if (this.savingForm()) {
      return;
    }
    this.modo.set('criar');
    this.baseEmEdicaoId.set(null);
    this.form.reset({ tipoInstrumento: '', identificacao: '', descricao: '' });
    this.municipiosSelecionados.set([]);
    this.municipiosTocado.set(false);
    this.municipiosErroBackend.set(null);
    this.limparBuscaMunicipio();
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  protected abrirEdicao(base: BaseLegalBonusRegionalDto): void {
    if (this.savingForm()) {
      return;
    }
    this.modo.set('editar');
    this.baseEmEdicaoId.set(base.id);
    this.form.reset({
      tipoInstrumento: base.tipoInstrumento,
      identificacao: base.identificacao,
      descricao: base.descricao,
    });
    this.municipiosSelecionados.set(base.municipios);
    this.municipiosTocado.set(false);
    this.municipiosErroBackend.set(null);
    this.limparBuscaMunicipio();
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  protected buscarMunicipios(termo: string): void {
    this.buscaMunicipioTermo.set(termo);
    this.buscaMunicipioRequests.next(termo);
  }

  protected adicionarMunicipio(cidade: CidadeResumoDto): void {
    if (this.municipiosSelecionados().some((m) => m.codigoIbge === cidade.codigoIbge)) {
      return;
    }
    this.municipiosSelecionados.update((atual) => [
      ...atual,
      { codigoIbge: cidade.codigoIbge, nome: cidade.nome, uf: cidade.uf },
    ]);
    this.municipiosTocado.set(true);
    this.municipiosErroBackend.set(null);
    this.limparBuscaMunicipio();
  }

  protected removerMunicipio(codigoIbge: string): void {
    this.municipiosSelecionados.update((atual) => atual.filter((m) => m.codigoIbge !== codigoIbge));
    this.municipiosTocado.set(true);
  }

  /**
   * Passa por `buscarMunicipios('')`, não só zera os signals: uma busca em voo
   * só é cancelada quando `buscaMunicipioRequests` emite de novo (o `switchMap`
   * descarta a subscrição anterior nesse instante). Zerar os signals direto
   * deixava a resposta atrasada repopular a lista já limpa.
   */
  private limparBuscaMunicipio(): void {
    this.buscarMunicipios('');
  }

  protected pedirDesativacao(base: BaseLegalBonusRegionalDto): void {
    this.desativacaoSessao.update((atual) => atual + 1);
    this.savingDesativar.set(false);
    this.baseParaDesativar.set(base);
    this.confirmDesativarAberto.set(true);
  }

  protected confirmarDesativacao(): void {
    const base = this.baseParaDesativar();
    if (base === null || this.savingDesativar()) {
      return;
    }
    this.savingDesativar.set(true);
    const sessao = this.desativacaoSessao();
    this.api
      .remover(base.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        // O desfecho no backend independe de qual diálogo está na tela agora — sucesso
        // recarrega a lista, falha notifica, os dois sempre. O que pertence à SESSÃO
        // (fechar o diálogo, liberar o botão) só se aplica se nenhum pedido mais novo
        // tiver assumido o estado compartilhado; senão a falha de uma desativação
        // superada ficaria muda para o operador.
        if (result.ok) {
          this.notifications.success('Base legal desativada', base.identificacao);
          this.recarregar();
        } else {
          const titulo = this.problemI18n.resolve(result.problem).title;
          this.notifications.errorFromProblem(result.problem, { title: titulo });
        }
        if (sessao !== this.desativacaoSessao()) {
          return;
        }
        this.savingDesativar.set(false);
        this.baseParaDesativar.set(null);
      });
  }

  private readonly municipioBuscaInputRef =
    viewChild<ElementRef<HTMLInputElement>>('municipioBuscaInput');
  private readonly tipoInstrumentoRef =
    viewChild<ElementRef<HTMLSelectElement>>('tipoInstrumentoSelect');
  private readonly identificacaoRef = viewChild<ElementRef<HTMLInputElement>>('identificacaoInput');
  private readonly descricaoRef = viewChild<ElementRef<HTMLTextAreaElement>>('descricaoTextarea');

  protected salvar(): void {
    this.municipiosTocado.set(true);
    if (this.savingForm()) {
      return;
    }
    if (this.municipiosSelecionados().length === 0) {
      this.form.markAllAsTouched();
      this.municipioBuscaInputRef()?.nativeElement.focus();
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focarPrimeiroCampoInvalido();
      return;
    }
    this.savingForm.set(true);
    // Trava os controles do formulário durante o envio: sem isso, uma edição feita
    // enquanto a resposta ainda não chegou some ao fechar (sucesso) ou fica associada
    // ao erro de validação de um payload que já não é o que está na tela (falha).
    this.form.disable({ emitEvent: false });
    this.formError.set(null);
    this.municipiosErroBackend.set(null);
    const modo = this.modo();
    // Ramificado em vez de unificar as duas chamadas numa variável: um ternário de
    // Observable<ApiResult<string>> e Observable<ApiResult<void>> gera um tipo união
    // que o TypeScript não resolve direito ao encadear .pipe(map(...)) por cima.
    if (modo === 'criar') {
      this.api
        .criar(this.criarCommand(), withIdempotencyKey(this.idempotencyKeyAtual()))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((result) => this.handleSalvarResult(result, modo));
      return;
    }
    this.api
      .atualizar(
        this.baseEmEdicaoId() ?? '',
        { id: this.baseEmEdicaoId() ?? '', ...this.criarCommand() },
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result, modo));
  }

  /**
   * Mesmo padrão de foco do campo de município: sem mover o foco, o operador que envia o
   * formulário com o tipo de instrumento, a identificação ou a descrição inválidos não tem
   * como saber qual campo travou o envio — nada muda visivelmente perto do botão Salvar.
   */
  private focarPrimeiroCampoInvalido(): void {
    if (this.form.controls.tipoInstrumento.invalid) {
      this.tipoInstrumentoRef()?.nativeElement.focus();
      return;
    }
    if (this.form.controls.identificacao.invalid) {
      this.identificacaoRef()?.nativeElement.focus();
      return;
    }
    if (this.form.controls.descricao.invalid) {
      this.descricaoRef()?.nativeElement.focus();
    }
  }

  protected erroDoCampo(nome: keyof BaseLegalForm): string | null {
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
    if (control.errors['maxlength']) return 'Valor acima do tamanho permitido.';
    if (control.errors['minlength']) return 'Valor abaixo do tamanho mínimo.';
    return 'Valor inválido.';
  }

  private montarParams(): HttpParams {
    const pagina = this.pagina();
    if (pagina === undefined) {
      return new HttpParams().set('limit', String(PAGE_SIZE));
    }
    return new HttpParams()
      .set('cursor', cursorToString(pagina.cursor))
      .set('direction', pagina.direction);
  }

  private recarregar(): void {
    if (this.pagina() === undefined) {
      this.lista.reload();
    } else {
      this.pagina.set(undefined);
    }
  }

  /**
   * `[closable]="!savingForm()"` recusa X/Esc, `abrirCadastro`/`abrirEdicao` recusam rodar,
   * e o botão Cancelar fica desabilitado enquanto `savingForm()` é true — não há como
   * descartar o formulário com um envio ainda em voo. A resposta sempre pertence ao
   * formulário que está na tela.
   */
  private handleSalvarResult(result: ApiResult<string | void>, modoNoEnvio: ModoFormulario): void {
    this.savingForm.set(false);
    this.form.enable({ emitEvent: false });
    if (result.ok) {
      this.notifications.success(
        modoNoEnvio === 'criar' ? 'Base legal criada' : 'Base legal atualizada',
      );
      this.recarregar();
      this.formOpen.set(false);
      this.idempotencyKeyAtual.set(idempotencyKey.create());
      return;
    }
    this.aplicarFalha(result.problem);
  }

  private aplicarFalha(problem: ProblemDetails): void {
    if (deveRotacionarIdempotencyKey(problem)) {
      this.idempotencyKeyAtual.set(idempotencyKey.create());
    }
    if (problem.status === 422 && problem.errors && problem.errors.length > 0) {
      this.aplicarErrosDeValidacao(problem.errors);
      return;
    }
    this.formError.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) {
      this.notifications.errorFromProblem(problem);
    }
  }

  private aplicarErrosDeValidacao(
    errors: ReadonlyArray<{
      readonly field: string;
      readonly code: string;
      readonly message: string;
    }>,
  ): void {
    let aplicouAlgum = false;
    for (const erro of errors) {
      if (erro.field.startsWith('municipios')) {
        this.municipiosErroBackend.set(erro.message);
        aplicouAlgum = true;
        continue;
      }
      const controlName = controlNameFromBackendField(erro.field);
      if (controlName === null) continue;
      const control = this.form.controls[controlName];
      control.setErrors({ backend: { code: erro.code, message: erro.message } });
      control.markAsTouched();
      aplicouAlgum = true;
    }

    if (aplicouAlgum) {
      this.formError.set(null);
      return;
    }
    this.formError.set('Não foi possível mapear os erros de validação. Revise os campos.');
  }

  private criarCommand(): CriarBaseLegalBonusRegionalCommand {
    const raw = this.form.getRawValue();
    return {
      tipoInstrumento: nullIfBlank(raw.tipoInstrumento),
      identificacao: nullIfBlank(raw.identificacao),
      descricao: nullIfBlank(raw.descricao),
      municipios: this.municipiosSelecionados().map((m) => ({
        codigoIbge: m.codigoIbge,
        nome: m.nome,
        uf: m.uf,
      })),
    };
  }
}
