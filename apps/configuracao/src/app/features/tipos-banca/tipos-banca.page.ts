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
  API_MAX_PAGE_SIZE,
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
  lookupCompleto,
  useApiResource,
  withIdempotencyKey,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CODIGOS_TIPO_BANCA,
  CONFIGURACAO_BASE_PATH,
  FasesCanonicasApi,
  TipoBancaDto,
  TiposBancaApi,
  type AtualizarTipoBancaCommand,
  type CriarTipoBancaCommand,
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

/** Tamanho da janela de cada página (cursor pagination, ADR-0026). */
const PAGE_SIZE = 50;

/** Vendor code do DomainError `TipoBanca.CodigoJaExiste` (uniplus-api, 409 Conflict). */
const TIPO_BANCA_CODIGO_JA_EXISTE_CODE = 'uniplus.configuracao.tipo_banca.codigo_ja_existe';

type ModoFormulario = 'criar' | 'editar';

interface BancaForm {
  codigo: FormControl<string>;
  nome: FormControl<string>;
  faseTipica: FormControl<string>;
  descricao: FormControl<string>;
}

const BANCA_CONTROL_NAMES: ReadonlySet<string> = new Set<keyof BancaForm>([
  'codigo',
  'nome',
  'faseTipica',
  'descricao',
]);

@Component({
  selector: 'cfg-tipos-banca-page',
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
        <h1 class="page-header__title">Tipo de Banca</h1>
        <p class="page-header__desc">
          Vocabulário de cronograma — categorias de banca que atuam ao longo do processo seletivo ·
          UNI-REQ-0064.
        </p>
      </div>
    </div>

    <ui-alert variant="warning" heading="Código imutável após criação" [dynamic]="false">
      O código de uma fase canônica ou de um tipo de banca não pode ser alterado após a criação —
      pertence ao vocabulário canônico fixo e é congelado por snapshot nos cronogramas dos editais.
      Para corrigir, crie uma nova entrada e inative a anterior.
    </ui-alert>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar os tipos de banca">
        {{ errorMessage() }}
        <div class="cfg-tipos-banca__retry">
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

    <section class="panel" aria-labelledby="cfg-tipos-banca-list-title">
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 id="cfg-tipos-banca-list-title">Tipos de banca</h2>
          @if (loading()) {
            <span class="cfg-tipos-banca__loading"><ui-spinner size="sm" /> Carregando</span>
          }
        </div>
        <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
          <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
          Novo tipo de banca
        </button>
      </div>

      <ui-filter-bar
        ariaLabel="Filtrar tipos de banca"
        searchPlaceholder="Buscar por código ou nome…"
        searchAriaLabel="Buscar tipos de banca"
        [(searchValue)]="termoBusca"
      />

      @if (bancasFiltradas().length > 0) {
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Nome</th>
                <th scope="col">Fase típica</th>
                <th scope="col"><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              @for (banca of bancasFiltradas(); track banca.id) {
                <tr>
                  <td data-label="Código">
                    <code>{{ banca.codigo }}</code>
                  </td>
                  <td data-label="Nome">{{ banca.nome }}</td>
                  <td data-label="Fase típica">{{ banca.faseTipica || '—' }}</td>
                  <td class="table-responsive__actions" data-label="Ações">
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm btn--rect"
                      [disabled]="loading()"
                      (click)="abrirEdicao(banca)"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm btn--rect"
                      [disabled]="loading()"
                      (click)="pedirRemocao(banca)"
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
            heading="Nenhum tipo de banca encontrado"
            description="Ajuste a busca para ver resultados."
          >
            <button type="button" class="btn btn--secondary" (click)="limparFiltros()">
              Limpar filtros
            </button>
          </ui-empty-state>
        } @else {
          <ui-empty-state
            heading="Nenhum tipo de banca cadastrado"
            description="Cadastre o primeiro tipo de banca para montar o cronograma de processos seletivos."
          >
            <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
              Novo tipo de banca
            </button>
          </ui-empty-state>
        }
      }

      @if (prevCursor() !== null || nextCursor() !== null) {
        <ui-pager
          statusText="Navegação por páginas"
          navigationLabel="Paginação de tipos de banca"
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
      ariaLabel="Formulário de tipo de banca"
      position="right"
    >
      @if (formError()) {
        <ui-alert variant="danger" heading="Não foi possível salvar">{{ formError() }}</ui-alert>
      }

      <form
        [formGroup]="form"
        id="cfg-tipo-banca-form"
        (ngSubmit)="salvar()"
        novalidate
        class="cfg-form"
      >
        <section aria-labelledby="cfg-banca-identificacao">
          <h3 id="cfg-banca-identificacao" class="form-section__title">Identificação</h3>
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
                  @for (codigo of codigosBanca; track codigo) {
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
              <span class="field__label">Fase típica</span>
              <input
                class="input"
                type="text"
                formControlName="faseTipica"
                list="cfg-fase-tipica-sugestoes"
              />
              <datalist id="cfg-fase-tipica-sugestoes">
                @for (nome of sugestoesFaseTipica(); track nome) {
                  <option [value]="nome"></option>
                }
              </datalist>
              <span class="field__hint">
                Fase em que a banca usualmente atua — rótulo orientativo, não é vínculo com o
                cadastro de fases. Aceita qualquer texto.
              </span>
            </label>
            <label class="field">
              <span class="field__label">Descrição</span>
              <textarea class="textarea" formControlName="descricao"></textarea>
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
          form="cfg-tipo-banca-form"
          class="btn btn--primary"
          [disabled]="saving()"
        >
          @if (saving()) {
            <ui-spinner size="sm" />
          }
          {{
            saving()
              ? 'Salvando...'
              : modo() === 'criar'
                ? 'Criar tipo de banca'
                : 'Salvar tipo de banca'
          }}
        </button>
      </div>
    </ui-drawer>

    <ui-confirm-dialog
      [(visible)]="confirmOpen"
      heading="Inativar tipo de banca"
      [message]="confirmMessage()"
      confirmLabel="Inativar"
      confirmVariant="danger"
      (confirmed)="removerConfirmado()"
    />
  `,
  host: { class: 'cfg-page' },
})
export class TiposBancaPage {
  private readonly api = inject(TiposBancaApi);
  private readonly fasesApi = inject(FasesCanonicasApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  protected readonly codigosBanca = CODIGOS_TIPO_BANCA;

  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly modo = signal<ModoFormulario>('criar');
  protected readonly bancaEmEdicaoId = signal<string | null>(null);
  protected readonly bancaParaRemover = signal<TipoBancaDto | null>(null);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());
  protected readonly termoBusca = signal('');

  private readonly pagina = signal<
    { readonly cursor: Cursor; readonly direction: PaginationDirection } | undefined
  >(undefined);

  private readonly lista = useApiResource<readonly TipoBancaDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/tipos-banca`,
    params: this.montarParams(),
    context: withVendorMime('tipo-banca', 1),
  }));

  protected readonly loading = this.lista.isLoading;

  private readonly cursores = linkedSignal<
    ApiResult<readonly TipoBancaDto[]> | undefined,
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

  protected readonly bancas = linkedSignal<
    ApiResult<readonly TipoBancaDto[]> | undefined,
    readonly TipoBancaDto[]
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

  // Busca client-side sobre a página carregada: o backend (api#592) só pagina
  // por cursor, sem filtro de texto no contrato.
  protected readonly bancasFiltradas = computed(() => {
    const termo = this.termoBusca().trim().toLocaleLowerCase('pt-BR');
    if (termo.length === 0) {
      return this.bancas();
    }
    return this.bancas().filter(
      (banca) =>
        banca.codigo.toLocaleLowerCase('pt-BR').includes(termo) ||
        banca.nome.toLocaleLowerCase('pt-BR').includes(termo),
    );
  });

  protected readonly temFiltro = computed(() => this.termoBusca().trim().length > 0);

  protected readonly errorMessage = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar tipos de banca.' : null;
  });

  protected readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Novo tipo de banca' : 'Editar tipo de banca',
  );

  protected readonly confirmMessage = computed(() => {
    const banca = this.bancaParaRemover();
    return banca
      ? `Deseja inativar o tipo de banca ${banca.codigo}? A inativação impede novos editais de requerer esta banca, mas não altera bancas já congeladas — a cópia por valor permanece íntegra.`
      : 'Deseja inativar este tipo de banca?';
  });

  // Sugestões de "Fase típica" — carregadas lazy na primeira abertura do
  // formulário (sem custo enquanto o drawer nunca abre). Campo texto livre
  // sem FK (UNI-REQ-0064): a lista só alimenta o `datalist`, não valida.
  // Percorre todas as páginas por cursor: o catálogo de fases canônicas cresce
  // por cadastro, e uma sugestão que some é indistinguível de "não existe".
  private readonly fasesCanonicas = lookupCompleto(
    (cursor) => this.fasesApi.listar({ cursor, direction: 'next', limit: API_MAX_PAGE_SIZE }),
    this.destroyRef,
  );
  protected readonly sugestoesFaseTipica = computed(() =>
    this.fasesCanonicas.opcoes().map((fase) => fase.nome),
  );

  protected readonly form: FormGroup<BancaForm> = new FormGroup<BancaForm>({
    codigo: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(255)],
    }),
    faseTipica: new FormControl('', { nonNullable: true }),
    descricao: new FormControl('', { nonNullable: true }),
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

  protected tentarNovamente(): void {
    if (!this.loading()) {
      this.lista.reload();
    }
  }

  protected limparFiltros(): void {
    this.termoBusca.set('');
  }

  protected abrirCadastro(): void {
    this.modo.set('criar');
    this.bancaEmEdicaoId.set(null);
    this.form.reset({ codigo: '', nome: '', faseTipica: '', descricao: '' });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.prepararSugestoesFaseTipica();
    this.formOpen.set(true);
  }

  protected abrirEdicao(banca: TipoBancaDto): void {
    this.modo.set('editar');
    this.bancaEmEdicaoId.set(banca.id);
    this.form.reset({
      codigo: banca.codigo,
      nome: banca.nome,
      faseTipica: banca.faseTipica ?? '',
      descricao: banca.descricao ?? '',
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.prepararSugestoesFaseTipica();
    this.formOpen.set(true);
  }

  protected pedirRemocao(banca: TipoBancaDto): void {
    this.bancaParaRemover.set(banca);
    this.confirmOpen.set(true);
  }

  protected removerConfirmado(): void {
    const banca = this.bancaParaRemover();
    if (banca === null || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.api
      .remover(banca.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.saving.set(false);
        if (result.ok) {
          this.notifications.success('Tipo de banca inativado', banca.codigo);
          this.confirmOpen.set(false);
          this.bancaParaRemover.set(null);
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
        this.bancaEmEdicaoId() ?? '',
        this.atualizarCommand(),
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result));
  }

  protected erroDoCampo(nome: keyof BancaForm): string | null {
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

  private prepararSugestoesFaseTipica(): void {
    this.fasesCanonicas.recarregar();
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
        this.modo() === 'criar' ? 'Tipo de banca criado' : 'Tipo de banca atualizado',
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
    // TipoBanca.CodigoJaExiste é um DomainError único (409, sem `errors[]` —
    // esse array só existe no pipeline FluentValidation/422); mapeado ao
    // campo manualmente para exibir o erro inline.
    if (problem.code === TIPO_BANCA_CODIGO_JA_EXISTE_CODE) {
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

  private criarCommand(): CriarTipoBancaCommand {
    const raw = this.form.getRawValue();
    return {
      codigo: raw.codigo,
      nome: raw.nome.trim(),
      faseTipica: nullIfBlank(raw.faseTipica),
      descricao: nullIfBlank(raw.descricao),
    };
  }

  private atualizarCommand(): AtualizarTipoBancaCommand {
    const raw = this.form.getRawValue();
    return {
      id: this.bancaEmEdicaoId() ?? '',
      nome: raw.nome.trim(),
      faseTipica: nullIfBlank(raw.faseTipica),
      descricao: nullIfBlank(raw.descricao),
    };
  }
}

function controlNameFromBackendField(field: string): keyof BancaForm | null {
  const normalized =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  const camelCase = normalized.charAt(0).toLocaleLowerCase('pt-BR') + normalized.slice(1);
  return BANCA_CONTROL_NAMES.has(camelCase) ? (camelCase as keyof BancaForm) : null;
}

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
