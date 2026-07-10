import { HttpParams } from "@angular/common/http";
import { Component, computed, DestroyRef, effect, inject, linkedSignal, signal, untracked } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";

import { ApiResult, Cursor, cursorToString, extractNextCursor, extractPrevCursor, idempotencyKey, PaginationDirection, ProblemDetails, ProblemI18nService, ProblemValidationError, useApiResource, withIdempotencyKey, withVendorMime } from "@uniplus/shared-core/http";
import { NotificationService } from "@uniplus/shared-core/notifications";
import { AtualizarTipoDeficienciaCommand, CONFIGURACAO_BASE_PATH, CriarTipoDeficienciaCommand, TipoDeficienciaApi, TipoDeficienciaDto } from "@uniplus/shared-data/configuracao";
import { AlertComponent, SkeletonComponent, FilterChipsComponent, UiFilterChipOption, TagComponent, EmptyStateComponent, DrawerComponent, SpinnerComponent, DialogComponent, PagerComponent } from "@uniplus/shared-ui/components";

type ModoFormulario = "criar" | "editar";

interface TipoDeficienciaForm {
  nome: FormControl<string>;
  descricao: FormControl<string>;
}

type PaginaProps = {
 readonly cursor: Cursor;
 readonly direction: PaginationDirection
} | undefined;


export interface TipoDeficienciaOption {
  readonly value: string;
  readonly label: string;
}

export const TIPO_DEFICIENCIA_TIPO: readonly TipoDeficienciaOption[] = [
  { value: 'ATIVAS', label: 'Ativas' },
  { value: 'INATIVAS', label: 'Inativas' },
] as const;

/** Vendor code do DomainError `FaseCanonica.CodigoJaExiste` (uniplus-api, 409 Conflict). */
const TIPO_DEFICIENCIA_NOME_JA_EXISTE_CODE = 'uniplus.configuracao.tipo_deficiencia.nome_ja_existe';

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const TIPO_DEFICIENCIA_CONTROL_NAMES: ReadonlySet<string> = new Set<keyof TipoDeficienciaForm>([
  'nome',
  'descricao',
]);

function controlNameFromBackendField(field: string): keyof TipoDeficienciaForm | null {
  const normalized =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  const camelCase = normalized.charAt(0).toLocaleLowerCase('pt-BR') + normalized.slice(1);
  return TIPO_DEFICIENCIA_CONTROL_NAMES.has(camelCase) ? (camelCase as keyof TipoDeficienciaForm) : null;
}

/** Tamanho de página ao esgotar o cursor (ADR-0015/0026) — ver `carregar()`. */
const PAGE_SIZE = 100;

@Component({
  selector: 'cfg-tipos-deficiencia-list',
  imports: [AlertComponent, SkeletonComponent, FilterChipsComponent, TagComponent, EmptyStateComponent, EmptyStateComponent, DrawerComponent, SpinnerComponent, ReactiveFormsModule, DialogComponent, PagerComponent],
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Tipo de Deficiência</h1>
        <p class="page-header__desc">
          Tipos de deficiência reconhecidos —
          cadastro independente, identificado pelo nome · UNI-REQ-0012.
        </p>
      </div>
    </div>

    <ui-alert
      variant="info"
      heading="Cadastro independente"
      [dynamic]="false"
    >
      Aqui o tipo de deficiência é um cadastro <strong>simples e independente</strong> —
      não há vínculo com condições ou recursos. A regra de que um tipo de deficiência
      só é ofertado sob a condição <strong>PCD</strong> vale apenas no momento em que
      um processo seletivo oferta o atendimento (Módulo Seleção), não neste cadastro.
    </ui-alert>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar os tipos de deficiência">
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

    @if (loading() && registros().length === 0) {
      <ui-skeleton skeletonKind="card" blockSize="10rem" />
      <ui-skeleton skeletonKind="card" blockSize="10rem" />
    }

    <div data-scope class="cfg-unidades-scope">
      <div class="filter-bar" role="search" aria-label="Filtrar tipos de deficiência">
        <div class="filter-bar__row">
          <div class="input-group">
            <span class="input-group__addon" aria-hidden="true">
              <i class="pi pi-search"></i>
            </span>
            <input
              type="search"
              class="input"
              placeholder="Buscar por nome..."
              aria-label="Buscar tipos de deficiência"
              [value]="termoBusca()"
              (input)="termoBusca.set(inputValue($event))"
            />
          </div>
          <button
            type="button"
            class="btn btn--tertiary btn--sm btn--rect"
            (click)="limparFiltros()"
          >
            Limpar
          </button>
        </div>
        <div class="filter-bar__group">
          <span class="u-eyebrow">Tipo</span>
          <ui-filter-chips
            [options]="tipoChips()"
            [selected]="tipoFiltro()"
            (selectedChange)="tipoFiltro.set($event ?? '')"
            ariaLabel="Filtrar por tipo"
          />
        </div>
      </div>

      <section class="panel" aria-labelledby="cfg-unidades-list-title">
        <div class="panel-head">
          <div class="panel-head__title">
            <h2 id="cfg-unidades-list-title">Tipos de deficiência</h2>
            <span class="list-count" aria-label="Total de tipos de deficiências carregadas">
              {{ tiposDeficienciaFiltrados().length }}
            </span>
          </div>
          <button type="button" class="btn btn--primary" (click)="abrirDrawerCriacao()">
            <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
            Novo tipo
          </button>
        </div>

        @if (registros().length > 0) {
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
                @for (registro of tiposDeficienciaFiltrados(); track registro) {
                  <tr>
                    <td data-label="Nome">
                      <div class="table-responsive__primary">
                        {{ registro.nome }}
                      </div>
                    </td>
                    <td data-label="Descrição">
                      {{ registro.descricao }}
                    </td>
                    <td data-label="Status">
                      <ui-tag variant="success">Ativa</ui-tag>
                    </td>
                    <td class="table-responsive__actions" data-label="Ações">
                      <button
                        type="button"
                        class="btn btn--tertiary btn--sm btn--rect"
                        [disabled]="loading() || submitting()"
                        (click)="abrirEdicao(registro)"
                      >
                        Editar
                      </button>
                        <button
                          type="button"
                          class="btn btn--tertiary btn--sm btn--rect"
                          [disabled]="loading()"
                          [disabled]="submitting()"
                          (click)="abrirInativarTipoDeficiencia(registro)"
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
              heading="Nenhum tipo de deficiência encontrado"
              description="Ajuste a busca ou o filtro de tipo para ver resultados."
            >
              <button type="button" class="btn btn--secondary" (click)="limparFiltros()">
                Limpar filtros
              </button>
            </ui-empty-state>
          } @else {
            <ui-empty-state
              heading="Nenhum tipo de deficiência carregado"
              description="Cadastre um tipo de deficiência para iniciar a estrutura institucional."
            >
              <button type="button" class="btn btn--primary" (click)="abrirDrawerCriacao()">
                Novo tipo
              </button>
            </ui-empty-state>
          }
        }
        @if (prevCursor() !== null || nextCursor() !== null) {
          <ui-pager
            statusText="Navegação por páginas"
            navigationLabel="Paginação de tipo de deficiência"
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
      ariaLabel="Formulário do tipo de deficiência"
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
                placeholder="Ex.: Visual"
                formControlName="nome"
                [attr.aria-invalid]="erroDoCampo('nome') ? 'true' : null"
              />
              <span class="field__hint">
                Identificador do tipo de deficiência —
                único entre os tipos ativos. Impede duplicatas como dois "Visual".
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
                placeholder="Texto opcional — ex.: abrangência ou base legal (TEA: Lei 12.764/2012)."
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
          {{ saving() ? 'Salvando...' : modo() === 'criar' ? 'Criar tipo' : 'Salvar tipo' }}
        </button>
      </div>
    </ui-drawer>
    <ui-dialog
      [(visible)]="confirmOpen"
      heading="Inativar tipo de deficiência?"
      (closed)="confirmOpen.set(false)"
    >
      <p>
        Você está prestes a inativar o tipo de deficiência <strong>{{ tipoDeficienciaParaInativar()?.nome }}.</strong>
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
export class TiposDeficienciaListPage {
  private readonly api = inject(TipoDeficienciaApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  private readonly pagina = signal<PaginaProps>(undefined);
  private readonly lista = useApiResource<readonly TipoDeficienciaDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/tipos-deficiencia`,
    params: this.montarParams(),
    context: withVendorMime('tipo-deficiencia', 1),
  }));
  protected readonly termoBusca = signal('');
  protected readonly loading = this.lista.isLoading;
  private readonly cursores = linkedSignal<
    ApiResult<readonly TipoDeficienciaDto[]> | undefined,
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
  protected readonly tiposDeficiencia = linkedSignal<
      ApiResult<readonly TipoDeficienciaDto[]> | undefined,
      readonly TipoDeficienciaDto[]
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
  protected readonly tiposDeficienciaFiltrados = computed(() => {
    const termo = this.termoBusca().trim().toLocaleLowerCase('pt-BR');
    if (termo.length === 0) {
      return this.tiposDeficiencia();
    }
    return this.tiposDeficiencia().filter(
      (tiposDeficiencia) => tiposDeficiencia.nome.toLocaleLowerCase('pt-BR').includes(termo),
    );
  });
  protected readonly tipoChips = computed<readonly UiFilterChipOption[]>(() => ([
    { value: '', label: 'Todas', count: this.tiposDeficiencia().length },
    ...TIPO_DEFICIENCIA_TIPO.map((tipoDefiencia) => ({
        value: tipoDefiencia.value,
        label: tipoDefiencia.label,
        count: 0,
      })),
  ]));
  protected readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Novo tipo de deficiência' : 'Editar tipo de deficiência',
  );
  readonly errorMessage = signal<string | null>(null);
  readonly isLoading = signal(false);
  readonly modo = signal<ModoFormulario>('criar');
  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  readonly drawerOpen = signal(false);
  readonly editTarget = signal<unknown | null>(null);
  readonly submitting = signal(false);
  readonly tipoDeficienciaParaInativar = signal<TipoDeficienciaDto | null>(null);
  readonly confirmOpen = signal(false);
  readonly form = new FormGroup<TipoDeficienciaForm>({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(255)]
    }),
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(255)]
    }),
  });
  protected readonly formError = signal<string | null>(null);
  readonly tipoDeficienciaEmEdicaoId = signal<string | null>(null);
  protected readonly tipoFiltro = signal('');
  readonly temFiltro = signal(false);
  readonly registros = signal<TipoDeficienciaDto[]>([]);
  protected readonly busca = signal('');

  constructor() {
    this.carregar();
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

  carregar(): void {
    if (this.isLoading()) {
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set(null);

    let acumulado: TipoDeficienciaDto[] = [];
    let falhou: ProblemDetails | null = null;
    //let paginas = 0;

    this.api
      .listar({ limit: PAGE_SIZE })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
      )
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
            this.errorMessage.set(this.problemI18n.resolve(falhou).title);
            if (falhou.status >= 500) {
              this.notifications.errorFromProblem(falhou);
            }
            return;
          }
          this.registros.set(acumulado);
        },
      });
  }

  tentarNovamente(): void {
    if (!this.isLoading()) {
      this.carregar();
    }
  }

  protected inputValue(event: Event): string {
    return event.target instanceof HTMLInputElement ? event.target.value : '';
  }

  limparFiltroBusca(): void {
    this.termoBusca.set('');
  }

  limparFiltros(): void {
    this.limparFiltroBusca();
    this.tipoFiltro.set('');
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

  protected abrirEdicao(tipoDeficiencia: TipoDeficienciaDto): void {this.modo.set('editar');
    this.tipoDeficienciaEmEdicaoId.set(tipoDeficiencia.id);
    this.form.reset({
      nome: tipoDeficiencia.nome,
      descricao: tipoDeficiencia.descricao ?? ''
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.drawerOpen.set(false);
    this.formOpen.set(true);
  }

  abrirInativarTipoDeficiencia(tipoDeficiencia: TipoDeficienciaDto): void {
    this.tipoDeficienciaParaInativar.set(tipoDeficiencia);
    this.confirmOpen.set(true);
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
        this.tipoDeficienciaEmEdicaoId() ?? '',
        this.atualizarCommand(),
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result));
  }

  private atualizarCommand(): AtualizarTipoDeficienciaCommand {
    return { id: this.tipoDeficienciaEmEdicaoId() ?? '', ...this.criarCommand() };
  }

  protected erroDoCampo(nome: keyof TipoDeficienciaForm): string | null {
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
    if (control.errors['minlength']) return 'Informe ao menos 2 caracteres.';
    if (control.errors['maxlength']) return 'Valor acima do tamanho permitido.';
    return 'Valor inválido.';
  }

  private recarregar(): void {
    if (this.pagina() === undefined) {
      this.lista.reload();
    } else {
      this.pagina.set(undefined);
    }
  }

  private criarCommand(): CriarTipoDeficienciaCommand {
    const raw = this.form.getRawValue();
    return {
      nome: raw.nome.trim(),
      descricao: nullIfBlank(raw.descricao),
    };
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
      this.renovarIdempotencyKey();
      this.aplicarErrosDeValidacao(problem.errors);
      return;
    }

    if (problem.code === TIPO_DEFICIENCIA_NOME_JA_EXISTE_CODE) {
      this.renovarIdempotencyKey();
      this.form.controls.nome.setErrors({
        backend: { code: problem.code, message: this.problemI18n.resolve(problem).title },
      });
      this.form.controls.nome.markAsTouched();
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

  private handleSalvarResult(result: ApiResult<string | void>): void {
    this.saving.set(false);
    if (result.ok) {
      this.notifications.success(
        this.modo() === 'criar'
        ? 'Tipo de deficiência criado'
        : 'Tipo de deficiência atualizado',
      );
      this.formOpen.set(false);
      this.idempotencyKeyAtual.set(idempotencyKey.create());
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
    const tipoDeficiencia = this.tipoDeficienciaParaInativar();
    if (tipoDeficiencia === null || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.notifications.success('Tipo de deficiência inativado');
    this.confirmOpen.set(false);
    this.tipoDeficienciaParaInativar.set(null);
    this.recarregar();
    this.saving.set(false);
  }
}
