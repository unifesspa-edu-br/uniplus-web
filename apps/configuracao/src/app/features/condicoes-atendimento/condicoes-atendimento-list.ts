import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  OnInit,
  signal,
  untracked
} from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  Cursor,
  ProblemI18nService,
  ProblemDetails,
  idempotencyKey,
  ApiResult,
  ProblemValidationError,
  withIdempotencyKey,
  PaginationDirection,
  useApiResource,
  cursorToString,
  withVendorMime,
  extractPrevCursor,
  extractNextCursor,
} from '@uniplus/shared-core/http';
import {NotificationService } from '@uniplus/shared-core/notifications';
import {
  AtualizarCondicaoAtendimentoCommand,
  CondicaoAtendimentoDto,
  CondicoesAtendimentoApi,
  CONFIGURACAO_BASE_PATH,
  CriarCondicaoAtendimentoCommand
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  SkeletonComponent,
  EmptyStateComponent,
  SpinnerComponent,
  DrawerComponent,
  TagComponent,
  DialogComponent,
  PagerComponent
} from "@uniplus/shared-ui/components";

type ModoFormulario = 'criar' | 'editar';

interface CondicaoAtendimentoForm {
  codigo: FormControl<string>;
  nome: FormControl<string>;
  descricao: FormControl<string>;
}

type PaginaProps = {
  readonly cursor: Cursor;
  readonly direction: PaginationDirection
} | undefined;

/** Tamanho de página ao esgotar o cursor (ADR-0015/0026) — ver `carregar()`. */
const PAGE_SIZE = 50;

/** Vendor code do DomainError `CondicaoAtendimento.CodigoJaExiste` (uniplus-api, 409 Conflict). */
const CONDICAO_ATENDIMENTO_CODIGO_JA_EXISTE_CODE = 'uniplus.configuracao.condicao_atendimento.codigo_ja_existe';

const CONDICOES_ATENDIMENTO_CONTROL_NAMES: ReadonlySet<string> = new Set<keyof CondicaoAtendimentoForm>([
  'codigo',
  'nome',
  'descricao',
]);

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function controlNameFromBackendField(field: string): keyof CondicaoAtendimentoForm | null {
  const normalized =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  const camelCase = normalized.charAt(0).toLocaleLowerCase('pt-BR') + normalized.slice(1);
  return CONDICOES_ATENDIMENTO_CONTROL_NAMES.has(camelCase) ? (camelCase as keyof CondicaoAtendimentoForm) : null;
}

@Component({
  selector: 'cfg-condicoes-atendimento-list',
  imports: [
    AlertComponent,
    SkeletonComponent,
    EmptyStateComponent,
    SpinnerComponent,
    DrawerComponent,
    ReactiveFormsModule,
    TagComponent,
    DialogComponent,
    PagerComponent,
  ],
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Condição de Atendimento</h1>
        <p class="page-header__desc">
          Condições que habilitam o candidato a solicitar atendimento especializado — cadastro
          independente, identificado por código · UNI-REQ-0012.
        </p>
      </div>
    </div>
    <ui-alert variant="info" heading="Código editável, com exceção do PCD" [dynamic]="false">
      O código de uma condição é editável (com nova checagem de unicidade entre as ativas) — as
      ofertas já congeladas em editais permanecem intactas. A única exceção é o código PCD (Pessoa
      com Deficiência), reservado e protegido: não pode ser renomeado nem inativado, pois a regra de
      oferta de atendimento o referencia literalmente.
    </ui-alert>
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
    @if (loading() && condicoes().length === 0) {
      <ui-skeleton skeletonKind="card" blockSize="10rem" />
      <ui-skeleton skeletonKind="card" blockSize="10rem" />
    }
    <div data-scope class="cfg-unidades-scope">
      <div class="filter-bar" role="search" aria-label="Filtrar condições de atendimento">
        <div class="filter-bar__row">
          <div class="input-group">
            <span class="input-group__addon" aria-hidden="true">
              <i class="pi pi-search"></i>
            </span>
            <input
              type="search"
              class="input"
              placeholder="Buscar por código ou nome..."
              aria-label="Buscar condições de atendimento"
              [value]="termoBusca()"
              (input)="termoBusca.set(inputValue($event))"
            />
          </div>
          <button
            type="button"
            class="btn btn--tertiary btn--sm btn--rect"
            (click)="limparFiltroBusca()"
          >
            Limpar
          </button>
        </div>
      </div>

      <section class="panel" aria-labelledby="cfg-unidades-list-title">
        <div class="panel-head">
          <div class="panel-head__title">
            <h2 id="cfg-unidades-list-title">Condições de atendimento</h2>
            <span class="list-count" aria-label="Total de condições carregadas">
              {{ condicoesFiltradas().length }}
            </span>
          </div>
          <button type="button" class="btn btn--primary" (click)="abrirDrawerCriacao()">
            <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
            Nova condição
          </button>
        </div>

        @if (condicoesFiltradas().length > 0) {
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Nome</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span class="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (condicao of condicoesFiltradas(); track condicao.id) {
                  <tr>
                    <td data-label="Código">
                      <code>{{ condicao.codigo }}</code>
                    </td>
                    <td data-label="Nome">
                      <div class="table-responsive__primary">
                        {{ condicao.nome }}
                      </div>
                      <div class="table-responsive__meta">
                        {{ condicao.descricao }}
                      </div>
                    </td>
                    <td data-label="Status">
                      <ui-tag variant="success">Ativa</ui-tag>
                      @if (condicao.codigo === 'PCD') {
                        {{ ' ' }}
                        <ui-tag
                          variant="warning"
                          title="Código reservado — não pode ser renomeado nem inativado"
                        >
                          Protegido
                        </ui-tag>
                      }
                    </td>
                    <td class="table-responsive__actions" data-label="Ações">
                      <button
                        type="button"
                        class="btn btn--tertiary btn--sm btn--rect"
                        [disabled]="loading() || submitting()"
                        (click)="abrirEdicao(condicao)"
                      >
                        Editar
                      </button>
                      <button
                          type="button"
                          class="btn btn--tertiary btn--sm btn--rect"
                          [disabled]="loading() || submitting() || condicao.codigo === 'PCD'"
                          [aria-disabled]="loading() || submitting() || condicao.codigo === 'PCD'"
                          [title]="condicao.codigo === 'PCD' ? 'A condição PCD não pode ser inativada.' : ''"
                          (click)="abrirInativarCondicao(condicao)"
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
              heading="Nenhuma condição de atendimento encontrada"
              description="Ajuste a busca para ver resultados."
            >
              <button type="button" class="btn btn--secondary" (click)="limparFiltros()">
                Limpar filtros
              </button>
            </ui-empty-state>
          } @else {
            <ui-empty-state
              heading="Nenhuma condição de atendimento carregada"
              description="Cadastre uma condição para iniciar a estrutura institucional."
            >
              <button type="button" class="btn btn--primary" (click)="abrirDrawerCriacao()">
                Nova condição
              </button>
            </ui-empty-state>
          }
        }

        @if (prevCursor() !== null || nextCursor() !== null) {
          <ui-pager
            statusText="Navegação por páginas"
            navigationLabel="Paginação das condições de atendimento"
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
      ariaLabel="Formulário da condição de atendimento"
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
            <label class="field field--full" [class.is-error]="erroDoCampo('codigo')">
              <span class="field__label is-required">Código</span>
              <input
                class="input"
                type="text"
                style="text-transform: uppercase;"
                inputmode="text"
                placeholder="Ex.: DISLEXIA"
                formControlName="codigo"
                [attr.aria-invalid]="erroDoCampo('codigo') ? 'true' : null"
                [aria-label]="form.controls['codigo']?.value === 'PCD' ? 'Código reservado' : null"
              />
              <span class="field__hint"
                >Caixa alta, iniciando por letra; letras, números e sublinhado (^[A-Z][A-Z0-9_]+$).
                Único entre as condições ativas. Editável, exceto o código PCD (reservado).
              </span>
              @if (erroDoCampo('codigo')) {
                <span class="field__error">{{ erroDoCampo('codigo') }}</span>
              }
            </label>

            <label class="field field--full" [class.is-error]="erroDoCampo('nome')">
              <span class="field__label is-required">Nome</span>
              <input
                class="input"
                type="text"
                placeholder="Ex.: Dislexia"
                formControlName="nome"
                [attr.aria-invalid]="erroDoCampo('nome') ? 'true' : null"
              />
              <span class="field__hint">
                Rótulo legível da condição, distinto do código curto.
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
                placeholder="Texto opcional — ex.: base legal ou observações da condição."
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
          {{ saving() ? 'Salvando...' : modo() === 'criar' ? 'Criar condição' : 'Salvar condição' }}
        </button>
      </div>
    </ui-drawer>

    <ui-dialog
      [(visible)]="confirmOpen"
      heading="Inativar condição de atendimento?"
      (closed)="confirmOpen.set(false)"
    >
      <p>
        Você está prestes a inativar a condição
        <strong>{{ condicaoParaInativar()?.nome }}/{{ condicaoParaInativar()?.codigo }}.</strong>
        A inativação impede novos editais de utilizá-lo, mas não altera ofertas já congeladas —
        a cópia por valor de cada processo permanece íntegra.
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
  host: { class: 'cfg-page' },
})
export class CondicoesAtendimentoListPage implements OnInit {
  protected readonly api = inject(CondicoesAtendimentoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  private readonly pagina = signal<PaginaProps>(undefined);
  private readonly lista = useApiResource<readonly CondicaoAtendimentoDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/condicoes-atendimento`,
    params: this.montarParams(),
    context: withVendorMime('condicao-atendimento', 1),
  }));
  protected readonly loading = this.lista.isLoading;
  private readonly cursores = linkedSignal<
    ApiResult<readonly CondicaoAtendimentoDto[]> | undefined,
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
  protected readonly condicoes = linkedSignal<
    ApiResult<readonly CondicaoAtendimentoDto[]> | undefined,
    readonly CondicaoAtendimentoDto[]
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
  protected readonly condicoesFiltradas = computed(() => {
    const termo = this.termoBusca().trim().toLocaleLowerCase('pt-BR');
    if (termo.length === 0) {
      return this.condicoes();
    }
    return this.condicoes().filter(
      (condicao) =>
        condicao.codigo.toLocaleLowerCase('pt-BR').includes(termo) ||
        condicao.nome.toLocaleLowerCase('pt-BR').includes(termo),
    );
  });
  readonly registros = signal<CondicaoAtendimentoDto[]>([]);
  readonly isLoading = signal(false);
  protected readonly errorMessage = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar condições de atendimento.' : null;
  });
  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  readonly drawerOpen = signal(false);
  readonly submitting = signal(false);
  readonly condicaoParaInativar = signal<CondicaoAtendimentoDto | null>(null);
  readonly confirmOpen = signal(false);
  protected readonly modo = signal<ModoFormulario>('criar');
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());
  protected readonly temFiltro = computed(() => this.termoBusca().trim().length > 0);
  protected readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Nova condição de atendimento' : 'Editar condição de atendimento',
  );
  protected readonly inativarMensagem = computed(() => {
    return 'Você está prestes a inativar a condição ' +
    this.condicaoParaInativar()?.codigo +
    ' A inativação impede novos editais de utilizá-lo, mas não altera ofertas já congeladas — '+
    'a cópia por valor de cada processo permanece íntegra.'
  });
  readonly condicaoEmEdicaoId = signal<string | null>(null);
  protected readonly termoBusca = signal('');
  protected readonly form: FormGroup<CondicaoAtendimentoForm> =
    new FormGroup<CondicaoAtendimentoForm>({
      codigo: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(255),
          Validators.pattern('^[A-Z][A-Z0-9_]{1,49}$'),
        ],
      }),
      nome: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(2), Validators.maxLength(256)],
      }),
      descricao: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(1000)],
      }),
  });
  protected readonly formError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const problem = this.lista.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });
  }

  ngOnInit(): void {
    this.form.get('codigo')?.valueChanges.subscribe(val => {
      this.form.get('codigo')?.setValue(val.toUpperCase(), {
        emitEvent: false,
        emitModelToViewChange: false
      });
    });
  }

  abrirDrawerCriacao() {
    this.modo.set('criar');
    this.form.reset({
      codigo: '',
      nome: '',
      descricao: '',
    });
    this.form.controls.codigo.enable();
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  private atualizarCommand(): AtualizarCondicaoAtendimentoCommand {
    return { id: this.condicaoEmEdicaoId() ?? '', ...this.criarCommand() };
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
    if (!this.isLoading()) {
      this.carregar();
      this.lista.reload();
    }
  }

  private criarCommand(): CriarCondicaoAtendimentoCommand {
    const raw = this.form.getRawValue();
    return {
      codigo: raw.codigo,
      nome: raw.nome.trim(),
      descricao: nullIfBlank(raw.descricao),
    };
  }

  private recarregar(): void {
    if (this.pagina() === undefined) {
      this.lista.reload();
    } else {
      this.pagina.set(undefined);
    }
  }
  protected abrirEdicao(condicaoAtendimento: CondicaoAtendimentoDto): void {
    this.modo.set('editar');
    this.condicaoEmEdicaoId.set(condicaoAtendimento.id);
    this.form.reset({
      codigo: condicaoAtendimento.codigo,
      nome: condicaoAtendimento.nome,
      descricao: condicaoAtendimento.descricao ?? '',
    });
    this.form.controls.codigo.enable();
    if (this.form.controls.codigo.value === 'PCD') {
      this.form.controls.codigo.disable();
    }
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.drawerOpen.set(false);
    this.formOpen.set(true);
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

    // — esse array só existe no pipeline FluentValidation/422); mapeado ao
    // campo manualmente para exibir o erro inline exigido pelo CA-07.
    if (problem.code === CONDICAO_ATENDIMENTO_CODIGO_JA_EXISTE_CODE) {
      this.notifications.errorFromProblem(problem);
      this.renovarIdempotencyKey();
      this.form.controls.codigo.setErrors({
        backend: { code: problem.code, message: this.problemI18n.resolve(problem).title },
      });
      this.form.controls.codigo.markAsTouched();
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
          ? 'Condição de atendimento criada'
          : 'Condição de atendimento atualizada',
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
      this.formOpen.set(false);
      this.notifications.success('Condição de atendimento inativada');
      this.confirmOpen.set(false);
      this.condicaoParaInativar.set(null);
      this.recarregar();
      return;
    }
    this.aplicarFalha(result.problem);
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
        this.condicaoEmEdicaoId() ?? '',
        this.atualizarCommand(),
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result));
  }

  protected inputValue(event: Event): string {
    return event.target instanceof HTMLInputElement ? event.target.value : '';
  }

  limparFiltroBusca() {
    this.termoBusca.set('');
  }

  limparFiltros() {
    this.limparFiltroBusca();
  }

  protected erroDoCampo(nome: keyof CondicaoAtendimentoForm): string | null {
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
    if (control.errors['pattern'])
      return 'Formato inválido. Use letras maiúsculas, números e sublinhado, iniciando por letra (ex.: DISLEXIA, TDAH).';
    return 'Valor inválido.';
  }

  private carregar(): void {
    if (this.isLoading()) {
      return;
    }
    this.isLoading.set(true);

    let acumulado: CondicaoAtendimentoDto[] = [];
    let falhou: ProblemDetails | null = null;

    this.api
      .listar({ limit: PAGE_SIZE })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (!result.ok) {
            falhou ??= result.problem;
            return;
          }
          acumulado = [...acumulado, ...result.data];
        },
        complete: () => {
          this.isLoading.set(false);
          if (falhou !== null) {
            if (falhou.status >= 500) {
              this.notifications.errorFromProblem(falhou);
            }
            return;
          }
          this.registros.set(acumulado);
        },
      });
  }

  protected inativarConfirmado(): void {
    const condicao = this.condicaoParaInativar();
    if (condicao === null || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.api
      .remover(condicao.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleRemoverResult(result));
  }

  abrirInativarCondicao(condicao: CondicaoAtendimentoDto): void {
    this.condicaoParaInativar.set(condicao);
    this.confirmOpen.set(true);
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
}
