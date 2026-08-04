import { HttpParams } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  ApiResult,
  Cursor,
  PaginationDirection,
  ProblemDetails,
  ProblemI18nService,
  ProblemValidationError,
  cursorToString,
  extractNextCursor,
  extractPrevCursor,
  idempotencyKey,
  useApiResource,
  withIdempotencyKey,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CODIGOS_FASE_CANONICA,
  CONFIGURACAO_BASE_PATH,
  DONOS_TIPICOS_FASE,
  ORIGENS_DATA_FASE,
  FaseCanonicaDto,
  FasesCanonicasApi,
  type AtualizarFaseCanonicaCommand,
  type CriarFaseCanonicaCommand,
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  ConfirmDialogComponent,
  DrawerComponent,
  EmptyStateComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';

/** Tamanho da janela de cada página (cursor pagination, ADR-0026). */
const PAGE_SIZE = 50;

/** Vendor code do DomainError `FaseCanonica.CodigoJaExiste` (uniplus-api, 409 Conflict). */
const FASE_CANONICA_CODIGO_JA_EXISTE_CODE = 'uniplus.configuracao.fase_canonica.codigo_ja_existe';

/**
 * Espelha a regra do backend: uma fase só pode ter resultado definitivo se
 * também produzir resultado.
 */
function resultadoDefinitivoValidator(grupo: AbstractControl): ValidationErrors | null {
  const produz = grupo.get('produzResultado')?.value === true;
  const definitivo = grupo.get('resultadoDefinitivo')?.value === true;
  return definitivo && !produz ? { resultadoDefinitivoSemProducao: true } : null;
}

type ModoFormulario = 'criar' | 'editar';

interface FaseForm {
  codigo: FormControl<string>;
  donoTipico: FormControl<string>;
  nome: FormControl<string>;
  descricao: FormControl<string>;
  baseLegal: FormControl<string>;
  agrupaEtapas: FormControl<boolean>;
  permiteComplementacao: FormControl<boolean>;
  origemData: FormControl<string>;
  produzResultado: FormControl<boolean>;
  resultadoDefinitivo: FormControl<boolean>;
  coletaInscricao: FormControl<boolean>;
}

const FASE_CONTROL_NAMES: ReadonlySet<string> = new Set<keyof FaseForm>([
  'codigo',
  'donoTipico',
  'nome',
  'descricao',
  'baseLegal',
  'agrupaEtapas',
  'permiteComplementacao',
  'origemData',
  'produzResultado',
  'resultadoDefinitivo',
  'coletaInscricao',
]);

@Component({
  selector: 'cfg-fases-canonicas-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ConfirmDialogComponent,
    DrawerComponent,
    EmptyStateComponent,
    PagerComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Fase Canônica</h1>
        <p class="page-header__desc">
          Vocabulário de cronograma — momentos do ciclo de vida do processo seletivo ·
          UNI-REQ-0064.
        </p>
      </div>
    </div>

    <ui-alert variant="warning" heading="Código imutável após criação" [dynamic]="false">
      O código de uma fase canônica ou de um tipo de banca não pode ser alterado após a criação —
      pertence ao vocabulário canônico fixo e é congelado por snapshot nos cronogramas dos
      editais. Para corrigir, crie uma nova entrada e inative a anterior.
    </ui-alert>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar as fases canônicas">
        {{ errorMessage() }}
        <div class="cfg-fases-canonicas__retry">
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

    <section class="panel" aria-labelledby="cfg-fases-canonicas-list-title">
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 id="cfg-fases-canonicas-list-title">Fases canônicas</h2>
          @if (loading()) {
            <span class="cfg-fases-canonicas__loading"><ui-spinner size="sm" /> Carregando</span>
          }
        </div>
        <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
          <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
          Nova fase canônica
        </button>
      </div>

      <div class="filter-bar" role="search" aria-label="Filtrar fases canônicas">
        <div class="filter-bar__group">
          <label class="field field--search">
            <span class="field__label sr-only">Buscar por código ou nome</span>
            <input
              class="input"
              type="search"
              placeholder="Buscar por código ou nome…"
              [value]="termoBusca()"
              (input)="termoBusca.set($any($event.target).value)"
            />
          </label>
          <label class="field">
            <span class="field__label sr-only">Filtrar por dono típico</span>
            <select class="select" [value]="donoTipicoFiltro()" (change)="donoTipicoFiltro.set($any($event.target).value)">
              <option value="">Todos os donos típicos</option>
              @for (dono of donosTipicos; track dono) {
                <option [value]="dono">{{ dono }}</option>
              }
            </select>
          </label>
        </div>
      </div>

      @if (fasesFiltradas().length > 0) {
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Nome</th>
                <th scope="col">Dono típico</th>
                <th scope="col">Agrupa etapas</th>
                <th scope="col">Permite compl.</th>
                <th scope="col"><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              @for (fase of fasesFiltradas(); track fase.id) {
                <tr>
                  <td data-label="Código"><code>{{ fase.codigo }}</code></td>
                  <td data-label="Nome">{{ fase.nome }}</td>
                  <td data-label="Dono típico">
                    <span class="tag">{{ fase.donoTipico || '—' }}</span>
                  </td>
                  <td data-label="Agrupa etapas">
                    @if (fase.agrupaEtapas) {
                      <span class="tag tag--success">Sim</span>
                    } @else {
                      <span aria-label="Não aplicável">—</span>
                    }
                  </td>
                  <td data-label="Permite compl.">
                    @if (fase.permiteComplementacao) {
                      <span class="tag tag--success">Sim</span>
                    } @else if (fase.codigo === 'HABILITACAO') {
                      <span class="tag" title="Vedação SiSU">Não</span>
                    } @else {
                      <span aria-label="Não aplicável">—</span>
                    }
                  </td>
                  <td class="table-responsive__actions" data-label="Ações">
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm btn--rect"
                      [disabled]="loading()"
                      (click)="abrirEdicao(fase)"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm btn--rect"
                      [disabled]="loading()"
                      (click)="pedirRemocao(fase)"
                    >
                      Inativar
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
            heading="Nenhuma fase encontrada"
            description="Ajuste a busca ou o filtro de dono típico para ver resultados."
          >
            <button type="button" class="btn btn--secondary" (click)="limparFiltros()">
              Limpar filtros
            </button>
          </ui-empty-state>
        } @else {
          <ui-empty-state
            heading="Nenhuma fase canônica cadastrada"
            description="Cadastre a primeira fase para montar o cronograma de processos seletivos."
          >
            <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
              Nova fase canônica
            </button>
          </ui-empty-state>
        }
      }

      @if (prevCursor() !== null || nextCursor() !== null) {
        <ui-pager
          statusText="Navegação por páginas"
          navigationLabel="Paginação de fases canônicas"
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
      [heading]="formHeading()"
      ariaLabel="Formulário de fase canônica"
      position="right"
    >
      @if (formError()) {
        <ui-alert variant="danger" heading="Não foi possível salvar">{{ formError() }}</ui-alert>
      }

      <form
        [formGroup]="form"
        id="cfg-fase-canonica-form"
        (ngSubmit)="salvar()"
        novalidate
        class="cfg-form"
      >
        <section aria-labelledby="cfg-fase-identificacao">
          <h3 id="cfg-fase-identificacao" class="form-section__title">Identificação</h3>
          <div class="form-grid form-grid--1col">
            @if (modo() === 'criar') {
              <label class="field" [class.is-error]="erroDoCampo('codigo')">
                <span class="field__label is-required">Código</span>
                <select
                  class="select"
                  formControlName="codigo"
                  [attr.aria-invalid]="erroDoCampo('codigo') ? 'true' : null"
                >
                  <option value="" disabled>Selecione o código</option>
                  @for (codigo of codigosFase; track codigo) {
                    <option [value]="codigo">{{ codigo }}</option>
                  }
                </select>
                <span class="field__hint">Imutável após a criação.</span>
                @if (erroDoCampo('codigo')) {
                  <span class="field__error">{{ erroDoCampo('codigo') }}</span>
                }
              </label>
            } @else {
              <label class="field" [class.is-error]="erroDoCampo('codigo')">
                <span class="field__label is-required">Código</span>
                <input class="input" type="text" formControlName="codigo" readonly />
                <span class="field__hint">Imutável após criação.</span>
                @if (erroDoCampo('codigo')) {
                  <span class="field__error">{{ erroDoCampo('codigo') }}</span>
                }
              </label>
            }
            <label class="field" [class.is-error]="erroDoCampo('donoTipico')">
              <span class="field__label is-required">Dono típico</span>
              <select
                class="select"
                formControlName="donoTipico"
                [attr.aria-invalid]="erroDoCampo('donoTipico') ? 'true' : null"
              >
                <option value="" disabled>Selecione o dono típico</option>
                @for (dono of donosTipicos; track dono) {
                  <option [value]="dono">{{ dono }}</option>
                }
              </select>
              <span class="field__hint">
                Rótulo orientativo, não vinculante. MEC = data delegada SiSU; CONSEPE = recurso de
                2ª instância.
              </span>
              @if (erroDoCampo('donoTipico')) {
                <span class="field__error">{{ erroDoCampo('donoTipico') }}</span>
              }
            </label>
            <label class="field" [class.is-error]="erroDoCampo('nome')">
              <span class="field__label is-required">Nome</span>
              <input
                class="input"
                type="text"
                formControlName="nome"
                [attr.aria-invalid]="erroDoCampo('nome') ? 'true' : null"
              />
              @if (erroDoCampo('nome')) {
                <span class="field__error">{{ erroDoCampo('nome') }}</span>
              }
            </label>
            <label class="field">
              <span class="field__label">Descrição</span>
              <textarea class="textarea" formControlName="descricao"></textarea>
            </label>
            <label class="field" [class.is-error]="erroDoCampo('origemData')">
              <span class="field__label is-required">Origem da data</span>
              <select
                class="select"
                formControlName="origemData"
                [attr.aria-invalid]="erroDoCampo('origemData') ? 'true' : null"
              >
                <option value="" disabled>Selecione a origem da data</option>
                @for (origem of origensData; track origem) {
                  <option [value]="origem">{{ origem }}</option>
                }
              </select>
              <span class="field__hint">
                PROPRIA = data definida pela instituição; DELEGADA = data definida por terceiro,
                como o cronograma do SiSU.
              </span>
              @if (erroDoCampo('origemData')) {
                <span class="field__error">{{ erroDoCampo('origemData') }}</span>
              }
            </label>
            <label class="field">
              <span class="field__label">Base legal</span>
              <input class="input" type="text" formControlName="baseLegal" placeholder="Ex.: Lei 9.784/1999, art. 56" />
              <span class="field__hint">Dispositivo legal aplicável. Opcional.</span>
            </label>
          </div>
        </section>

        <fieldset class="form-section">
          <legend class="form-section__title">Resultado e inscrição</legend>
          <div class="form-grid form-grid--1col">
            <label class="field">
              <span class="field__label">Produz resultado</span>
              <select class="select" formControlName="produzResultado">
                <option [ngValue]="true">Sim</option>
                <option [ngValue]="false">Não</option>
              </select>
              <span class="field__hint">A fase gera um resultado divulgável.</span>
            </label>
            @if (showResultadoDefinitivo()) {
              <label class="field" aria-live="polite">
                <span class="field__label">Resultado definitivo</span>
                <select class="select" formControlName="resultadoDefinitivo">
                  <option [ngValue]="true">Sim</option>
                  <option [ngValue]="false">Não</option>
                </select>
                <span class="field__hint">
                  Encerra a cadeia recursal da fase. Só se aplica quando a fase produz resultado.
                </span>
              </label>
            }
            <label class="field">
              <span class="field__label">Coleta inscrição</span>
              <select class="select" formControlName="coletaInscricao">
                <option [ngValue]="true">Sim</option>
                <option [ngValue]="false">Não</option>
              </select>
              <span class="field__hint">A fase recebe inscrições de candidatos.</span>
            </label>
          </div>
        </fieldset>

        @if (showGrupoAgrupa()) {
          <fieldset
            id="cfg-fase-grupo-agrupa"
            class="form-section"
            aria-live="polite"
            aria-atomic="true"
          >
            <legend class="form-section__title">Agrupamento de etapas</legend>
            <label class="field">
              <span class="field__label">Agrupa etapas</span>
              <select class="select" formControlName="agrupaEtapas">
                <option [ngValue]="true">Sim</option>
                <option [ngValue]="false">Não</option>
              </select>
              <span class="field__hint">Aplicável apenas à fase AVALIACAO.</span>
            </label>
          </fieldset>
        }

        @if (showGrupoCompl()) {
          <fieldset
            id="cfg-fase-grupo-compl"
            class="form-section"
            aria-live="polite"
            aria-atomic="true"
          >
            <legend class="form-section__title">Complementação de documentos</legend>
            <label class="field">
              <span class="field__label">Permite complementação</span>
              <select class="select" formControlName="permiteComplementacao">
                <option [ngValue]="true">Sim</option>
                <option [ngValue]="false">Não</option>
              </select>
              <span class="field__hint">Aplicável apenas às fases HOMOLOGACAO e RECURSOS.</span>
            </label>
          </fieldset>
        }
      </form>

      <div class="cfg-form-footer">
        <button type="button" class="btn btn--tertiary btn--rect" (click)="formOpen.set(false)">
          Cancelar
        </button>
        <button
          type="submit"
          form="cfg-fase-canonica-form"
          class="btn btn--primary"
          [disabled]="saving()"
        >
          @if (saving()) {
            <ui-spinner size="sm" />
          }
          {{ saving() ? 'Salvando...' : modo() === 'criar' ? 'Criar fase canônica' : 'Salvar fase canônica' }}
        </button>
      </div>
    </ui-drawer>

    <ui-confirm-dialog
      [(visible)]="confirmOpen"
      heading="Inativar fase canônica"
      [message]="confirmMessage()"
      confirmLabel="Inativar"
      confirmVariant="danger"
      (confirmed)="removerConfirmado()"
    />
  `,
})
export class FasesCanonicasPage {
  private readonly api = inject(FasesCanonicasApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  protected readonly codigosFase = CODIGOS_FASE_CANONICA;
  protected readonly donosTipicos = DONOS_TIPICOS_FASE;
  protected readonly origensData = ORIGENS_DATA_FASE;

  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly modo = signal<ModoFormulario>('criar');
  protected readonly faseEmEdicaoId = signal<string | null>(null);
  protected readonly faseParaRemover = signal<FaseCanonicaDto | null>(null);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());
  protected readonly termoBusca = signal('');
  protected readonly donoTipicoFiltro = signal('');

  private readonly pagina = signal<
    { readonly cursor: Cursor; readonly direction: PaginationDirection } | undefined
  >(undefined);

  private readonly lista = useApiResource<readonly FaseCanonicaDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/fases-canonicas`,
    params: this.montarParams(),
    context: withVendorMime('fase-canonica', 1),
  }));

  protected readonly loading = this.lista.isLoading;

  private readonly cursores = linkedSignal<
    ApiResult<readonly FaseCanonicaDto[]> | undefined,
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

  protected readonly fases = linkedSignal<
    ApiResult<readonly FaseCanonicaDto[]> | undefined,
    readonly FaseCanonicaDto[]
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

  // Busca e filtro de dono típico client-side sobre a página carregada: o
  // backend (api#592) só pagina por cursor, sem filtro de texto/dono no
  // contrato (GET /api/configuracao/fases-canonicas aceita só cursor/limit/direction).
  protected readonly fasesFiltradas = computed(() => {
    const termo = this.termoBusca().trim().toLocaleLowerCase('pt-BR');
    const dono = this.donoTipicoFiltro();
    return this.fases().filter((fase) => {
      const casaTermo =
        termo.length === 0 ||
        fase.codigo.toLocaleLowerCase('pt-BR').includes(termo) ||
        fase.nome.toLocaleLowerCase('pt-BR').includes(termo);
      const casaDono = dono.length === 0 || fase.donoTipico === dono;
      return casaTermo && casaDono;
    });
  });

  protected readonly temFiltro = computed(
    () => this.termoBusca().trim().length > 0 || this.donoTipicoFiltro().length > 0,
  );

  protected readonly errorMessage = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar fases canônicas.' : null;
  });

  protected readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Nova fase canônica' : 'Editar fase canônica',
  );

  protected readonly confirmMessage = computed(() => {
    const fase = this.faseParaRemover();
    return fase
      ? `Deseja inativar a fase ${fase.codigo}? A inativação impede novos editais de utilizar esta fase, mas não altera o que já foi congelado — a cópia por valor de cada cronograma permanece íntegra (snapshot-copy desacoplado) e não bloqueia esta remoção lógica.`
      : 'Deseja inativar esta fase canônica?';
  });

  protected readonly form: FormGroup<FaseForm> = new FormGroup<FaseForm>({
    codigo: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    donoTipico: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(255)],
    }),
    descricao: new FormControl('', { nonNullable: true }),
    baseLegal: new FormControl('', { nonNullable: true }),
    agrupaEtapas: new FormControl(false, { nonNullable: true }),
    permiteComplementacao: new FormControl(false, { nonNullable: true }),
    origemData: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    produzResultado: new FormControl(false, { nonNullable: true }),
    resultadoDefinitivo: new FormControl(false, { nonNullable: true }),
    coletaInscricao: new FormControl(false, { nonNullable: true }),
  }, { validators: resultadoDefinitivoValidator });

  // Código selecionado atual — reage tanto ao `select` de criação quanto ao
  // `form.reset()` da edição, para controlar a visibilidade dos grupos
  // condicionais (ADR de UI da story #393: fieldset segue o código, não o modo).
  private readonly codigoAtual = toSignal(this.form.controls.codigo.valueChanges, {
    initialValue: this.form.controls.codigo.value,
  });

  protected readonly showGrupoAgrupa = computed(() => this.codigoAtual() === 'AVALIACAO');
  private readonly produzResultadoAtual = toSignal(
    this.form.controls.produzResultado.valueChanges,
    { initialValue: this.form.controls.produzResultado.value },
  );

  /** Resultado definitivo só faz sentido quando a fase produz resultado. */
  protected readonly showResultadoDefinitivo = computed(() => this.produzResultadoAtual() === true);

  protected readonly showGrupoCompl = computed(
    () => this.codigoAtual() === 'HOMOLOGACAO' || this.codigoAtual() === 'RECURSOS',
  );

  constructor() {
    effect(() => {
      const problem = this.lista.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });

    // Deixar de produzir resultado zera o resultado definitivo. Sem isso o
    // valor sobrevive escondido, o validador do grupo invalida o formulário e
    // o envio é barrado sem nenhuma mensagem visível — o campo que causou a
    // invalidez não está mais na tela.
    this.form.controls.produzResultado.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((produz) => {
        if (!produz && this.form.controls.resultadoDefinitivo.value) {
          this.form.controls.resultadoDefinitivo.setValue(false);
        }
      });
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

  protected tentarNovamente(): void {
    if (!this.loading()) {
      this.lista.reload();
    }
  }

  protected limparFiltros(): void {
    this.termoBusca.set('');
    this.donoTipicoFiltro.set('');
  }

  protected abrirCadastro(): void {
    this.modo.set('criar');
    this.faseEmEdicaoId.set(null);
    this.form.reset({
      codigo: '',
      donoTipico: '',
      nome: '',
      descricao: '',
      baseLegal: '',
      agrupaEtapas: false,
      permiteComplementacao: false,
      origemData: '',
      produzResultado: false,
      resultadoDefinitivo: false,
      coletaInscricao: false,
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  protected abrirEdicao(fase: FaseCanonicaDto): void {
    this.modo.set('editar');
    this.faseEmEdicaoId.set(fase.id);
    this.form.reset({
      codigo: fase.codigo,
      donoTipico: fase.donoTipico ?? '',
      nome: fase.nome,
      descricao: fase.descricao ?? '',
      baseLegal: fase.baseLegal ?? '',
      agrupaEtapas: fase.agrupaEtapas,
      permiteComplementacao: fase.permiteComplementacao,
      origemData: fase.origemData,
      produzResultado: fase.produzResultado,
      resultadoDefinitivo: fase.resultadoDefinitivo,
      coletaInscricao: fase.coletaInscricao,
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  protected pedirRemocao(fase: FaseCanonicaDto): void {
    this.faseParaRemover.set(fase);
    this.confirmOpen.set(true);
  }

  protected removerConfirmado(): void {
    const fase = this.faseParaRemover();
    if (fase === null || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.api
      .remover(fase.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.saving.set(false);
        if (result.ok) {
          this.notifications.success('Fase canônica inativada', fase.codigo);
          this.confirmOpen.set(false);
          this.faseParaRemover.set(null);
          this.recarregar();
          return;
        }
        this.notifications.errorFromProblem(result.problem, {
          title: this.problemI18n.resolve(result.problem).title,
        });
      });
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
    this.formError.set(null);

    if (this.modo() === 'criar') {
      this.api
        .criar(this.criarCommand(), withIdempotencyKey(this.idempotencyKeyAtual()))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((result) => this.handleSalvarResult(result));
      return;
    }

    this.api
      .atualizar(
        this.faseEmEdicaoId() ?? '',
        this.atualizarCommand(),
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result));
  }

  protected erroDoCampo(nome: keyof FaseForm): string | null {
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

  private handleSalvarResult(result: ApiResult<string | void>): void {
    this.saving.set(false);
    if (result.ok) {
      this.notifications.success(
        this.modo() === 'criar' ? 'Fase canônica criada' : 'Fase canônica atualizada',
      );
      this.formOpen.set(false);
      this.idempotencyKeyAtual.set(idempotencyKey.create());
      this.recarregar();
      return;
    }
    this.aplicarFalha(result.problem);
  }

  private aplicarFalha(problem: ProblemDetails): void {
    if (problem.status === 422 && problem.errors && problem.errors.length > 0) {
      this.renovarIdempotencyKey();
      this.aplicarErrosDeValidacao(problem.errors);
      return;
    }
    // FaseCanonica.CodigoJaExiste é um DomainError único (409, sem `errors[]`
    // — esse array só existe no pipeline FluentValidation/422); mapeado ao
    // campo manualmente para exibir o erro inline exigido pelo CA-07.
    if (problem.code === FASE_CANONICA_CODIGO_JA_EXISTE_CODE) {
      this.renovarIdempotencyKey();
      this.form.controls.codigo.setErrors({
        backend: { code: problem.code, message: this.problemI18n.resolve(problem).title },
      });
      this.form.controls.codigo.markAsTouched();
      return;
    }
    if (problem.status === 409 || problem.code === 'uniplus.idempotency.body_mismatch') {
      this.renovarIdempotencyKey();
    }
    this.formError.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) {
      this.notifications.errorFromProblem(problem);
    }
  }

  private renovarIdempotencyKey(): void {
    this.idempotencyKeyAtual.set(idempotencyKey.create());
  }

  private aplicarErrosDeValidacao(errors: ReadonlyArray<ProblemValidationError>): void {
    let aplicouAlgum = false;
    for (const erro of errors) {
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

  private criarCommand(): CriarFaseCanonicaCommand {
    const raw = this.form.getRawValue();
    return {
      codigo: raw.codigo,
      nome: raw.nome.trim(),
      descricao: nullIfBlank(raw.descricao),
      donoTipico: nullIfBlank(raw.donoTipico),
      agrupaEtapas: raw.codigo === 'AVALIACAO' ? raw.agrupaEtapas : false,
      permiteComplementacao:
        raw.codigo === 'HOMOLOGACAO' || raw.codigo === 'RECURSOS' ? raw.permiteComplementacao : false,
      baseLegal: nullIfBlank(raw.baseLegal),
      origemData: raw.origemData,
      produzResultado: raw.produzResultado,
      // O backend recusa resultado definitivo sem produção de resultado; a UI
      // já esconde o controle nesse caso, então o valor residual não vaza.
      resultadoDefinitivo: raw.produzResultado && raw.resultadoDefinitivo,
      coletaInscricao: raw.coletaInscricao,
    };
  }

  private atualizarCommand(): AtualizarFaseCanonicaCommand {
    const raw = this.form.getRawValue();
    return {
      id: this.faseEmEdicaoId() ?? '',
      nome: raw.nome.trim(),
      descricao: nullIfBlank(raw.descricao),
      donoTipico: nullIfBlank(raw.donoTipico),
      agrupaEtapas: raw.codigo === 'AVALIACAO' ? raw.agrupaEtapas : false,
      permiteComplementacao:
        raw.codigo === 'HOMOLOGACAO' || raw.codigo === 'RECURSOS' ? raw.permiteComplementacao : false,
      baseLegal: nullIfBlank(raw.baseLegal),
      origemData: raw.origemData,
      produzResultado: raw.produzResultado,
      // O backend recusa resultado definitivo sem produção de resultado; a UI
      // já esconde o controle nesse caso, então o valor residual não vaza.
      resultadoDefinitivo: raw.produzResultado && raw.resultadoDefinitivo,
      coletaInscricao: raw.coletaInscricao,
    };
  }
}

function controlNameFromBackendField(field: string): keyof FaseForm | null {
  const normalized =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  const camelCase = normalized.charAt(0).toLocaleLowerCase('pt-BR') + normalized.slice(1);
  return FASE_CONTROL_NAMES.has(camelCase) ? (camelCase as keyof FaseForm) : null;
}

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
