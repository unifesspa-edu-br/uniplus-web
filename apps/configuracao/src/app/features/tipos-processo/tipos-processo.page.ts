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
  CONFIGURACAO_BASE_PATH,
  TipoProcessoDto,
  TiposProcessoApi,
  type AtualizarTipoProcessoCommand,
  type CriarTipoProcessoCommand,
} from '@uniplus/shared-data/configuracao';
import {
  CODIGO_CADASTRO_FORMATO,
  CODIGO_CADASTRO_TAMANHO_MAXIMO,
  sugerirCodigoDeCadastro,
} from '@uniplus/shared-utils';
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

/** Limites de tamanho dos campos editáveis (Domain `TipoProcesso`, uniplus-api). */
const NOME_MAX_LENGTH = 200;
const DESCRICAO_MAX_LENGTH = 1000;

/** Vendor code do DomainError `TipoProcesso.CodigoJaExiste` (uniplus-api, 409 Conflict). */
const TIPO_PROCESSO_CODIGO_JA_EXISTE_CODE = 'uniplus.configuracao.tipo_processo.codigo_ja_existe';

type ModoFormulario = 'criar' | 'editar';

interface TipoProcessoForm {
  codigo: FormControl<string>;
  nome: FormControl<string>;
  descricao: FormControl<string>;
}

@Component({
  selector: 'cfg-tipos-processo-page',
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
        <h1 class="page-header__title">Tipo de Processo Seletivo</h1>
        <p class="page-header__desc">
          Cadastro institucional dos tipos de processo seletivo (SiSU, ENEM, vestibular, ...) —
          código, nome e descrição. Alimenta o passo de tipo do wizard de Processo Seletivo no
          módulo Seleção. UNI-REQ-0098.
        </p>
      </div>
    </div>

    <ui-alert variant="warning" heading="Código imutável após criação" [dynamic]="false">
      O código é a chave natural do tipo de processo — definido só na criação e exibido como
      somente leitura na edição. Desativar um tipo não libera o código: um novo cadastro com o
      mesmo código continua sendo recusado.
    </ui-alert>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar os tipos de processo">
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

    <section class="panel" aria-labelledby="cfg-tipos-processo-list-title">
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 id="cfg-tipos-processo-list-title">Tipos de processo</h2>
          @if (loading()) {
            <span class="cfg-list__loading"><ui-spinner size="sm" /> Carregando</span>
          }
        </div>
        <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
          <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
          Novo tipo de processo
        </button>
      </div>

      <ui-filter-bar
        ariaLabel="Filtrar tipos de processo"
        searchPlaceholder="Buscar por código ou nome…"
        searchAriaLabel="Buscar tipos de processo"
        [(searchValue)]="termoBusca"
      />

      @if (tiposFiltrados().length > 0) {
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Nome</th>
                <th scope="col">Descrição</th>
                <th scope="col"><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              @for (tipo of tiposFiltrados(); track tipo.id) {
                <tr>
                  <td data-label="Código">
                    <code>{{ tipo.codigo }}</code>
                  </td>
                  <td data-label="Nome">{{ tipo.nome }}</td>
                  <td data-label="Descrição" class="u-caption">{{ tipo.descricao || '—' }}</td>
                  <td class="table-responsive__actions" data-label="Ações">
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm btn--rect"
                      [disabled]="loading()"
                      (click)="abrirEdicao(tipo)"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm btn--rect"
                      [disabled]="loading()"
                      (click)="pedirRemocao(tipo)"
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
            heading="Nenhum tipo de processo encontrado"
            description="Ajuste a busca para ver resultados."
          >
            <button type="button" class="btn btn--secondary" (click)="limparFiltros()">
              Limpar filtros
            </button>
          </ui-empty-state>
        } @else {
          <ui-empty-state
            heading="Nenhum tipo de processo cadastrado"
            description="Cadastre o primeiro tipo de processo para disponibilizá-lo na criação de Processos Seletivos."
          >
            <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
              Novo tipo de processo
            </button>
          </ui-empty-state>
        }
      }

      @if (prevCursor() !== null || nextCursor() !== null) {
        <ui-pager
          statusText="Navegação por páginas"
          navigationLabel="Paginação de tipos de processo"
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
      ariaLabel="Formulário de tipo de processo"
      position="right"
    >
      @if (formError()) {
        <ui-alert variant="danger" heading="Não foi possível salvar">{{ formError() }}</ui-alert>
      }

      <form
        [formGroup]="form"
        id="cfg-tipo-processo-form"
        (ngSubmit)="salvar()"
        novalidate
        class="cfg-form"
      >
        <section aria-labelledby="cfg-tipo-processo-identificacao">
          <h3 id="cfg-tipo-processo-identificacao" class="form-section__title">Identificação</h3>
          <div class="form-grid form-grid--1col">
            @let erroCampoCodigo = erroDoCampo('codigo');
            <label class="field" [class.is-error]="erroCampoCodigo">
              <span class="field__label is-required">Código</span>
              <input
                class="input cfg-input-uppercase"
                type="text"
                placeholder="Ex.: SISU"
                formControlName="codigo"
                [readonly]="modo() === 'editar'"
                [attr.aria-invalid]="erroCampoCodigo ? 'true' : null"
                [attr.aria-describedby]="
                  erroCampoCodigo ? 'cfg-tproc-codigo-dica cfg-tproc-codigo-erro' : 'cfg-tproc-codigo-dica'
                "
              />
              <span class="field__hint" id="cfg-tproc-codigo-dica">
                @if (modo() === 'criar') {
                  Chave natural do cadastro: caixa alta, começando por letra, com letras, números e
                  sublinhado. Imutável após a criação e não reutilizável — sugerido a partir do nome
                  e editável antes de salvar.
                } @else {
                  Imutável após a criação. Para corrigir, inative este tipo e cadastre outro.
                }
              </span>
              @if (erroCampoCodigo) {
                <span class="field__error" id="cfg-tproc-codigo-erro">{{ erroCampoCodigo }}</span>
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

            <label class="field" [class.is-error]="erroDoCampo('descricao')">
              <span class="field__label">Descrição</span>
              <textarea class="textarea" rows="3" formControlName="descricao"></textarea>
              <span class="field__hint">
                Texto orientativo exibido ao operador ao escolher o tipo de um Processo Seletivo.
              </span>
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
          form="cfg-tipo-processo-form"
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
                ? 'Criar tipo de processo'
                : 'Salvar tipo de processo'
          }}
        </button>
      </div>
    </ui-drawer>

    <ui-confirm-dialog
      [(visible)]="confirmOpen"
      heading="Inativar tipo de processo"
      [message]="confirmMessage()"
      confirmLabel="Inativar"
      confirmVariant="danger"
      (confirmed)="removerConfirmado()"
    />
  `,
  host: { class: 'cfg-page' },
})
export class TiposProcessoPage {
  private readonly api = inject(TiposProcessoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly confirmError = signal<string | null>(null);
  protected readonly modo = signal<ModoFormulario>('criar');
  protected readonly tipoEmEdicaoId = signal<string | null>(null);
  protected readonly tipoParaRemover = signal<TipoProcessoDto | null>(null);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());
  protected readonly termoBusca = signal('');

  /** Último código escrito pela sugestão — distingue o que ela pôs do que o operador digitou. */
  private ultimaSugestaoAplicada = '';

  private readonly pagina = signal<
    { readonly cursor: Cursor; readonly direction: PaginationDirection } | undefined
  >(undefined);

  private readonly lista = useApiResource<readonly TipoProcessoDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/tipos-processo`,
    params: this.montarParams(),
    context: withVendorMime('tipo-processo', 1),
  }));

  protected readonly loading = this.lista.isLoading;

  private readonly cursores = linkedSignal<
    ApiResult<readonly TipoProcessoDto[]> | undefined,
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

  protected readonly tipos = linkedSignal<
    ApiResult<readonly TipoProcessoDto[]> | undefined,
    readonly TipoProcessoDto[]
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

  // Busca client-side sobre a página carregada: o contrato de listagem só
  // pagina por cursor, sem filtro de texto (uniplus-api UNI-REQ-0098).
  protected readonly tiposFiltrados = computed(() => {
    const termo = this.termoBusca().trim().toLocaleLowerCase('pt-BR');
    if (termo.length === 0) {
      return this.tipos();
    }
    return this.tipos().filter(
      (tipo) =>
        tipo.codigo.toLocaleLowerCase('pt-BR').includes(termo) ||
        tipo.nome.toLocaleLowerCase('pt-BR').includes(termo),
    );
  });

  protected readonly temFiltro = computed(() => this.termoBusca().trim().length > 0);

  protected readonly errorMessage = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar tipos de processo.' : null;
  });

  protected readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Novo tipo de processo' : 'Editar tipo de processo',
  );

  protected readonly confirmMessage = computed(() => {
    const erro = this.confirmError();
    if (erro !== null) {
      return erro;
    }
    const tipo = this.tipoParaRemover();
    return tipo
      ? `Deseja inativar o tipo de processo ${tipo.codigo}? Ele deixa de ser oferecido na criação ` +
          'de novos Processos Seletivos e sai desta lista. Processos já criados que o referenciam ' +
          'não são afetados. Um novo cadastro com o mesmo código continua sendo recusado.'
      : 'Deseja inativar este tipo de processo?';
  });

  protected readonly form: FormGroup<TipoProcessoForm> = new FormGroup<TipoProcessoForm>({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(CODIGO_CADASTRO_TAMANHO_MAXIMO),
        Validators.pattern(CODIGO_CADASTRO_FORMATO),
      ],
    }),
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(NOME_MAX_LENGTH)],
    }),
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(DESCRICAO_MAX_LENGTH)],
    }),
  });

  constructor() {
    this.form.controls.nome.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((nome) => this.sincronizarSugestaoDeCodigo(nome));

    this.form.controls.codigo.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((codigo) => this.normalizarCaixaDoCodigo(codigo));

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
    this.tipoEmEdicaoId.set(null);
    this.ultimaSugestaoAplicada = '';
    this.form.reset({ codigo: '', nome: '', descricao: '' });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  protected abrirEdicao(tipo: TipoProcessoDto): void {
    this.modo.set('editar');
    this.tipoEmEdicaoId.set(tipo.id);
    this.form.reset({
      codigo: tipo.codigo,
      nome: tipo.nome,
      descricao: tipo.descricao ?? '',
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  protected pedirRemocao(tipo: TipoProcessoDto): void {
    this.tipoParaRemover.set(tipo);
    this.confirmError.set(null);
    this.confirmOpen.set(true);
  }

  protected removerConfirmado(): void {
    const tipo = this.tipoParaRemover();
    if (tipo === null || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.api
      .remover(tipo.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.saving.set(false);
        if (result.ok) {
          this.notifications.success('Tipo de processo inativado', tipo.codigo);
          this.confirmOpen.set(false);
          this.tipoParaRemover.set(null);
          this.recarregar();
          return;
        }
        // O `ui-confirm-dialog` fecha a si mesmo de forma síncrona ao emitir
        // `confirmed` (antes desta resposta HTTP assíncrona chegar) — reabrir
        // explicitamente com a mensagem de erro mantém o fluxo visível. Cobre o
        // 422 `tipo_processo.ja_desativado`.
        const titulo = this.problemI18n.resolve(result.problem).title;
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
        this.tipoEmEdicaoId() ?? '',
        this.atualizarCommand(),
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result));
  }

  protected erroDoCampo(nome: keyof TipoProcessoForm): string | null {
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
    if (control.errors['pattern']) {
      return 'Use caixa alta, começando por letra, com letras, números e sublinhado.';
    }
    return 'Valor inválido.';
  }

  /**
   * Mantém a sugestão de código alinhada ao nome. O campo só é escrito na criação
   * e enquanto o que está nele é obra da própria sugestão — assim ela acompanha o
   * nome enquanto ele é digitado, mas para no instante em que o operador troca o
   * código por outro. Na edição nunca escreve: o código vigente é imutável.
   */
  private sincronizarSugestaoDeCodigo(nome: string): void {
    if (this.modo() !== 'criar') {
      return;
    }
    const codigoAtual = this.form.controls.codigo.value;
    if (codigoAtual !== '' && codigoAtual !== this.ultimaSugestaoAplicada) {
      return;
    }
    const sugestao = sugerirCodigoDeCadastro(nome);
    this.ultimaSugestaoAplicada = sugestao;
    this.form.controls.codigo.setValue(sugestao, { emitEvent: false });
  }

  /**
   * O backend recebe o código como digitado; a convenção do cadastro é caixa
   * alta. O modelo é normalizado sem reescrever a view (`emitModelToViewChange:
   * false`) para não reposicionar o cursor; a apresentação em caixa alta fica
   * por conta do `text-transform` do campo.
   */
  private normalizarCaixaDoCodigo(codigo: string): void {
    const emCaixaAlta = codigo.toLocaleUpperCase('pt-BR');
    if (emCaixaAlta === codigo) {
      return;
    }
    this.form.controls.codigo.setValue(emCaixaAlta, {
      emitEvent: false,
      emitModelToViewChange: false,
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
        this.modo() === 'criar' ? 'Tipo de processo criado' : 'Tipo de processo atualizado',
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
    // TipoProcesso.CodigoJaExiste é um DomainError único (409, sem `errors[]` —
    // esse array só existe no pipeline FluentValidation/422); mapeado ao campo
    // manualmente para exibir o erro inline exigido pelo critério de aceite.
    if (problem.code === TIPO_PROCESSO_CODIGO_JA_EXISTE_CODE) {
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

  private criarCommand(): CriarTipoProcessoCommand {
    const raw = this.form.getRawValue();
    return {
      codigo: raw.codigo.trim(),
      nome: raw.nome.trim(),
      descricao: nullIfBlank(raw.descricao),
    };
  }

  private atualizarCommand(): AtualizarTipoProcessoCommand {
    const raw = this.form.getRawValue();
    return {
      id: this.tipoEmEdicaoId() ?? '',
      nome: raw.nome.trim(),
      descricao: nullIfBlank(raw.descricao),
    };
  }
}

const TIPO_PROCESSO_CONTROL_NAMES: ReadonlySet<string> = new Set<keyof TipoProcessoForm>([
  'codigo',
  'nome',
  'descricao',
]);

function controlNameFromBackendField(field: string): keyof TipoProcessoForm | null {
  const normalized =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  const camelCase = normalized.charAt(0).toLocaleLowerCase('pt-BR') + normalized.slice(1);
  return TIPO_PROCESSO_CONTROL_NAMES.has(camelCase)
    ? (camelCase as keyof TipoProcessoForm)
    : null;
}

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
