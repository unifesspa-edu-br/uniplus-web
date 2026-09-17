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
  TipoEtapaDto,
  TiposEtapaApi,
  type AtualizarTipoEtapaCommand,
  type CriarTipoEtapaCommand,
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

/** Vendor code do DomainError `TipoEtapa.CodigoJaExiste` (409 Conflict). */
const TIPO_ETAPA_CODIGO_JA_EXISTE_CODE = 'uniplus.configuracao.tipo_etapa.codigo_ja_existe';

type ModoFormulario = 'criar' | 'editar';

interface EtapaForm {
  codigo: FormControl<string>;
  nome: FormControl<string>;
  admitePontuacao: FormControl<boolean>;
  admiteEliminacao: FormControl<boolean>;
  descricao: FormControl<string>;
}

const ETAPA_CONTROL_NAMES: ReadonlySet<string> = new Set<keyof EtapaForm>([
  'codigo',
  'nome',
  'admitePontuacao',
  'admiteEliminacao',
  'descricao',
]);

@Component({
  selector: 'cfg-tipos-etapa-page',
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
        <h1 class="page-header__title">Tipo de Etapa</h1>
        <p class="page-header__desc">
          Natureza das etapas que um processo seletivo pode ter, e o que cada uma delas pode fazer
          com a nota do candidato · UNI-REQ-0015.
        </p>
      </div>
    </div>

    <ui-alert variant="info" heading="O que o tipo declara" [dynamic]="false">
      Cada tipo diz se uma etapa daquela natureza pode <strong>compor a nota final</strong> — e,
      então, ter peso — e se pode <strong>eliminar candidato</strong> — e, então, ter nota mínima. É
      desse par que o formulário do edital tira quais caracteres oferecer: uma análise documental
      que não compõe nota deixa de pedir peso a quem monta o processo. O código é imutável após a
      criação, porque os editais já publicados o congelam por cópia.
    </ui-alert>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar os tipos de etapa">
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

    <section class="panel" aria-labelledby="cfg-tipos-etapa-list-title">
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 id="cfg-tipos-etapa-list-title">Tipos de etapa</h2>
          @if (loading()) {
            <span class="cfg-list__loading"><ui-spinner size="sm" /> Carregando</span>
          }
        </div>
        <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
          <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
          Novo tipo de etapa
        </button>
      </div>

      <ui-filter-bar
        ariaLabel="Filtrar tipos de etapa"
        searchPlaceholder="Buscar por código ou nome…"
        searchAriaLabel="Buscar tipos de etapa"
        [(searchValue)]="termoBusca"
      />

      @if (tiposFiltrados().length > 0) {
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Nome</th>
                <th scope="col">O que admite</th>
                <th scope="col">Situação</th>
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
                  <td data-label="O que admite">{{ resumoDoQueAdmite(tipo) }}</td>
                  <!--
                    O cadastro devolve ativos e inativos na mesma lista, e o inativo continua
                    sendo editável — o que ele não admite mais é processo novo. Sem dizer a
                    situação, a lista mostrava os dois iguais, e a ação de inativar seguia
                    oferecida para quem já estava inativo.
                  -->
                  <td data-label="Situação">
                    @if (tipo.ativo) {
                      <span class="tag tag--success">Ativo</span>
                    } @else {
                      <span class="tag">Inativo</span>
                    }
                  </td>
                  <td class="table-responsive__actions" data-label="Ações">
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm btn--rect"
                      [disabled]="loading() || saving()"
                      (click)="abrirEdicao(tipo)"
                    >
                      Editar
                    </button>
                    @if (tipo.ativo) {
                      <!--
                        Também desabilitado durante uma gravação em voo: o diálogo abriria, a
                        confirmação fecharia, e a inativação seria descartada em silêncio: a
                        remoção desiste enquanto há outra mutação correndo.
                      -->
                      <button
                        type="button"
                        class="btn btn--tertiary btn--sm btn--rect"
                        [disabled]="loading() || saving()"
                        (click)="pedirRemocao(tipo)"
                      >
                        Inativar
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (!loading() && !errorMessage()) {
        @if (temFiltro()) {
          <ui-empty-state
            heading="Nenhum tipo de etapa encontrado"
            description="Ajuste a busca para ver resultados."
          >
            <button type="button" class="btn btn--secondary" (click)="limparFiltros()">
              Limpar filtros
            </button>
          </ui-empty-state>
        } @else {
          <ui-empty-state
            heading="Nenhum tipo de etapa cadastrado"
            description="Cadastre o primeiro tipo de etapa para que os processos seletivos possam declarar etapas."
          >
            <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
              Novo tipo de etapa
            </button>
          </ui-empty-state>
        }
      }

      @if (prevCursor() !== null || nextCursor() !== null) {
        <ui-pager
          statusText="Navegação por páginas"
          navigationLabel="Paginação de tipos de etapa"
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
      ariaLabel="Formulário de tipo de etapa"
      position="right"
    >
      @if (formError()) {
        <ui-alert variant="danger" heading="Não foi possível salvar">{{ formError() }}</ui-alert>
      }

      <form
        [formGroup]="form"
        id="cfg-tipo-etapa-form"
        (ngSubmit)="salvar()"
        novalidate
        class="cfg-form"
      >
        <section aria-labelledby="cfg-etapa-identificacao">
          <h3 id="cfg-etapa-identificacao" class="form-section__title">Identificação</h3>
          <div class="form-grid form-grid--1col">
            <label class="field" [class.is-error]="erroDoCampo('codigo')">
              <span class="field__label is-required">Código</span>
              <input
                class="input"
                type="text"
                formControlName="codigo"
                [readonly]="modo() === 'editar'"
                [attr.aria-invalid]="erroDoCampo('codigo') ? 'true' : null"
              />
              <span class="field__hint">
                Identifica o tipo para sempre — nem a inativação libera o código para reuso. Por
                convenção, maiúsculas separadas por sublinhado, como ANALISE_DOCUMENTAL.
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
              <span class="field__hint">Como o tipo aparece para quem monta o processo seletivo.</span>
              @if (erroDoCampo('nome')) {
                <span class="field__error">{{ erroDoCampo('nome') }}</span>
              }
            </label>
            <label class="field">
              <span class="field__label">Descrição</span>
              <textarea class="textarea" formControlName="descricao"></textarea>
            </label>
          </div>
        </section>

        <section aria-labelledby="cfg-etapa-carater">
          <h3 id="cfg-etapa-carater" class="form-section__title">O que a etapa pode fazer</h3>
          <fieldset class="field" [class.is-error]="erroDoCampo('admitePontuacao')">
            <legend class="field__label is-required">Admite</legend>
            <div class="cfg-tipos-etapa__opcoes">
              <label class="checkbox">
                <input
                  type="checkbox"
                  formControlName="admitePontuacao"
                  aria-describedby="cfg-etapa-admite-ajuda"
                />
                <span class="checkbox__box" aria-hidden="true"></span>
                Compor a nota final
              </label>
              <label class="checkbox">
                <input
                  type="checkbox"
                  formControlName="admiteEliminacao"
                  aria-describedby="cfg-etapa-admite-ajuda"
                />
                <span class="checkbox__box" aria-hidden="true"></span>
                Eliminar candidato
              </label>
            </div>
            <span class="field__hint" id="cfg-etapa-admite-ajuda">
              Ao menos um. Só quem compõe a nota final pode ter peso; só quem elimina pode ter nota
              mínima.
            </span>
            @if (erroDoCampo('admitePontuacao')) {
              <span class="field__error">{{ erroDoCampo('admitePontuacao') }}</span>
            }
            @if (erroDoCampo('admiteEliminacao')) {
              <span class="field__error">{{ erroDoCampo('admiteEliminacao') }}</span>
            }
          </fieldset>
        </section>
      </form>

      <div class="cfg-form-footer">
        <button type="button" class="btn btn--tertiary btn--rect" (click)="formOpen.set(false)">
          Cancelar
        </button>
        <button
          type="submit"
          form="cfg-tipo-etapa-form"
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
                ? 'Criar tipo de etapa'
                : 'Salvar tipo de etapa'
          }}
        </button>
      </div>
    </ui-drawer>

    <ui-confirm-dialog
      [(visible)]="confirmOpen"
      heading="Inativar tipo de etapa"
      [message]="confirmMessage()"
      confirmLabel="Inativar"
      confirmVariant="danger"
      (confirmed)="removerConfirmado()"
    />
  `,
  host: { class: 'cfg-page' },
})
export class TiposEtapaPage {
  private readonly api = inject(TiposEtapaApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  protected readonly saving = signal(false);

  /**
   * Vez do editor. O drawer é um só para todos os registros, e nada impede o operador de
   * mandar salvar o tipo A e abrir o B antes de a resposta chegar. Sem o carimbo, o sucesso
   * de A fecharia o drawer de B — descartando o que ele tinha acabado de digitar — e a recusa
   * de A marcaria de vermelho os campos de B.
   */
  private vezDoEditor = 0;
  protected readonly formOpen = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly modo = signal<ModoFormulario>('criar');
  protected readonly tipoEmEdicaoId = signal<string | null>(null);
  protected readonly tipoParaRemover = signal<TipoEtapaDto | null>(null);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());
  protected readonly termoBusca = signal('');

  private readonly pagina = signal<
    { readonly cursor: Cursor; readonly direction: PaginationDirection } | undefined
  >(undefined);

  private readonly lista = useApiResource<readonly TipoEtapaDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/tipos-etapa`,
    params: this.montarParams(),
    context: withVendorMime('tipo-etapa', 1),
  }));

  protected readonly loading = this.lista.isLoading;

  private readonly cursores = linkedSignal<
    ApiResult<readonly TipoEtapaDto[]> | undefined,
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
    ApiResult<readonly TipoEtapaDto[]> | undefined,
    readonly TipoEtapaDto[]
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

  // Busca client-side sobre a página carregada: o contrato da listagem só pagina por cursor,
  // sem filtro de texto.
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
    return this.lista.error() ? 'Erro inesperado ao carregar tipos de etapa.' : null;
  });

  protected readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Novo tipo de etapa' : 'Editar tipo de etapa',
  );

  protected readonly confirmMessage = computed(() => {
    const tipo = this.tipoParaRemover();
    return tipo
      ? `Deseja inativar o tipo de etapa ${tipo.codigo}? A inativação impede que novos processos declarem etapas desse tipo, e não altera as etapas já gravadas — elas congelaram a própria cópia.`
      : 'Deseja inativar este tipo de etapa?';
  });

  protected readonly form: FormGroup<EtapaForm> = new FormGroup<EtapaForm>({
    codigo: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    admitePontuacao: new FormControl(true, { nonNullable: true }),
    admiteEliminacao: new FormControl(true, { nonNullable: true }),
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

  /** O que o tipo admite, em prosa — a coluna da tabela não deve exigir decifrar dois booleanos. */
  protected resumoDoQueAdmite(tipo: TipoEtapaDto): string {
    if (tipo.admitePontuacao && tipo.admiteEliminacao) {
      return 'Compor a nota final e eliminar';
    }
    return tipo.admitePontuacao ? 'Só compor a nota final' : 'Só eliminar';
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
    this.vezDoEditor += 1;
    this.modo.set('criar');
    this.tipoEmEdicaoId.set(null);
    this.form.reset({
      codigo: '',
      nome: '',
      admitePontuacao: true,
      admiteEliminacao: true,
      descricao: '',
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  protected abrirEdicao(tipo: TipoEtapaDto): void {
    this.vezDoEditor += 1;
    this.modo.set('editar');
    this.tipoEmEdicaoId.set(tipo.id);
    this.form.reset({
      codigo: tipo.codigo,
      nome: tipo.nome,
      admitePontuacao: tipo.admitePontuacao,
      admiteEliminacao: tipo.admiteEliminacao,
      descricao: tipo.descricao ?? '',
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  protected pedirRemocao(tipo: TipoEtapaDto): void {
    this.tipoParaRemover.set(tipo);
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
          this.notifications.success('Tipo de etapa inativado', tipo.codigo);
          this.confirmOpen.set(false);
          this.tipoParaRemover.set(null);
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

    // O modo vai junto da vez: quem responde depois não pode perguntar à tela se era criação
    // ou edição, porque a tela já pode estar tratando de outro registro.
    const vez = this.vezDoEditor;
    const modoDoEnvio = this.modo();

    if (modoDoEnvio === 'criar') {
      this.api
        .criar(this.criarCommand(), withIdempotencyKey(this.idempotencyKeyAtual()))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((result) => this.handleSalvarResult(result, vez, modoDoEnvio));
      return;
    }

    this.api
      .atualizar(
        this.tipoEmEdicaoId() ?? '',
        this.atualizarCommand(),
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result, vez, modoDoEnvio));
  }

  protected erroDoCampo(nome: keyof EtapaForm): string | null {
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

  private handleSalvarResult(
    result: ApiResult<string | void>,
    vez: number,
    modoDoEnvio: ModoFormulario,
  ): void {
    this.saving.set(false);
    const aviso = modoDoEnvio === 'criar' ? 'Tipo de etapa criado' : 'Tipo de etapa atualizado';

    // O editor passou a tratar de outro registro. A resposta ainda vale como notícia, e o
    // sucesso ainda obriga a reler a lista — o que ela não pode é tocar no formulário em tela,
    // fechando o drawer de quem está sendo editado agora ou marcando os campos dele com um
    // erro que é de outro tipo de etapa.
    if (vez !== this.vezDoEditor) {
      if (result.ok) {
        this.notifications.success(aviso);
        this.recarregar();
        return;
      }
      this.notifications.errorFromProblem(result.problem, {
        title: this.problemI18n.resolve(result.problem).title,
      });
      return;
    }

    if (result.ok) {
      this.notifications.success(aviso);
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
    // Código já reservado é DomainError único (409, sem `errors[]` — esse array só existe no
    // pipeline de validação de payload), então o vínculo com o campo é feito aqui.
    if (problem.code === TIPO_ETAPA_CODIGO_JA_EXISTE_CODE) {
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

  private criarCommand(): CriarTipoEtapaCommand {
    const raw = this.form.getRawValue();
    return {
      codigo: raw.codigo.trim(),
      nome: raw.nome.trim(),
      admitePontuacao: raw.admitePontuacao,
      admiteEliminacao: raw.admiteEliminacao,
      descricao: nullIfBlank(raw.descricao),
    };
  }

  private atualizarCommand(): AtualizarTipoEtapaCommand {
    const raw = this.form.getRawValue();
    return {
      id: this.tipoEmEdicaoId() ?? '',
      nome: raw.nome.trim(),
      admitePontuacao: raw.admitePontuacao,
      admiteEliminacao: raw.admiteEliminacao,
      descricao: nullIfBlank(raw.descricao),
    };
  }
}

function controlNameFromBackendField(field: string): keyof EtapaForm | null {
  const normalized =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  const camelCase = normalized.charAt(0).toLocaleLowerCase('pt-BR') + normalized.slice(1);
  return ETAPA_CONTROL_NAMES.has(camelCase) ? (camelCase as keyof EtapaForm) : null;
}

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
