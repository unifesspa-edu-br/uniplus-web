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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
  AtualizarCursoCommand,
  CONFIGURACAO_BASE_PATH,
  CriarCursoCommand,
  CursoDto,
  CursosApi,
  GRUPOS_AREA_ENEM,
  OfertaCursoDto,
  PROGRAMAS_DE_OFERTA,
  REGIMES_DE_TURNO,
  TURNOS_OFERTA,
  ordenarTurnosCanonicamente,
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  ConfirmDialogComponent,
  DrawerComponent,
  EmptyStateComponent,
  FilterBarComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';

/** Janela da lista de ofertas do curso no drawer (cursor pagination, ADR-0026). */
const PAGE_SIZE = 50;

/** Opções de "itens por página" do rodapé da lista principal (backend aceita 1..100). */
const OPCOES_LIMITE = [10, 25, 50, 100] as const;

/** Limite inicial da lista principal, antes de qualquer escolha do usuário. */
const LIMITE_PADRAO = 25;

/** Coluna e sentido da ordenação server-side (`?ordenarPor=&ordem=`). */
type ColunaOrdenavel = 'nome' | 'codigo';
type SentidoOrdenacao = 'asc' | 'desc';
interface Ordenacao {
  readonly por: ColunaOrdenavel;
  readonly sentido: SentidoOrdenacao;
}

/** Vendor code do DomainError `Curso.CodigoJaExiste` (uniplus-api, 409 Conflict). */
const CURSO_CODIGO_JA_EXISTE_CODE = 'uniplus.configuracao.curso.codigo_ja_existe';

/** Rótulos dos tokens de programa, regime e turno da oferta (domínios fechados, ofertas-curso.api). */
const PROGRAMA_LABELS = new Map(PROGRAMAS_DE_OFERTA.map((opcao) => [opcao.value, opcao.label]));
const TURNO_LABELS = new Map(TURNOS_OFERTA.map((opcao) => [opcao.value, opcao.label]));
const REGIME_LABELS = new Map(REGIMES_DE_TURNO.map((opcao) => [opcao.value, opcao.label]));

type ModoFormulario = 'criar' | 'editar';

interface CursoForm {
  codigo: FormControl<string>;
  nome: FormControl<string>;
  grau: FormControl<string>;
  nivelEnsino: FormControl<string>;
  grupoAreaEnem: FormControl<string>;
}

@Component({
  selector: 'cfg-cursos-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ConfirmDialogComponent,
    DrawerComponent,
    EmptyStateComponent,
    FilterBarComponent,
    PagerComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Curso</h1>
        <p class="page-header__desc">
          Matriz curricular pura — código, nome, grau, nível de ensino e grupo de área do ENEM
          opcional. Local, unidade e e-MEC pertencem à Oferta de Curso. UNI-REQ-0010.
        </p>
      </div>
    </div>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar os cursos">
        {{ errorMessage() }}
        <div class="cfg-cursos__retry">
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
    <section class="panel" aria-labelledby="cfg-cursos-list-title">
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 id="cfg-cursos-list-title">Cursos</h2>
          @if (loading()) {
            <span class="cfg-cursos__loading"><ui-spinner size="sm" /> Carregando</span>
          }
        </div>
        <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
          <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
          Novo curso
        </button>
      </div>

      <ui-filter-bar
        ariaLabel="Filtrar cursos"
        searchPlaceholder="Buscar por código ou nome..."
        searchAriaLabel="Buscar curso"
        [(searchValue)]="termoBusca"
      />

      @if (cursosFiltrados().length > 0) {
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col" [attr.aria-sort]="ariaSort('nome')">
                  <button
                    type="button"
                    class="th-sort"
                    [disabled]="loading()"
                    (click)="alternarOrdenacao('nome')"
                  >
                    <span>Nome</span>
                    <i [class]="iconeOrdenacao('nome')" aria-hidden="true"></i>
                  </button>
                </th>
                <th scope="col">Grau</th>
                <th scope="col">Nível</th>
                <th scope="col">Grupo ENEM</th>
                <th scope="col"><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              @for (curso of cursosFiltrados(); track curso.id) {
                <tr>
                  <td data-label="Código">
                    <code>{{ curso.codigo }}</code>
                  </td>
                  <td data-label="Nome">{{ curso.nome }}</td>
                  <td data-label="Grau">
                    <span class="tag">{{ curso.grau }}</span>
                  </td>
                  <td data-label="Nível">{{ curso.nivelEnsino }}</td>
                  <td data-label="Grupo ENEM">{{ curso.grupoAreaEnem || '—' }}</td>
                  <td class="table-responsive__actions" data-label="Ações">
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm btn--rect"
                      [disabled]="loading()"
                      (click)="abrirOfertas(curso)"
                    >
                      Ofertas
                    </button>
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm btn--rect"
                      [disabled]="loading()"
                      (click)="abrirEdicao(curso)"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm btn--rect"
                      [disabled]="loading()"
                      (click)="pedirRemocao(curso)"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (!loading() && !errorMessage()) {
        <ui-empty-state
          heading="Nenhum curso encontrado"
          description="Cadastre o primeiro curso para vincular ofertas de curso."
        >
          <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
            Novo curso
          </button>
        </ui-empty-state>
      }

      @if (cursosFiltrados().length > 0 || prevCursor() !== null || nextCursor() !== null) {
        <ui-pager
          navigationLabel="Paginação de cursos"
          [pageSizeOptions]="opcoesLimite"
          [pageSize]="limite()"
          (pageSizeChange)="aoTrocarLimite($event)"
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
      ariaLabel="Formulário de curso"
      position="right"
    >
      @if (formError()) {
        <ui-alert variant="danger" heading="Não foi possível salvar">{{ formError() }}</ui-alert>
      }

      <ui-alert variant="info" [dynamic]="false" heading="Curso é a matriz curricular pura">
        Código e-MEC, local, unidade ofertante, programa, formato, regime e turnos pertencem à
        Oferta de Curso, não ao Curso.
      </ui-alert>

      <form
        [formGroup]="form"
        id="cfg-curso-form"
        (ngSubmit)="salvar()"
        novalidate
        class="cfg-form"
      >
        <section aria-labelledby="cfg-curso-identificacao">
          <h3 id="cfg-curso-identificacao" class="form-section__title">Dados curriculares</h3>
          <div class="form-grid form-grid--1col">
            <label class="field" [class.is-error]="erroDoCampo('codigo')">
              <span class="field__label is-required">Código</span>
              <input
                class="input"
                type="text"
                formControlName="codigo"
                [attr.aria-invalid]="erroDoCampo('codigo') ? 'true' : null"
              />
              <span class="field__hint">
                Chave curricular do curso. Diferente do código e-MEC (que pertence à oferta).
              </span>
              @if (erroDoCampo('codigo')) {
                <span class="field__error">{{ erroDoCampo('codigo') }}</span>
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
            <label class="field" [class.is-error]="erroDoCampo('grau')">
              <span class="field__label is-required">Grau</span>
              <input
                class="input"
                type="text"
                list="cfg-curso-graus-sugestoes"
                formControlName="grau"
                [attr.aria-invalid]="erroDoCampo('grau') ? 'true' : null"
              />
              <datalist id="cfg-curso-graus-sugestoes">
                <option value="Bacharelado"></option>
                <option value="Licenciatura"></option>
                <option value="Tecnólogo"></option>
                <option value="Especialização"></option>
              </datalist>
              <span class="field__hint">Titulação conferida pelo curso.</span>
              @if (erroDoCampo('grau')) {
                <span class="field__error">{{ erroDoCampo('grau') }}</span>
              }
            </label>
            <label class="field" [class.is-error]="erroDoCampo('nivelEnsino')">
              <span class="field__label is-required">Nível de ensino</span>
              <input
                class="input"
                type="text"
                list="cfg-curso-niveis-sugestoes"
                formControlName="nivelEnsino"
                [attr.aria-invalid]="erroDoCampo('nivelEnsino') ? 'true' : null"
              />
              <datalist id="cfg-curso-niveis-sugestoes">
                <option value="Graduação"></option>
                <option value="Mestrado"></option>
                <option value="Doutorado"></option>
                <option value="Técnico"></option>
              </datalist>
              <span class="field__hint">Etapa de ensino — independente do grau.</span>
              @if (erroDoCampo('nivelEnsino')) {
                <span class="field__error">{{ erroDoCampo('nivelEnsino') }}</span>
              }
            </label>
            <label class="field" [class.is-error]="erroDoCampo('grupoAreaEnem')">
              <span class="field__label">Grupo de área do ENEM</span>
              <select class="select" formControlName="grupoAreaEnem">
                <option value="">Não classificado</option>
                @for (grupo of gruposAreaEnem; track grupo.value) {
                  <option [value]="grupo.value">{{ grupo.label }}</option>
                }
              </select>
              <span class="field__hint">
                Quando presente, liga ao cadastro de pesos por grupo do ENEM.
              </span>
              @if (erroDoCampo('grupoAreaEnem')) {
                <span class="field__error">{{ erroDoCampo('grupoAreaEnem') }}</span>
              }
            </label>
          </div>
        </section>
      </form>

      <div class="cfg-form-footer">
        <button type="button" class="btn btn--tertiary btn--rect" (click)="formOpen.set(false)">
          Cancelar
        </button>
        <button type="submit" form="cfg-curso-form" class="btn btn--primary" [disabled]="saving()">
          @if (saving()) {
            <ui-spinner size="sm" />
          }
          {{ saving() ? 'Salvando...' : modo() === 'criar' ? 'Criar curso' : 'Salvar curso' }}
        </button>
      </div>
    </ui-drawer>

    <ui-confirm-dialog
      [(visible)]="confirmOpen"
      heading="Remover curso"
      [message]="confirmMessage()"
      confirmLabel="Remover"
      confirmVariant="danger"
      (confirmed)="removerConfirmado()"
    />

    <ui-drawer
      class="cfg-ofertas-drawer"
      [(visible)]="ofertasOpen"
      [heading]="ofertasHeading()"
      ariaLabel="Ofertas de curso do curso selecionado"
      position="right"
      (closed)="aoFecharOfertas()"
    >
      @if (ofertasBloqueio()) {
        <ui-alert variant="danger" heading="Remoção bloqueada">
          {{ ofertasBloqueio() }} Remova as ofertas abaixo antes de excluir o curso.
        </ui-alert>
      } @else {
        <ui-alert variant="info" [dynamic]="false" heading="Ofertas vivas deste curso">
          Instâncias regulatórias (Oferta de curso) que referenciam este curso. Enquanto houver
          ofertas ativas, a remoção do curso é bloqueada.
        </ui-alert>
      }

      @if (ofertasErrorMessage()) {
        <ui-alert variant="danger" heading="Não foi possível carregar as ofertas">
          {{ ofertasErrorMessage() }}
          <div class="cfg-ofertas__retry">
            <button
              type="button"
              class="btn btn--secondary btn--sm"
              [disabled]="ofertasLoading()"
              (click)="recarregarOfertas()"
            >
              Tentar novamente
            </button>
          </div>
        </ui-alert>
      }

      @if (ofertasLoading()) {
        <p class="cfg-ofertas__loading"><ui-spinner size="sm" /> Carregando ofertas…</p>
      }

      @if (ofertas().length > 0) {
        <ul class="cfg-ofertas-list">
          @for (oferta of ofertas(); track oferta.id) {
            <li class="cfg-ofertas-list__item">
              <p class="cfg-ofertas-list__unidade">
                {{ oferta.unidadeOfertante.sigla }} — {{ oferta.unidadeOfertante.nome }}
              </p>
              <p class="cfg-ofertas-list__meta">
                <span class="tag">{{ programaLabel(oferta.programaDeOferta) }}</span>
                <span class="tag">{{ regimeLabel(oferta.regimeDeTurno) }}</span>
                <span>{{ turnosLabel(oferta.turnos) }}</span>
              </p>
            </li>
          }
        </ul>
      } @else if (!ofertasLoading() && !ofertasErrorMessage()) {
        <ui-empty-state
          heading="Nenhuma oferta ativa"
          description="Este curso não possui ofertas de curso vivas — a remoção não será bloqueada."
        />
      }

      @if (ofertasPrevCursor() !== null || ofertasNextCursor() !== null) {
        <ui-pager
          statusText="Navegação por páginas"
          navigationLabel="Paginação de ofertas do curso"
          [hasPrevious]="ofertasPrevCursor() !== null"
          [hasNext]="ofertasNextCursor() !== null"
          [isDisabled]="ofertasLoading()"
          (previous)="paginaAnteriorOfertas()"
          (next)="proximaPaginaOfertas()"
        />
      }
    </ui-drawer>
  `,
  host: { class: 'cfg-page' },
})
export class CursosPage {
  private readonly api = inject(CursosApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  protected readonly gruposAreaEnem = GRUPOS_AREA_ENEM;

  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly modo = signal<ModoFormulario>('criar');
  protected readonly cursoEmEdicaoId = signal<string | null>(null);
  protected readonly cursoParaRemover = signal<CursoDto | null>(null);
  protected readonly confirmError = signal<string | null>(null);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());
  protected readonly termoBusca = signal('');

  /** Itens por página escolhidos no rodapé; só em memória (volta ao padrão a cada visita). */
  protected readonly limite = signal<number>(LIMITE_PADRAO);
  protected readonly opcoesLimite = OPCOES_LIMITE;

  /** Ordenação corrente da lista; `null` = ordem padrão do backend (por Id). */
  protected readonly ordenacao = signal<Ordenacao | null>(null);

  // Drawer "Ofertas do curso" — inspeção sob demanda das ofertas vivas de um
  // curso via filtro `?cursoId` (api#755, issue #435).
  protected readonly ofertasOpen = signal(false);
  protected readonly cursoParaOfertas = signal<CursoDto | null>(null);
  protected readonly ofertasBloqueio = signal<string | null>(null);
  private readonly ofertasPagina = signal<
    { readonly cursor: Cursor; readonly direction: PaginationDirection } | undefined
  >(undefined);

  private readonly pagina = signal<
    { readonly cursor: Cursor; readonly direction: PaginationDirection } | undefined
  >(undefined);

  private readonly lista = useApiResource<readonly CursoDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/cursos`,
    params: this.montarParams(),
    context: withVendorMime('curso', 1),
  }));

  protected readonly loading = this.lista.isLoading;

  private readonly cursores = linkedSignal<
    ApiResult<readonly CursoDto[]> | undefined,
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

  protected readonly cursos = linkedSignal<
    ApiResult<readonly CursoDto[]> | undefined,
    readonly CursoDto[]
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

  // Ofertas vivas do curso selecionado — só dispara quando o drawer tem um
  // curso (request fn `undefined` = sem fetch). Filtro `?cursoId` reanexado a
  // cada página; prev/next lidos do header Link (ADR-0026 web + api#755).
  private readonly listaOfertas = useApiResource<readonly OfertaCursoDto[]>(() => {
    const curso = this.cursoParaOfertas();
    if (curso === null) {
      return undefined;
    }
    return {
      url: `${this.basePath}/api/configuracao/ofertas-curso`,
      params: this.montarParamsOfertas(curso.id),
      context: withVendorMime('oferta-curso', 1),
    };
  });

  protected readonly ofertasLoading = this.listaOfertas.isLoading;

  private readonly ofertasCursores = linkedSignal<
    ApiResult<readonly OfertaCursoDto[]> | undefined,
    { readonly prev: Cursor | null; readonly next: Cursor | null }
  >({
    source: () => this.listaOfertas.value(),
    computation: (envelope, previous) => {
      const atual = previous?.value ?? { prev: null, next: null };
      if (envelope === undefined) {
        return atual;
      }
      const primeiraPagina = untracked(() => this.ofertasPagina() === undefined);
      if (!envelope.ok) {
        return primeiraPagina ? { prev: null, next: null } : atual;
      }
      const link = untracked(() => this.listaOfertas.headers()?.get('Link') ?? null);
      return { prev: extractPrevCursor(link), next: extractNextCursor(link) };
    },
  });

  protected readonly ofertasPrevCursor = computed(() => this.ofertasCursores().prev);
  protected readonly ofertasNextCursor = computed(() => this.ofertasCursores().next);

  protected readonly ofertas = linkedSignal<
    ApiResult<readonly OfertaCursoDto[]> | undefined,
    readonly OfertaCursoDto[]
  >({
    source: () => this.listaOfertas.value(),
    computation: (envelope, previous) => {
      const atual = previous?.value ?? [];
      if (envelope === undefined) {
        return atual;
      }
      const primeiraPagina = untracked(() => this.ofertasPagina() === undefined);
      if (!envelope.ok) {
        return primeiraPagina ? [] : atual;
      }
      return [...envelope.data];
    },
  });

  protected readonly ofertasErrorMessage = computed<string | null>(() => {
    const problem = this.listaOfertas.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.listaOfertas.error() ? 'Erro inesperado ao carregar as ofertas do curso.' : null;
  });

  protected readonly ofertasHeading = computed(() => {
    const curso = this.cursoParaOfertas();
    return curso ? `Ofertas de ${curso.codigo}` : 'Ofertas do curso';
  });

  // Busca client-side sobre a página carregada: o backend (api#588) só pagina
  // por cursor, sem filtro de texto/código/nome no contrato.
  protected readonly cursosFiltrados = computed(() => {
    const termo = this.termoBusca().trim().toLocaleLowerCase('pt-BR');
    if (termo.length === 0) {
      return this.cursos();
    }
    return this.cursos().filter(
      (curso) =>
        curso.codigo.toLocaleLowerCase('pt-BR').includes(termo) ||
        curso.nome.toLocaleLowerCase('pt-BR').includes(termo),
    );
  });

  protected readonly errorMessage = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar cursos.' : null;
  });

  protected readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Novo curso' : 'Editar curso',
  );

  protected readonly confirmMessage = computed(() => {
    const erro = this.confirmError();
    if (erro !== null) {
      return erro;
    }
    const curso = this.cursoParaRemover();
    return curso
      ? `Deseja remover ${curso.codigo} — ${curso.nome}? A remoção é lógica (soft-delete) e preserva o histórico. Se o curso for a matriz de uma oferta de curso ativa, a remoção será bloqueada.`
      : 'Deseja remover este curso?';
  });

  protected readonly form: FormGroup<CursoForm> = new FormGroup<CursoForm>({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(60)],
    }),
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    grau: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(60)],
    }),
    nivelEnsino: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(60)],
    }),
    grupoAreaEnem: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const problem = this.lista.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
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

  /**
   * Troca o limite e volta à primeira página: o cursor da página atual carrega
   * a janela antiga (ADR-0026), então navegar a partir dele ignoraria a escolha.
   * `montarParams` lê `limite()` no ramo da primeira página, então o reset de
   * `pagina` (ou o próprio `limite`, quando já na primeira) redispara o GET.
   */
  protected aoTrocarLimite(valor: number | null): void {
    if (valor === null || valor === this.limite() || this.loading()) {
      return;
    }
    this.limite.set(valor);
    this.pagina.set(undefined);
  }

  /**
   * Ciclo do cabeçalho ordenável: sem ordem → asc → desc → sem ordem. Trocar a
   * ordem volta à primeira página (o cursor atual carrega a ordem antiga, como
   * o `limit`); `montarParams` lê `ordenacao()` no ramo da primeira página.
   */
  protected alternarOrdenacao(por: ColunaOrdenavel): void {
    if (this.loading()) {
      return;
    }
    const atual = this.ordenacao();
    const proxima: Ordenacao | null =
      atual === null || atual.por !== por
        ? { por, sentido: 'asc' }
        : atual.sentido === 'asc'
          ? { por, sentido: 'desc' }
          : null;
    this.ordenacao.set(proxima);
    this.pagina.set(undefined);
  }

  /** Valor de `aria-sort` do `<th>` da coluna (WAI-ARIA: `none` quando não é a coluna ativa). */
  protected ariaSort(por: ColunaOrdenavel): 'ascending' | 'descending' | 'none' {
    const atual = this.ordenacao();
    if (atual === null || atual.por !== por) {
      return 'none';
    }
    return atual.sentido === 'asc' ? 'ascending' : 'descending';
  }

  /** Classe completa do PrimeIcon que indica o estado de ordenação da coluna. */
  protected iconeOrdenacao(por: ColunaOrdenavel): string {
    const atual = this.ordenacao();
    const glifo =
      atual === null || atual.por !== por
        ? 'pi-sort-alt'
        : atual.sentido === 'asc'
          ? 'pi-sort-amount-up-alt'
          : 'pi-sort-amount-down-alt';
    return `pi th-sort__icon ${glifo}`;
  }

  /** Abre o drawer com as ofertas vivas do curso (inspeção proativa, sem contexto de bloqueio). */
  protected abrirOfertas(curso: CursoDto): void {
    this.ofertasBloqueio.set(null);
    this.exibirOfertas(curso);
  }

  private exibirOfertas(curso: CursoDto): void {
    // Zera lista e cursores ANTES de trocar o curso: os linkedSignals preservam
    // o valor anterior enquanto o envelope é `undefined` (loading), então sem
    // este reset o drawer exibiria as ofertas do curso anterior sob o cabeçalho
    // do novo até o GET resolver (cabeçalho ≠ corpo).
    this.limparOfertas();
    this.ofertasPagina.set(undefined);
    this.cursoParaOfertas.set(curso);
    this.ofertasOpen.set(true);
  }

  protected aoFecharOfertas(): void {
    // Limpa o curso (a request fn passa a retornar `undefined`) para que a
    // próxima abertura refaça a busca do zero, sempre com dados frescos.
    this.cursoParaOfertas.set(null);
    this.ofertasBloqueio.set(null);
    this.limparOfertas();
  }

  private limparOfertas(): void {
    this.ofertas.set([]);
    this.ofertasCursores.set({ prev: null, next: null });
  }

  protected recarregarOfertas(): void {
    if (!this.ofertasLoading()) {
      this.listaOfertas.reload();
    }
  }

  protected proximaPaginaOfertas(): void {
    const proximo = this.ofertasNextCursor();
    if (proximo !== null && !this.ofertasLoading()) {
      this.ofertasPagina.set({ cursor: proximo, direction: 'next' });
    }
  }

  protected paginaAnteriorOfertas(): void {
    const anterior = this.ofertasPrevCursor();
    if (anterior !== null && !this.ofertasLoading()) {
      this.ofertasPagina.set({ cursor: anterior, direction: 'prev' });
    }
  }

  protected programaLabel(token: string): string {
    return PROGRAMA_LABELS.get(token) ?? token;
  }

  protected regimeLabel(token: string): string {
    return REGIME_LABELS.get(token) ?? token;
  }

  protected turnosLabel(tokens: readonly string[]): string {
    if (tokens.length === 0) {
      return '—';
    }
    return ordenarTurnosCanonicamente(tokens)
      .map((token) => TURNO_LABELS.get(token) ?? token)
      .join(' e ');
  }

  protected tentarNovamente(): void {
    if (!this.loading()) {
      this.lista.reload();
    }
  }

  protected abrirCadastro(): void {
    this.modo.set('criar');
    this.cursoEmEdicaoId.set(null);
    this.form.reset({ codigo: '', nome: '', grau: '', nivelEnsino: '', grupoAreaEnem: '' });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  protected abrirEdicao(curso: CursoDto): void {
    this.modo.set('editar');
    this.cursoEmEdicaoId.set(curso.id);
    this.form.reset({
      codigo: curso.codigo,
      nome: curso.nome,
      grau: curso.grau,
      nivelEnsino: curso.nivelEnsino,
      grupoAreaEnem: curso.grupoAreaEnem ?? '',
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  protected pedirRemocao(curso: CursoDto): void {
    this.cursoParaRemover.set(curso);
    this.confirmError.set(null);
    this.confirmOpen.set(true);
  }

  protected removerConfirmado(): void {
    const curso = this.cursoParaRemover();
    if (curso === null || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.api
      .remover(curso.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.saving.set(false);
        if (result.ok) {
          this.notifications.success('Curso removido', curso.codigo);
          this.confirmOpen.set(false);
          this.cursoParaRemover.set(null);
          this.recarregar();
          return;
        }
        // A mensagem exibida é a que a API já devolve no ProblemDetails (title),
        // sem acoplar a UI ao vendor code do erro.
        const titulo = this.problemI18n.resolve(result.problem).title;
        // 409 é o único conflito possível no DELETE do curso: referenciado por
        // oferta viva. Em vez de só reexibir o texto, fecha o confirm e abre o
        // drawer de Ofertas com o preview das ofertas que bloqueiam a remoção
        // (issue #435, CA2) — o operador vê exatamente o que impede a exclusão.
        if (result.problem.status === 409) {
          this.confirmOpen.set(false);
          this.cursoParaRemover.set(null);
          this.ofertasBloqueio.set(titulo);
          this.exibirOfertas(curso);
          return;
        }
        // Demais falhas (5xx, rede): mantém o confirm aberto com a mensagem. O
        // `ui-confirm-dialog` fecha a si mesmo de forma síncrona ao emitir
        // `confirmed`; reabrir explicitamente mantém o erro visível ao operador.
        this.confirmError.set(titulo);
        this.confirmOpen.set(true);
        if (result.problem.status >= 500) {
          this.notifications.errorFromProblem(result.problem, { title: titulo });
        }
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
        this.cursoEmEdicaoId() ?? '',
        this.atualizarCommand(),
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result));
  }

  protected erroDoCampo(nome: keyof CursoForm): string | null {
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
      let params = new HttpParams().set('limit', String(this.limite()));
      const ordem = this.ordenacao();
      if (ordem !== null) {
        params = params.set('ordenarPor', ordem.por).set('ordem', ordem.sentido);
      }
      return params;
    }
    return new HttpParams()
      .set('cursor', cursorToString(pagina.cursor))
      .set('direction', pagina.direction);
  }

  /** Params da listagem de ofertas do curso — `cursoId` reanexado em toda página (api#755). */
  private montarParamsOfertas(cursoId: string): HttpParams {
    const pagina = this.ofertasPagina();
    if (pagina === undefined) {
      return new HttpParams().set('limit', String(PAGE_SIZE)).set('cursoId', cursoId);
    }
    return new HttpParams()
      .set('cursor', cursorToString(pagina.cursor))
      .set('direction', pagina.direction)
      .set('cursoId', cursoId);
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
      this.notifications.success(this.modo() === 'criar' ? 'Curso criado' : 'Curso atualizado');
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
    // Curso.CodigoJaExiste é um DomainError único (409, sem `errors[]` — esse
    // array só existe no pipeline FluentValidation/422); mapeado ao campo
    // manualmente para exibir o erro inline exigido pelo CA-03.
    if (problem.code === CURSO_CODIGO_JA_EXISTE_CODE) {
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

  private criarCommand(): CriarCursoCommand {
    const raw = this.form.getRawValue();
    return {
      codigo: raw.codigo.trim(),
      nome: raw.nome.trim(),
      grau: raw.grau.trim(),
      nivelEnsino: raw.nivelEnsino.trim(),
      grupoAreaEnem: nullIfBlank(raw.grupoAreaEnem),
    };
  }

  private atualizarCommand(): AtualizarCursoCommand {
    return { id: this.cursoEmEdicaoId() ?? '', ...this.criarCommand() };
  }
}

const CURSO_CONTROL_NAMES: ReadonlySet<string> = new Set<keyof CursoForm>([
  'codigo',
  'nome',
  'grau',
  'nivelEnsino',
  'grupoAreaEnem',
]);

function controlNameFromBackendField(field: string): keyof CursoForm | null {
  const normalized =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  const camelCase = normalized.charAt(0).toLocaleLowerCase('pt-BR') + normalized.slice(1);
  return CURSO_CONTROL_NAMES.has(camelCase) ? (camelCase as keyof CursoForm) : null;
}

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
