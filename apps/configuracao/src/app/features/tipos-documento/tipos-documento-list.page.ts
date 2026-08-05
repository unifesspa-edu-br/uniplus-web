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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
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
  AtualizarTipoDocumentoCommand,
  CATEGORIAS_DOCUMENTO,
  CONFIGURACAO_BASE_PATH,
  CriarTipoDocumentoCommand,
  TipoDocumentoDto,
  TiposDocumentoApi,
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  ConfirmDialogComponent,
  DrawerComponent,
  EmptyStateComponent,
  FilterChipsComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
  type UiFilterChipOption,
  FilterBarComponent
} from '@uniplus/shared-ui/components';

/** Tamanho da janela de cada página (cursor pagination, ADR-0026). */
const PAGE_SIZE = 50;

/** Vendor code do DomainError `TipoDocumento.CodigoJaExiste` (uniplus-api, 409 Conflict). */
const TIPO_DOCUMENTO_CODIGO_JA_EXISTE_CODE = 'uniplus.configuracao.tipo_documento.codigo_ja_existe';

/** Teto do campo `tamanhoMaximoMb` — o backend só exige `> 0`; sem teto superior no contrato. */
const TAMANHO_MAXIMO_MB_MINIMO = 1;

type ModoFormulario = 'criar' | 'editar';
type FormatoAceitoChave = 'formatoPdf' | 'formatoJpeg' | 'formatoPng' | 'formatoTiff';

interface FormatoAceitoOpcao {
  readonly key: FormatoAceitoChave;
  readonly extensao: string;
  readonly label: string;
}

/**
 * Roster fechado de formatos de arquivo aceitos (checkboxes do drawer,
 * serializados para a string orientativa `"pdf,jpg,png"` que o backend
 * persiste em `formatosAceitos`). A extensão `jpg` (não `jpeg`) é a canônica
 * de serialização — espelha o exemplo da issue #392.
 */
const FORMATOS_ACEITOS_OPCOES: readonly FormatoAceitoOpcao[] = [
  { key: 'formatoPdf', extensao: 'pdf', label: 'PDF' },
  { key: 'formatoJpeg', extensao: 'jpg', label: 'JPEG' },
  { key: 'formatoPng', extensao: 'png', label: 'PNG' },
  { key: 'formatoTiff', extensao: 'tiff', label: 'TIFF' },
];

interface TipoDocumentoForm {
  codigo: FormControl<string>;
  categoria: FormControl<string>;
  nome: FormControl<string>;
  descricao: FormControl<string>;
  tipoEquivalente: FormControl<string>;
  formatoPdf: FormControl<boolean>;
  formatoJpeg: FormControl<boolean>;
  formatoPng: FormControl<boolean>;
  formatoTiff: FormControl<boolean>;
  tamanhoMaximoMb: FormControl<number | null>;
}

@Component({
  selector: 'cfg-tipos-documento-list-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ConfirmDialogComponent,
    DrawerComponent,
    EmptyStateComponent,
    FilterChipsComponent,
    PagerComponent,
    SpinnerComponent,
    TagComponent,
    FilterBarComponent
],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Tipo de Documento</h1>
        <p class="page-header__desc">
          Cadastro classificatório dos documentos que um candidato pode anexar a uma inscrição —
          código, nome, categoria, formatos aceitos e tamanho máximo. Não define regra material
          sobre o documento (validade, assinatura, idade de emissão); isso pertence à exigência
          documental do edital. UNI-REQ-0013.
        </p>
      </div>
    </div>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar os tipos de documento">
        {{ errorMessage() }}
        <div class="cfg-tipos-documento__retry">
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
      ariaLabel="Filtrar tipos de documento"
      searchPlaceholder="Buscar por código ou nome…"
      searchAriaLabel="Buscar tipo de documento"
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
      <ng-container uiFilterBarSecondary>
        <span class="u-eyebrow">Categoria</span>
        <ui-filter-chips
          [options]="categoriaChips()"
          [(selected)]="filtroCategoria"
          (selectedChange)="filtroCategoria.set($event ?? '')"
          ariaLabel="Filtrar por categoria"
        />
      </ng-container>
    </ui-filter-bar>

    <section class="panel" aria-labelledby="cfg-tipos-documento-list-title">
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 id="cfg-tipos-documento-list-title">Tipos de documento</h2>
          @if (loading()) {
            <span class="cfg-tipos-documento__loading"><ui-spinner size="sm" /> Carregando</span>
          }
        </div>
        <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
          <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
          Novo tipo
        </button>
      </div>

      @if (documentosFiltrados().length > 0) {
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Nome</th>
                <th scope="col">Categoria</th>
                <th scope="col">Formatos aceitos</th>
                <th scope="col">Tam. máx.</th>
                <th scope="col"><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              @for (tipo of documentosFiltrados(); track tipo.id) {
                <tr>
                  <td data-label="Código"><code>{{ tipo.codigo }}</code></td>
                  <td data-label="Nome">
                    {{ tipo.nome }}
                    @if (tipo.tipoEquivalente) {
                      <div class="table-responsive__meta">Equiv.: <code>{{ tipo.tipoEquivalente }}</code></div>
                    }
                  </td>
                  <td data-label="Categoria"><ui-tag>{{ categoriaLabel(tipo.categoria) }}</ui-tag></td>
                  <td data-label="Formatos aceitos" class="u-caption">{{ tipo.formatosAceitos || '—' }}</td>
                  <td data-label="Tam. máx." class="u-caption">{{ tamanhoLabel(tipo.tamanhoMaximoMb) }}</td>
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
                      (click)="pedirInativacao(tipo)"
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
            heading="Nenhum tipo de documento encontrado"
            description="Ajuste a busca ou a categoria para ver resultados."
          >
            <button type="button" class="btn btn--secondary" (click)="limparFiltros()">
              Limpar filtros
            </button>
          </ui-empty-state>
        } @else {
          <ui-empty-state
            heading="Nenhum tipo de documento cadastrado"
            description="Cadastre o primeiro tipo de documento para compor exigências documentais de editais."
          >
            <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
              Novo tipo
            </button>
          </ui-empty-state>
        }
      }

      @if (prevCursor() !== null || nextCursor() !== null) {
        <ui-pager
          statusText="Navegação por páginas"
          navigationLabel="Paginação de tipos de documento"
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
      ariaLabel="Formulário de tipo de documento"
      position="right"
    >
      @if (formError()) {
        <ui-alert variant="danger" heading="Não foi possível salvar">{{ formError() }}</ui-alert>
      }

      <form
        [formGroup]="form"
        id="cfg-tipo-documento-form"
        (ngSubmit)="salvar()"
        novalidate
        class="cfg-form"
      >
        <div class="form-grid form-grid--pair">
          <label class="field" [class.is-error]="erroDoCampo('codigo')">
            <span class="field__label is-required">Código</span>
            <input
              class="input cfg-input-uppercase"
              type="text"
              formControlName="codigo"
              [attr.aria-invalid]="erroDoCampo('codigo') ? 'true' : null"
            />
            <span class="field__hint">
              Editável. A unicidade entre tipos ativos é validada ao salvar.
            </span>
            @if (erroDoCampo('codigo')) {
              <span class="field__error">{{ erroDoCampo('codigo') }}</span>
            }
          </label>
          <label class="field" [class.is-error]="erroDoCampo('categoria')">
            <span class="field__label is-required">Categoria</span>
            <select class="select" formControlName="categoria">
              <option value="">Selecione…</option>
              @for (opcao of categoriasDocumento; track opcao.value) {
                <option [value]="opcao.value">{{ opcao.label }}</option>
              }
            </select>
            <span class="field__hint">Domínio fechado. Congelada no snapshot do edital (RN08).</span>
            @if (erroDoCampo('categoria')) {
              <span class="field__error">{{ erroDoCampo('categoria') }}</span>
            }
          </label>
        </div>

        <label class="field field--full" [class.is-error]="erroDoCampo('nome')">
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

        <label class="field field--full" [class.is-error]="erroDoCampo('descricao')">
          <span class="field__label">Descrição</span>
          <textarea class="textarea" rows="3" formControlName="descricao"></textarea>
          <span class="field__hint">
            Observação classificatória — não inclui regra material (validade, assinatura, idade de
            emissão).
          </span>
          @if (erroDoCampo('descricao')) {
            <span class="field__error">{{ erroDoCampo('descricao') }}</span>
          }
        </label>

        <label class="field field--full" [class.is-error]="erroDoCampo('tipoEquivalente')">
          <span class="field__label">Tipo equivalente</span>
          <input
            class="input cfg-input-uppercase"
            type="text"
            formControlName="tipoEquivalente"
            [attr.aria-invalid]="erroDoCampo('tipoEquivalente') ? 'true' : null"
          />
          <span class="field__hint">
            Código de outro tipo equivalente (apenas rótulo classificatório, sem vínculo). Não pode
            ser igual ao próprio código.
          </span>
          @if (erroDoCampo('tipoEquivalente')) {
            <span class="field__error">{{ erroDoCampo('tipoEquivalente') }}</span>
          }
        </label>

        <fieldset class="field field--full">
          <legend class="field__label">Formatos aceitos</legend>
          <div class="cfg-tipo-documento-formatos">
            @for (opcao of formatosAceitosOpcoes; track opcao.key) {
              <label class="checkbox">
                <input type="checkbox" [formControlName]="opcao.key" />
                <span class="checkbox__box"></span>
                {{ opcao.label }}
              </label>
            }
          </div>
          <span class="field__hint">
            Orientativo — extensões de arquivo aceitas para o upload deste documento.
          </span>
        </fieldset>

        <label class="field" [class.is-error]="erroDoCampo('tamanhoMaximoMb')">
          <span class="field__label">Tamanho máximo (MB)</span>
          <input
            class="input"
            type="number"
            min="1"
            step="1"
            formControlName="tamanhoMaximoMb"
            [attr.aria-invalid]="erroDoCampo('tamanhoMaximoMb') ? 'true' : null"
          />
          <span class="field__hint">Quando informado, deve ser um inteiro positivo (≥ 1).</span>
          @if (erroDoCampo('tamanhoMaximoMb')) {
            <span class="field__error">{{ erroDoCampo('tamanhoMaximoMb') }}</span>
          }
        </label>
      </form>

      <div class="cfg-form-footer">
        <button type="button" class="btn btn--tertiary btn--rect" (click)="formOpen.set(false)">
          Cancelar
        </button>
        <button
          type="submit"
          form="cfg-tipo-documento-form"
          class="btn btn--primary"
          [disabled]="saving() || tipoEquivalenteIgualCodigo()"
        >
          @if (saving()) {
            <ui-spinner size="sm" />
          }
          {{
            saving()
              ? 'Salvando...'
              : modo() === 'criar'
                ? 'Criar tipo de documento'
                : 'Salvar tipo de documento'
          }}
        </button>
      </div>
    </ui-drawer>

    <ui-confirm-dialog
      [(visible)]="confirmInativarAberto"
      heading="Inativar tipo de documento"
      [message]="confirmInativarMensagem()"
      confirmLabel="Inativar"
      confirmVariant="danger"
      (confirmed)="confirmarInativacao()"
    />
  `,
})
export class TiposDocumentoListPage {
  private readonly api = inject(TiposDocumentoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  protected readonly categoriasDocumento = CATEGORIAS_DOCUMENTO;
  protected readonly formatosAceitosOpcoes = FORMATOS_ACEITOS_OPCOES;

  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly modo = signal<ModoFormulario>('criar');
  protected readonly tipoEmEdicaoId = signal<string | null>(null);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());
  protected readonly termoBusca = signal('');
  protected readonly filtroCategoria = signal('');

  protected readonly confirmInativarAberto = signal(false);
  protected readonly tipoParaInativar = signal<TipoDocumentoDto | null>(null);
  protected readonly confirmError = signal<string | null>(null);

  private readonly pagina = signal<
    { readonly cursor: Cursor; readonly direction: PaginationDirection } | undefined
  >(undefined);

  private readonly lista = useApiResource<readonly TipoDocumentoDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/tipos-documento`,
    params: this.montarParams(),
    context: withVendorMime('tipo-documento', 1),
  }));

  protected readonly loading = this.lista.isLoading;

  private readonly cursores = linkedSignal<
    ApiResult<readonly TipoDocumentoDto[]> | undefined,
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

  protected readonly tiposDocumento = linkedSignal<
    ApiResult<readonly TipoDocumentoDto[]> | undefined,
    readonly TipoDocumentoDto[]
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

  // Busca client-side sobre a página carregada: o backend só pagina por
  // cursor, sem filtro de texto/categoria no contrato (issue #392 §4).
  protected readonly registrosBuscados = computed(() => {
    const termo = this.termoBusca().trim().toLocaleLowerCase('pt-BR');
    const registros = this.tiposDocumento();
    if (termo.length === 0) {
      return registros;
    }
    return registros.filter(
      (tipo) =>
        tipo.codigo.toLocaleLowerCase('pt-BR').includes(termo) ||
        tipo.nome.toLocaleLowerCase('pt-BR').includes(termo),
    );
  });

  /**
   * Chips de categoria com contador dinâmico sobre o conjunto já filtrado por
   * busca textual (CA-01) — refletem quantos registros de cada categoria
   * casam com o termo digitado, antes de aplicar o próprio filtro de chip.
   */
  protected readonly categoriaChips = computed<readonly UiFilterChipOption[]>(() => {
    const registros = this.registrosBuscados();
    const contagem = new Map<string, number>();
    for (const registro of registros) {
      contagem.set(registro.categoria, (contagem.get(registro.categoria) ?? 0) + 1);
    }
    return [
      { value: '', label: 'Todas', count: registros.length },
      ...CATEGORIAS_DOCUMENTO.map((categoria) => ({
        value: categoria.value,
        label: categoria.label,
        count: contagem.get(categoria.value) ?? 0,
      })),
    ];
  });

  protected readonly documentosFiltrados = computed(() => {
    const categoria = this.filtroCategoria();
    const registros = this.registrosBuscados();
    if (categoria === '') {
      return registros;
    }
    return registros.filter((tipo) => tipo.categoria === categoria);
  });

  protected readonly temFiltro = computed(
    () => this.termoBusca().trim().length > 0 || this.filtroCategoria() !== '',
  );

  protected readonly errorMessage = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar tipos de documento.' : null;
  });

  protected readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Novo tipo de documento' : 'Editar tipo de documento',
  );

  protected readonly confirmInativarMensagem = computed(() => {
    const erro = this.confirmError();
    if (erro !== null) {
      return erro;
    }
    const tipo = this.tipoParaInativar();
    return tipo
      ? `Deseja inativar "${tipo.nome}" (${tipo.codigo})? O tipo é inativado e mantido na ` +
          'trilha de auditoria. Editais já publicados que o referenciam não são afetados — os ' +
          'parâmetros foram congelados na configuração do edital (RN08).'
      : 'Deseja inativar este tipo de documento?';
  });

  protected readonly form: FormGroup<TipoDocumentoForm> = new FormGroup<TipoDocumentoForm>({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(60)],
    }),
    categoria: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(200)],
    }),
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(1000)],
    }),
    tipoEquivalente: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(60)],
    }),
    formatoPdf: new FormControl(false, { nonNullable: true }),
    formatoJpeg: new FormControl(false, { nonNullable: true }),
    formatoPng: new FormControl(false, { nonNullable: true }),
    formatoTiff: new FormControl(false, { nonNullable: true }),
    tamanhoMaximoMb: new FormControl<number | null>(null, {
      validators: [Validators.min(TAMANHO_MAXIMO_MB_MINIMO)],
    }),
  });

  // Valor reativo do formulário — só para a checagem de auto-equivalência
  // client-side (§5.2 da issue #392), que precisa reagir a cada tecla/blur
  // sem depender de round-trip ao backend. `getRawValue()` (não `.value` do
  // próprio `valueChanges`) preserva os campos como não-opcionais mesmo com
  // nenhum control desabilitado.
  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  /**
   * `tipoEquivalente` igual ao próprio `codigo` (trim, case-sensitive —
   * espelha o guard `StringComparison.Ordinal` do backend). Gate do botão
   * Salvar e fonte do erro inline — sem chamada de rede (§5.2).
   */
  protected readonly tipoEquivalenteIgualCodigo = computed(() => {
    const valor = this.formValue();
    const equivalente = valor.tipoEquivalente.trim();
    const codigo = valor.codigo.trim();
    return equivalente.length > 0 && equivalente === codigo;
  });

  constructor() {
    effect(() => {
      const problem = this.lista.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });

    // Sincroniza o erro inline de auto-equivalência no próprio FormControl —
    // mesmo mecanismo de `erroDoCampo()` usado para erros required/backend,
    // sem duplicar a lógica de exibição.
    effect(() => {
      const invalido = this.tipoEquivalenteIgualCodigo();
      untracked(() => {
        const control = this.form.controls.tipoEquivalente;
        if (invalido) {
          control.setErrors({ ...control.errors, igualAoCodigo: true });
          control.markAsTouched();
          return;
        }
        if (control.errors?.['igualAoCodigo']) {
          const resto = { ...control.errors };
          delete resto['igualAoCodigo'];
          control.setErrors(Object.keys(resto).length > 0 ? resto : null);
        }
      });
    });
  }

  protected inputValue(event: Event): string {
    return event.target instanceof HTMLInputElement ? event.target.value : '';
  }

  protected limparFiltros(): void {
    this.termoBusca.set('');
    this.filtroCategoria.set('');
  }

  protected categoriaLabel(valor: string): string {
    return CATEGORIAS_DOCUMENTO.find((categoria) => categoria.value === valor)?.label ?? valor;
  }

  protected tamanhoLabel(valor: number | string | null): string {
    const normalizado = normalizarTamanhoMaximo(valor);
    return normalizado === null ? '—' : `${normalizado} MB`;
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

  protected abrirCadastro(): void {
    this.modo.set('criar');
    this.tipoEmEdicaoId.set(null);
    this.form.reset({
      codigo: '',
      categoria: '',
      nome: '',
      descricao: '',
      tipoEquivalente: '',
      formatoPdf: false,
      formatoJpeg: false,
      formatoPng: false,
      formatoTiff: false,
      tamanhoMaximoMb: null,
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  protected abrirEdicao(tipo: TipoDocumentoDto): void {
    this.modo.set('editar');
    this.tipoEmEdicaoId.set(tipo.id);
    const formatos = desserializarFormatosAceitos(tipo.formatosAceitos);
    this.form.reset({
      codigo: tipo.codigo,
      categoria: tipo.categoria,
      nome: tipo.nome,
      descricao: tipo.descricao ?? '',
      tipoEquivalente: tipo.tipoEquivalente ?? '',
      formatoPdf: formatos.formatoPdf,
      formatoJpeg: formatos.formatoJpeg,
      formatoPng: formatos.formatoPng,
      formatoTiff: formatos.formatoTiff,
      tamanhoMaximoMb: normalizarTamanhoMaximo(tipo.tamanhoMaximoMb),
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  protected pedirInativacao(tipo: TipoDocumentoDto): void {
    this.tipoParaInativar.set(tipo);
    this.confirmError.set(null);
    this.confirmInativarAberto.set(true);
  }

  protected confirmarInativacao(): void {
    const tipo = this.tipoParaInativar();
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
          this.notifications.success('Tipo de documento inativado', tipo.codigo);
          this.confirmInativarAberto.set(false);
          this.tipoParaInativar.set(null);
          this.recarregar();
          return;
        }
        // O `ui-confirm-dialog` fecha a si mesmo de forma síncrona ao emitir
        // `confirmed` (antes desta resposta HTTP assíncrona chegar) — reabrir
        // explicitamente com a mensagem de erro mantém o fluxo visível.
        const titulo = this.problemI18n.resolve(result.problem).title;
        this.confirmError.set(titulo);
        this.confirmInativarAberto.set(true);
        if (result.problem.status >= 500) {
          this.notifications.errorFromProblem(result.problem, { title: titulo });
        }
      });
  }

  protected salvar(): void {
    if (this.saving() || this.tipoEquivalenteIgualCodigo()) {
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

  protected erroDoCampo(nome: keyof TipoDocumentoForm): string | null {
    const control = this.form.controls[nome];
    const shouldShowError = control.touched || control.dirty;
    if (!shouldShowError || control.errors === null) {
      return null;
    }
    if (control.errors['backend']) {
      const backend = control.errors['backend'] as { code: string; message: string };
      return backend.message;
    }
    if (control.errors['igualAoCodigo']) {
      return 'O tipo equivalente não pode ser igual ao próprio código.';
    }
    if (control.errors['required']) return 'Campo obrigatório.';
    if (control.errors['maxlength']) return 'Valor acima do tamanho permitido.';
    if (control.errors['minlength']) return 'Valor abaixo do tamanho mínimo.';
    if (control.errors['min']) return 'Deve ser um inteiro positivo (≥ 1).';
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
        this.modo() === 'criar' ? 'Tipo de documento criado' : 'Tipo de documento atualizado',
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
    // TipoDocumento.CodigoJaExiste é um DomainError único (409, sem
    // `errors[]` — esse array só existe no pipeline FluentValidation/422);
    // mapeado ao campo manualmente para exibir o erro inline exigido pelo CA-03.
    if (problem.code === TIPO_DOCUMENTO_CODIGO_JA_EXISTE_CODE) {
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

  private criarCommand(): CriarTipoDocumentoCommand {
    const raw = this.form.getRawValue();
    return {
      codigo: raw.codigo.trim(),
      nome: raw.nome.trim(),
      categoria: raw.categoria,
      descricao: nullIfBlank(raw.descricao),
      formatosAceitos: serializarFormatosAceitos(raw),
      tamanhoMaximoMb: raw.tamanhoMaximoMb,
      tipoEquivalente: nullIfBlank(raw.tipoEquivalente),
    };
  }

  private atualizarCommand(): AtualizarTipoDocumentoCommand {
    return { id: this.tipoEmEdicaoId() ?? '', ...this.criarCommand() };
  }
}

const TIPO_DOCUMENTO_CONTROL_NAMES: ReadonlySet<string> = new Set<keyof TipoDocumentoForm>([
  'codigo',
  'categoria',
  'nome',
  'descricao',
  'tipoEquivalente',
  'tamanhoMaximoMb',
]);

function controlNameFromBackendField(field: string): keyof TipoDocumentoForm | null {
  const normalized =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  const camelCase = normalized.charAt(0).toLocaleLowerCase('pt-BR') + normalized.slice(1);
  return TIPO_DOCUMENTO_CONTROL_NAMES.has(camelCase)
    ? (camelCase as keyof TipoDocumentoForm)
    : null;
}

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// `tamanhoMaximoMb` é `int32` no contrato, mas o `schema.ts` gerado tipa como
// `number | string | null` (mesmo padrão de `OfertaCursoDto.vagasAnuaisAutorizadas`)
// — o form (`FormControl<number | null>`) preserva o valor mesmo quando o
// backend serializa como string.
function normalizarTamanhoMaximo(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined) {
    return null;
  }
  const numero = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

/** Serializa os checkboxes marcados para a string orientativa `"pdf,jpg,png"` (§5.5 da issue #392). */
function serializarFormatosAceitos(raw: Record<FormatoAceitoChave, boolean>): string | null {
  const extensoes = FORMATOS_ACEITOS_OPCOES.filter((opcao) => raw[opcao.key]).map(
    (opcao) => opcao.extensao,
  );
  return extensoes.length > 0 ? extensoes.join(',') : null;
}

/** Desserializa a string persistida (ex.: `"pdf,jpg,png"`) para o estado dos 4 checkboxes. */
function desserializarFormatosAceitos(
  valor: string | null | undefined,
): Record<FormatoAceitoChave, boolean> {
  const extensoes = new Set(
    (valor ?? '')
      .split(',')
      .map((item) => item.trim().toLocaleLowerCase('pt-BR'))
      .filter((item) => item.length > 0),
  );
  return {
    formatoPdf: extensoes.has('pdf'),
    formatoJpeg: extensoes.has('jpg') || extensoes.has('jpeg'),
    formatoPng: extensoes.has('png'),
    formatoTiff: extensoes.has('tiff') || extensoes.has('tif'),
  };
}
