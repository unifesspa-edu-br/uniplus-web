import { HttpParams } from "@angular/common/http";
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import {
  ApiResult,
  Cursor,
  cursorToString,
  extractNextCursor,
  extractPrevCursor,
  idempotencyKey,
  PaginationDirection,
  ProblemDetails,
  ProblemI18nService,
  ProblemValidationError,
  useApiResource,
  withIdempotencyKey,
  withVendorMime,
} from "@uniplus/shared-core/http";
import { NotificationService } from "@uniplus/shared-core/notifications";
import {
  AtualizarRecursoAcessibilidadeCommand,
  CONFIGURACAO_BASE_PATH,
  CriarRecursoAcessibilidadeCommand,
  RecursoAcessibilidadeApi,
  RecursoAcessibilidadeDto,
} from "@uniplus/shared-data/configuracao";
import {
  AlertComponent,
  SkeletonComponent,
  TagComponent,
  EmptyStateComponent,
  DrawerComponent,
  SpinnerComponent,
  PagerComponent,
  DialogComponent,
  FilterBarComponent,
} from "@uniplus/shared-ui/components";

type ModoFormulario = "criar" | "editar";

type PaginaProps = {
 readonly cursor: Cursor;
 readonly direction: PaginationDirection
} | undefined;

interface RecursoAcessibilidadeForm {
  nome: FormControl<string>;
  descricao: FormControl<string>;
}

/** Vendor code do DomainError `RecursoAcessibilidade.NomeJaExiste` (uniplus-api, 409 Conflict). */
const RECURSO_ACESSIBILIDADE_NOME_JA_EXISTE_CODE = 'uniplus.configuracao.recurso_acessibilidade.nome_ja_existe';

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const RECURSO_ACESSIBILIDADE_CONTROL_NAMES: ReadonlySet<string> = new Set<keyof RecursoAcessibilidadeForm>([
  'nome',
  'descricao',
]);

function controlNameFromBackendField(field: string): keyof RecursoAcessibilidadeForm | null {
  const normalized =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  const camelCase = normalized.charAt(0).toLocaleLowerCase('pt-BR') + normalized.slice(1);
  return RECURSO_ACESSIBILIDADE_CONTROL_NAMES.has(camelCase) ? (camelCase as keyof RecursoAcessibilidadeForm) : null;
}

/** Tamanho de página ao esgotar o cursor (ADR-0015/0026). */
const PAGE_SIZE = 50;

@Component({
  selector: 'cfg-recurso-acessibilidade-list',
  imports: [
    AlertComponent,
    SkeletonComponent,
    TagComponent,
    EmptyStateComponent,
    DrawerComponent,
    SpinnerComponent,
    ReactiveFormsModule,
    PagerComponent,
    DialogComponent,
    FilterBarComponent,
  ],
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Recurso de Acessibilidade</h1>
        <p class="page-header__desc">
          Recursos oferecidos no atendimento especializado, independentes da condição —
          cadastro identificado pelo nome · UNI-REQ-0012.
        </p>
      </div>
    </div>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar as condições de atendimento">
        {{ errorMessage() }}
        <div class="cfg-campi__retry">
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

    @if (loading() && recursos().length === 0) {
      <ui-skeleton skeletonKind="card" blockSize="10rem" />
      <ui-skeleton skeletonKind="card" blockSize="10rem" />
    }

    <div data-scope class="cfg-unidades-scope">
      <ui-filter-bar
        ariaLabel="Filtrar recursos de acessibilidade"
        searchPlaceholder="Buscar por nome..."
        searchAriaLabel="Buscar recursos de acessibilidade"
        [(searchValue)]="termoBusca"
      >
        <button
          uiFilterBarActions
          type="button"
          class="btn btn--tertiary btn--sm btn--rect"
          (click)="limparFiltros()"
        >
          Limpar
        </button>
      </ui-filter-bar>

      <section class="panel" aria-labelledby="cfg-unidades-list-title">
        <div class="panel-head">
          <div class="panel-head__title">
            <h2 id="cfg-unidades-list-title">Recursos de acessibilidade</h2>
            <span class="list-count" aria-label="Total de recursos carregadas">
              {{ recursosFiltrados().length }}
            </span>
          </div>
          <button type="button" class="btn btn--primary" (click)="abrirDrawerCriacao()">
            <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
            Novo recurso
          </button>
        </div>

        @if (recursosFiltrados().length > 0) {
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Descrição</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span class="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                @for (recursoAcessibilidade of recursosFiltrados(); track recursoAcessibilidade.id) {
                  <tr>
                    <td data-label="Nome">
                      <div class="table-responsive__primary">
                        {{ recursoAcessibilidade.nome }}
                      </div>
                    </td>
                    <td data-label="Descrição">
                      {{ recursoAcessibilidade.descricao }}
                    </td>
                    <td data-label="Status">
                      <ui-tag variant="success">Ativa</ui-tag>
                    </td>
                    <td class="table-responsive__actions" data-label="Ações">
                      <button
                        type="button"
                        class="btn btn--tertiary btn--sm btn--rect"
                        [disabled]="loading() || submitting()"
                        (click)="abrirEdicao(recursoAcessibilidade)"
                      >
                        Editar
                      </button>
                        <button
                          type="button"
                          class="btn btn--tertiary btn--sm btn--rect"
                          [disabled]="loading() || submitting()"
                          (click)="abrirInativarRecurso(recursoAcessibilidade)"
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
              heading="Nenhum recurso de acessibilidade encontrado"
              description="Ajuste a busca para ver resultados."
            >
              <button type="button" class="btn btn--secondary" (click)="limparFiltros()">
                Limpar filtros
              </button>
            </ui-empty-state>
          } @else {
            <ui-empty-state
              heading="Nenhum recurso de acessibilidade carregado"
              description="Cadastre um recurso para iniciar a estrutura institucional."
            >
              <button type="button" class="btn btn--primary" (click)="abrirDrawerCriacao()">
                Novo recurso
              </button>
            </ui-empty-state>
          }
        }
        @if (prevCursor() !== null || nextCursor() !== null) {
          <ui-pager
            statusText="Navegação por páginas"
            navigationLabel="Paginação de recurso de acessibilidade"
            [hasPrevious]="prevCursor() !== null"
            [hasNext]="nextCursor() !== null"
            [isDisabled]="loading()"
            (previous)="paginaAnterior()"
            (next)="proximaPagina()"
          />
        }
      </section>
    </div>

    <ui-drawer
      class="cfg-form-drawer"
      [(visible)]="formOpen"
      [heading]="formHeading()"
      ariaLabel="Formulário do recurso de acessibilidade"
      position="right"
    >
      @if (formError()) {
        <ui-alert variant="danger" heading="Não foi possível salvar">
          {{ formError() }}
        </ui-alert>
      }

      <form
        [formGroup]="form"
        id="cfg-unidade-form"
        (ngSubmit)="salvar()"
        novalidate
        class="cfg-form"
      >
        <section aria-labelledby="cfg-form-identificadores">
          <div class="form-grid">
            <label class="field field--full" [class.is-error]="erroDoCampo('nome')">
              <span class="field__label is-required">Nome</span>
              <input
                class="input"
                type="text"
                placeholder="Ex.: Ledor"
                formControlName="nome"
                [attr.aria-invalid]="erroDoCampo('nome') ? 'true' : null"
              />
              <span class="field__hint">
                Identificador do recurso — único entre os recursos ativos. Impede duplicatas como dois "Ledor".
              </span>
              @if (erroDoCampo('nome')) {
                <span class="field__error">{{ erroDoCampo('nome') }}</span>
              }
            </label>
            <label class="field field--full" [class.is-error]="erroDoCampo('descricao')">
              <span class="field__label">Descrição</span>
              <textarea
                class="input"
                type="text"
                placeholder="Texto opcional — ex.: detalhes do recurso ofertado."
                formControlName="descricao"
                [attr.aria-invalid]="erroDoCampo('descricao') ? 'true' : null"
              ></textarea>
              @if (erroDoCampo('descricao')) {
                <span class="field__error">{{ erroDoCampo('descricao') }}</span>
              }
            </label>
          </div>
        </section>
      </form>

      <div class="cfg-form-footer">
        <button type="button" class="btn btn--tertiary btn--rect" (click)="formOpen.set(false)">
          Cancelar
        </button>
        <button
          type="submit"
          form="cfg-unidade-form"
          class="btn btn--primary"
          [disabled]="saving() || form.invalid"
        >
          @if (saving()) {
            <ui-spinner size="sm" />
          }
          {{ saving() ? 'Salvando...' : modo() === 'criar' ? 'Criar recurso' : 'Salvar recurso' }}
        </button>
      </div>
    </ui-drawer>
    <ui-dialog
      [(visible)]="confirmOpen"
      heading="Inativar recurso de acessibilidade?"
      (closed)="confirmOpen.set(false)"
    >
      <p>
        Você está prestes a inativar o recurso <strong>{{ recursoParaInativar()?.nome }}.</strong>
      </p>
      <p>
        A inativação impede novos editais de utilizá-lo, mas <strong>não altera ofertas já congeladas</strong>
        — a cópia por valor de cada processo permanece íntegra.
      </p>
      <div uiDialogFooter>
        <button type="button" class="btn btn--tertiary" (click)="confirmOpen.set(false)">
          Cancelar
        </button>
        <button type="button" class="btn btn--danger" (click)="inativarConfirmado()">
          Confirmar inativação
        </button>
      </div>
    </ui-dialog>
  `,
  host: { 'class': 'cfg-page' },
})
export class RecursosAcessibilidadeListPage {
  private readonly api = inject(RecursoAcessibilidadeApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  private readonly pagina = signal<PaginaProps>(undefined);
  private readonly lista = useApiResource<readonly RecursoAcessibilidadeDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/recursos-acessibilidade`,
    params: this.montarParams(),
    context: withVendorMime('recurso-acessibilidade', 1),
  }));
  protected readonly termoBusca = signal('');
  protected readonly loading = this.lista.isLoading;
  private readonly cursores = linkedSignal<
    ApiResult<readonly RecursoAcessibilidadeDto[]> | undefined,
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
  protected readonly recursos = linkedSignal<
      ApiResult<readonly RecursoAcessibilidadeDto[]> | undefined,
      readonly RecursoAcessibilidadeDto[]
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
  // Busca client-side sobre a página carregada: o backend (api#588) só pagina
  // por cursor, sem filtro de texto/código/nome no contrato.
  protected readonly recursosFiltrados = computed(() => {
    const termo = this.termoBusca().trim().toLocaleLowerCase('pt-BR');
    if (termo.length === 0) {
      return this.recursos();
    }
    return this.recursos().filter(
      (recurso) => recurso.nome.toLocaleLowerCase('pt-BR').includes(termo),
    );
  });
  protected readonly errorMessage = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar recursos de acessibilidade.' : null;
  });
  readonly modo = signal<ModoFormulario>('criar');
  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  readonly drawerOpen = signal(false);
  readonly submitting = signal(false);
  readonly recursoParaInativar = signal<RecursoAcessibilidadeDto | null>(null);
  readonly confirmOpen = signal(false);

  readonly form = new FormGroup<RecursoAcessibilidadeForm>({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(255)]
    }),
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(1000)]
    }),
  });
  protected readonly formError = signal<string | null>(null);
  readonly recursosAcessibilidadeEmEdicaoId = signal<string | null>(null);
  protected readonly temFiltro = computed(() => this.termoBusca().trim().length > 0);

  protected readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Novo recurso de acessibilidade' : 'Editar recurso de acessibilidade',
  );

  constructor() {
    effect(() => {
      const problem = this.lista.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });
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

  tentarNovamente(): void {
    if (!this.loading()) {
      this.lista.reload();
    }
  }

  limparFiltroBusca() {
    this.termoBusca.set('');
  }

  limparFiltros() {
    this.limparFiltroBusca();
  }

  abrirDrawerCriacao() {
    this.modo.set('criar');
    this.form.reset({
      nome: '',
      descricao: '',
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  abrirInativarRecurso(recurso: RecursoAcessibilidadeDto): void {
    this.recursoParaInativar.set(recurso);
    this.confirmOpen.set(true);
  }

  protected abrirEdicao(recurso: RecursoAcessibilidadeDto): void {this.modo.set('editar');
    this.recursosAcessibilidadeEmEdicaoId.set(recurso.id);
    this.form.reset({
      nome: recurso.nome,
      descricao: recurso.descricao ?? ''
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.drawerOpen.set(false);
    this.formOpen.set(true);
  }

  protected erroDoCampo(nome: keyof RecursoAcessibilidadeForm): string | null {
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
    if (control.errors['minlength']) return `Informe ao menos ${control.errors['minlength']['requiredLength']} caracteres.`;
    if (control.errors['maxlength']) return 'Valor acima do tamanho permitido.';
    return 'Valor inválido.';
  }

  private criarCommand(): CriarRecursoAcessibilidadeCommand {
    const raw = this.form.getRawValue();
    return {
      nome: raw.nome.trim(),
      descricao: nullIfBlank(raw.descricao),
    };
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
        .criar(
          this.criarCommand(),
          withIdempotencyKey(this.idempotencyKeyAtual())
        )
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((result) => this.handleSalvarResult(result));
      return;
    }

    this.api
      .atualizar(
        this.recursosAcessibilidadeEmEdicaoId() ?? '',
        this.atualizarCommand(),
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result));
  }

  private recarregar(): void {
    if (this.pagina() === undefined) {
      this.lista.reload();
    } else {
      this.pagina.set(undefined);
    }
  }

  private atualizarCommand(): AtualizarRecursoAcessibilidadeCommand {
    return { id: this.recursosAcessibilidadeEmEdicaoId() ?? '', ...this.criarCommand() };
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

  private aplicarFalha(problem: ProblemDetails): void {
    if (problem.status === 422 && problem.errors && problem.errors.length > 0) {
      this.notifications.errorFromProblem(problem);
      this.renovarIdempotencyKey();
      this.aplicarErrosDeValidacao(problem.errors);
      return;
    }

    if (problem.code === RECURSO_ACESSIBILIDADE_NOME_JA_EXISTE_CODE) {
      this.renovarIdempotencyKey();
      this.form.controls.nome.setErrors({
        backend: { code: problem.code, message: this.problemI18n.resolve(problem).title },
      });
      this.form.controls.nome.markAsTouched();
      this.notifications.errorFromProblem(problem);
      return;
    }
    if (problem.status === 409 || problem.code === 'uniplus.idempotency.body_mismatch') {
      this.notifications.errorFromProblem(problem);
      this.renovarIdempotencyKey();
    }
    this.formError.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) {
      this.notifications.errorFromProblem(problem);
    }
  }

  private handleSalvarResult(result: ApiResult<string | void>): void {
    this.saving.set(false);
    if (result.ok) {
      this.notifications.success(
        this.modo() === 'criar'
          ? 'Recurso de acessibilidade criado'
          : 'Recurso de acessibilidade atualizado',
      );
      this.formOpen.set(false);
      this.idempotencyKeyAtual.set(idempotencyKey.create());
      this.recarregar();
      return;
    }
    this.aplicarFalha(result.problem);
  }

  private handleRemoverResult(result: ApiResult<void>): void {
    this.saving.set(false);
    if (result.ok) {
      this.notifications.success('Recurso de acessibilidade inativado');
      this.formOpen.set(false);
      this.confirmOpen.set(false);
      this.recursoParaInativar.set(null);
      this.recarregar();
      return;
    }
    this.aplicarFalha(result.problem);
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

  protected inativarConfirmado(): void {
    const recurso = this.recursoParaInativar();
    if (recurso === null || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.api
      .remover(recurso.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleRemoverResult(result));
  }
}
