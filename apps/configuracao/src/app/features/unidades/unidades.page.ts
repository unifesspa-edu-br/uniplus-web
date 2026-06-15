import { HttpParams } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
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
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import {
  ApiResult,
  Cursor,
  ProblemDetails,
  ProblemI18nService,
  ProblemValidationError,
  cursorToString,
  extractNextCursor,
  idempotencyKey,
  useApiResource,
  withIdempotencyKey,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AtualizarUnidadeCommand,
  CriarUnidadeCommand,
  ORGANIZACAO_BASE_PATH,
  ORIGENS_UNIDADE,
  TIPOS_UNIDADE,
  OrigemUnidade,
  TipoUnidade,
  UnidadeDto,
  UnidadesApi,
} from '@uniplus/shared-data/organizacao';
import {
  AlertComponent,
  ConfirmDialogComponent,
  DrawerComponent,
  EmptyStateComponent,
  FilterChipsComponent,
  SpinnerComponent,
  type UiFilterChipOption,
} from '@uniplus/shared-ui/components';

/** Tamanho da janela de cada página (cursor pagination, ADR-0026). */
const PAGE_SIZE = 100;

/**
 * Debounce da busca textual — uma request por rajada de digitação, não por
 * tecla (critério de aceite #397). Angular 22 trará `debounced()`; no 21.x o
 * padrão oficial é a interop `toObservable → debounceTime → toSignal`.
 */
const BUSCA_DEBOUNCE_MS = 300;

interface UnidadeForm {
  nome: FormControl<string>;
  alias: FormControl<string>;
  slug: FormControl<string>;
  sigla: FormControl<string>;
  codigo: FormControl<string>;
  unidadeSuperiorId: FormControl<string>;
  tipo: FormControl<string>;
  unidadeAcademica: FormControl<boolean>;
  vigenciaInicio: FormControl<string>;
  vigenciaFim: FormControl<string>;
  origem: FormControl<string>;
  motivoMudancaIdentificador: FormControl<string>;
}

interface UnidadeTreeNode {
  readonly unidade: UnidadeDto;
  readonly children: readonly UnidadeTreeNode[];
}

type ModoFormulario = 'criar' | 'editar';

const BACKEND_FIELD_TO_CONTROL = {
  Alias: 'alias',
  Codigo: 'codigo',
  Código: 'codigo',
  MotivoMudancaIdentificador: 'motivoMudancaIdentificador',
  MotivoMudançaIdentificador: 'motivoMudancaIdentificador',
  Nome: 'nome',
  Origem: 'origem',
  Sigla: 'sigla',
  Slug: 'slug',
  Tipo: 'tipo',
  UnidadeAcademica: 'unidadeAcademica',
  UnidadeAcadêmica: 'unidadeAcademica',
  UnidadeSuperiorId: 'unidadeSuperiorId',
  VigenciaFim: 'vigenciaFim',
  VigênciaFim: 'vigenciaFim',
  VigenciaInicio: 'vigenciaInicio',
  VigênciaInicio: 'vigenciaInicio',
} satisfies Record<string, keyof UnidadeForm>;

@Component({
  selector: 'cfg-unidades-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ConfirmDialogComponent,
    DrawerComponent,
    EmptyStateComponent,
    FilterChipsComponent,
    NgTemplateOutlet,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Unidade</h1>
        <p class="page-header__desc">
          Estrutura organizacional hierárquica da Unifesspa — identidade rica com histórico de
          identificadores · UNI-REQ-0008.
        </p>
      </div>
    </div>

    <ui-alert
      variant="info"
      heading="Hierarquia de unidades — 11 tipos em domínio fechado"
      [dynamic]="false"
    >
      Cada unidade pode ter uma unidade superior do mesmo banco, sem ciclos. Sigla, Slug e Código
      são únicos entre as unidades vivas; o Alias é livre. A remoção é bloqueada se a unidade for
      superior de outra unidade viva ou a raiz da Instituição; referências por snapshot em outros
      módulos não bloqueiam.
    </ui-alert>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar unidades">
        {{ errorMessage() }}
      </ui-alert>
    }

    <div data-scope class="cfg-unidades-scope">
      <div class="filter-bar" role="search" aria-label="Filtrar unidades">
        <div class="filter-bar__row">
          <div class="input-group">
            <span class="input-group__addon" aria-hidden="true">
              <i class="pi pi-search"></i>
            </span>
            <input
              type="search"
              class="input"
              placeholder="Buscar por sigla ou nome..."
              aria-label="Buscar unidade"
              [value]="busca()"
              (input)="busca.set(inputValue($event))"
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
            [options]="tipoChips"
            [selected]="tipoFiltro()"
            (selectedChange)="tipoFiltro.set($event ?? '')"
            ariaLabel="Filtrar por tipo"
          />
        </div>
      </div>

      <section class="panel" aria-labelledby="cfg-unidades-tree-title">
        <div class="panel-head">
          <div class="panel-head__title">
            <h2 id="cfg-unidades-tree-title">Hierarquia</h2>
          </div>
          @if (loading()) {
            <span class="cfg-unidades__loading"><ui-spinner size="sm" /> Carregando</span>
          }
        </div>

        @if (arvore().length === 0) {
          <div class="cfg-panel-empty">
            <p class="cfg-muted">Sem relações carregadas.</p>
          </div>
        } @else {
          <nav class="unit-tree" aria-label="Hierarquia de unidades da Unifesspa">
            @for (node of arvore(); track node.unidade.id) {
              <ng-container
                [ngTemplateOutlet]="treeNode"
                [ngTemplateOutletContext]="{ $implicit: node }"
              />
            }
          </nav>
        }
      </section>

      <section class="panel" aria-labelledby="cfg-unidades-list-title">
        <div class="panel-head">
          <div class="panel-head__title">
            <h2 id="cfg-unidades-list-title">Unidades</h2>
            <span class="list-count" aria-label="Total de unidades carregadas">
              {{ unidades().length }}
            </span>
          </div>
          <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
            <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
            Nova unidade
          </button>
        </div>

        @if (unidades().length > 0) {
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th scope="col">Sigla</th>
                  <th scope="col">Nome</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Unidade superior</th>
                  <th scope="col"><span class="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                @for (unidade of unidades(); track unidade.id) {
                  <tr>
                    <td data-label="Sigla">
                      <code>{{ unidade.sigla }}</code>
                    </td>
                    <td data-label="Nome">
                      <button
                        type="button"
                        class="cfg-link-button table-responsive__primary"
                        (click)="abrirDetalhe(unidade)"
                      >
                        {{ unidade.nome }}
                      </button>
                      @if (unidade.alias) {
                        <div class="table-responsive__meta">Alias: {{ unidade.alias }}</div>
                      }
                    </td>
                    <td data-label="Tipo">
                      <span class="tag">{{ unidade.tipo }}</span>
                    </td>
                    <td data-label="Unidade superior">
                      {{ unidadeSuperiorLabel(unidade.unidadeSuperiorId) }}
                    </td>
                    <td class="table-responsive__actions" data-label="Ações">
                      <button
                        type="button"
                        class="btn btn--tertiary btn--sm btn--rect"
                        (click)="abrirEdicao(unidade)"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        class="btn btn--tertiary btn--sm btn--rect"
                        (click)="pedirRemocao(unidade)"
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
          @if (temFiltro()) {
            <ui-empty-state
              heading="Nenhuma unidade encontrada"
              description="Ajuste a busca ou o filtro de tipo para ver resultados."
            >
              <button type="button" class="btn btn--secondary" (click)="limparFiltros()">
                Limpar filtros
              </button>
            </ui-empty-state>
          } @else {
            <ui-empty-state
              heading="Nenhuma unidade carregada"
              description="Cadastre a primeira unidade para iniciar a estrutura institucional."
            >
              <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
                Nova unidade
              </button>
            </ui-empty-state>
          }
        }

        @if (nextCursor()) {
          <nav class="pager" aria-label="Carregar mais unidades">
            <button
              class="btn btn--secondary"
              type="button"
              [disabled]="loading()"
              (click)="carregarMais()"
            >
              Carregar mais
              <i class="pi pi-angle-down btn__icon" aria-hidden="true"></i>
            </button>
          </nav>
        }
      </section>
    </div>

    <ng-template #treeNode let-node>
      <div class="unit-node">
        <div class="unit-node__row">
          <span class="unit-node__icon" aria-hidden="true">
            <i class="pi pi-sitemap"></i>
          </span>
          <button type="button" class="unit-node__name" (click)="abrirDetalhe(node.unidade)">
            {{ node.unidade.sigla }}
          </button>
          <span class="unit-node__type">{{ node.unidade.nome }}</span>
          <div class="unit-node__actions">
            <button
              type="button"
              class="btn btn--tertiary btn--sm btn--rect"
              [attr.aria-label]="'Editar ' + node.unidade.sigla"
              (click)="abrirEdicao(node.unidade)"
            >
              Editar
            </button>
          </div>
        </div>
        @if (node.children.length > 0) {
          <div class="unit-node__children">
            @for (child of node.children; track child.unidade.id) {
              <ng-container
                [ngTemplateOutlet]="treeNode"
                [ngTemplateOutletContext]="{ $implicit: child }"
              />
            }
          </div>
        }
      </div>
    </ng-template>

    <ui-drawer
      class="cfg-detail-drawer"
      [(visible)]="drawerOpen"
      heading="Detalhes da unidade"
      ariaLabel="Detalhes da unidade selecionada"
      position="right"
    >
      @if (unidadeSelecionada(); as unidade) {
        <dl class="cfg-detail-list">
          <dt>Nome</dt>
          <dd>{{ unidade.nome }}</dd>
          <dt>Sigla</dt>
          <dd>{{ unidade.sigla }}</dd>
          <dt>Código</dt>
          <dd>{{ unidade.codigo }}</dd>
          <dt>Slug</dt>
          <dd>{{ unidade.slug }}</dd>
          <dt>Tipo</dt>
          <dd>{{ unidade.tipo }}</dd>
          <dt>Unidade superior</dt>
          <dd>{{ unidadeSuperiorLabel(unidade.unidadeSuperiorId) }}</dd>
          <dt>Unidade acadêmica</dt>
          <dd>{{ unidade.unidadeAcademica ? 'Sim' : 'Não' }}</dd>
          <dt>Origem</dt>
          <dd>{{ unidade.origem }}</dd>
          <dt>Vigência</dt>
          <dd>{{ vigenciaLabel(unidade) }}</dd>
        </dl>
        <div class="cfg-drawer-actions">
          <button type="button" class="btn btn--tertiary btn--rect" (click)="abrirEdicao(unidade)">
            Editar
          </button>
          <button type="button" class="btn btn--danger btn--rect" (click)="pedirRemocao(unidade)">
            Remover
          </button>
        </div>
      }
    </ui-drawer>

    <ui-drawer
      class="cfg-form-drawer"
      [(visible)]="formOpen"
      [heading]="formHeading()"
      ariaLabel="Formulário de unidade"
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
          <h3 id="cfg-form-identificadores" class="form-section__title">Identificadores</h3>
          <ui-alert variant="info" [dynamic]="false">
            Sigla, Slug e Código são únicos entre as unidades vivas. Alias é livre e não-único.
            Mudar qualquer identificador registra o valor anterior no histórico.
          </ui-alert>

          <div class="form-grid">
            <label class="field" [class.is-error]="erroDoCampo('sigla')">
              <span class="field__label is-required">Sigla</span>
              <input
                class="input"
                type="text"
                placeholder="Ex.: CEPS"
                formControlName="sigla"
                [attr.aria-invalid]="erroDoCampo('sigla') ? 'true' : null"
              />
              <span class="field__hint"
                >Sigla institucional corrente. Única entre as unidades vivas.</span
              >
              @if (erroDoCampo('sigla')) {
                <span class="field__error">{{ erroDoCampo('sigla') }}</span>
              }
            </label>
            <label class="field" [class.is-error]="erroDoCampo('slug')">
              <span class="field__label is-required">Slug</span>
              <input
                class="input"
                type="text"
                placeholder="ex.: ceps"
                formControlName="slug"
                [attr.aria-invalid]="erroDoCampo('slug') ? 'true' : null"
              />
              <span class="field__hint">
                Kebab-case, 3–64 caracteres, usado em caminhos de URL e integração.
              </span>
              @if (erroDoCampo('slug')) {
                <span class="field__error">{{ erroDoCampo('slug') }}</span>
              }
            </label>
            <label class="field" [class.is-error]="erroDoCampo('codigo')">
              <span class="field__label is-required">Código</span>
              <input
                class="input"
                type="text"
                placeholder="Ex.: 1234"
                formControlName="codigo"
                [attr.aria-invalid]="erroDoCampo('codigo') ? 'true' : null"
              />
              <span class="field__hint"
                >Código nos sistemas da Unifesspa. Único entre as unidades vivas.</span
              >
              @if (erroDoCampo('codigo')) {
                <span class="field__error">{{ erroDoCampo('codigo') }}</span>
              }
            </label>
            <label class="field">
              <span class="field__label">Alias</span>
              <input class="input" type="text" placeholder="Ex.: PROEG" formControlName="alias" />
              <span class="field__hint"> Nome popular de agrupamento. Não é único. </span>
            </label>
            <label class="field field--full" [class.is-error]="erroDoCampo('nome')">
              <span class="field__label is-required">Nome completo</span>
              <input
                class="input"
                type="text"
                placeholder="Nome formal conforme portaria"
                formControlName="nome"
                [attr.aria-invalid]="erroDoCampo('nome') ? 'true' : null"
              />
              @if (erroDoCampo('nome')) {
                <span class="field__error">{{ erroDoCampo('nome') }}</span>
              }
            </label>
          </div>
        </section>

        <section aria-labelledby="cfg-form-hierarquia">
          <h3 id="cfg-form-hierarquia" class="form-section__title">Classificação e hierarquia</h3>
          <div class="form-grid">
            <label class="field field--full" [class.is-error]="tipoNaoReconhecido()">
              <span class="field__label is-required">Tipo</span>
              <select
                class="select"
                formControlName="tipo"
                [attr.aria-invalid]="tipoNaoReconhecido() ? 'true' : null"
              >
                @if (tipoNaoReconhecido()) {
                  <option value="" disabled>Selecione o tipo</option>
                }
                @for (tipo of tipoOptions; track tipo.value) {
                  <option [value]="tipo.value">{{ tipo.label }}</option>
                }
              </select>
              @if (tipoNaoReconhecido()) {
                <span class="field__error">
                  Tipo atual não reconhecido — selecione um tipo válido para salvar.
                </span>
              }
            </label>
            <label class="field field--full">
              <span class="field__label">Unidade superior</span>
              <select class="select" formControlName="unidadeSuperiorId">
                <option value="">Raiz — sem superior</option>
                @for (unidade of unidades(); track unidade.id) {
                  <option [value]="unidade.id" [disabled]="unidade.id === unidadeEmEdicaoId()">
                    {{ unidade.sigla }} — {{ unidade.nome }}
                  </option>
                }
              </select>
              <span class="field__hint">Não pode formar ciclo na hierarquia.</span>
            </label>
            <label class="checkbox cfg-form__checkbox">
              <input type="checkbox" formControlName="unidadeAcademica" />
              <span class="checkbox__box" aria-hidden="true"></span>
              <span>Unidade acadêmica</span>
            </label>
          </div>
        </section>

        <section aria-labelledby="cfg-form-vigencia">
          <h3 id="cfg-form-vigencia" class="form-section__title">Vigência e origem</h3>
          <div class="form-grid">
            <label class="field" [class.is-error]="erroDoCampo('vigenciaInicio')">
              <span class="field__label is-required">Início de vigência</span>
              <input
                class="input"
                type="date"
                formControlName="vigenciaInicio"
                [readonly]="modo() === 'editar'"
                [attr.aria-invalid]="erroDoCampo('vigenciaInicio') ? 'true' : null"
              />
              @if (erroDoCampo('vigenciaInicio')) {
                <span class="field__error">{{ erroDoCampo('vigenciaInicio') }}</span>
              }
            </label>
            <label class="field" [class.is-error]="erroDoCampo('vigenciaFim')">
              <span class="field__label">Fim de vigência</span>
              <input
                class="input"
                type="date"
                formControlName="vigenciaFim"
                [attr.aria-invalid]="erroDoCampo('vigenciaFim') ? 'true' : null"
              />
              <span class="field__hint">Vazio = unidade vigente.</span>
              @if (erroDoCampo('vigenciaFim')) {
                <span class="field__error">{{ erroDoCampo('vigenciaFim') }}</span>
              }
            </label>
            @if (modo() === 'criar') {
              <label class="field field--full">
                <span class="field__label is-required">Origem do registro</span>
                <select class="select" formControlName="origem">
                  @for (origem of origemOptions; track origem.value) {
                    <option [value]="origem.value">{{ origem.label }}</option>
                  }
                </select>
              </label>
            } @else {
              <div class="field field--full">
                <span class="field__label">Origem do registro</span>
                <span class="field__readonly">{{ origemEmEdicaoLabel() }}</span>
              </div>
            }
            @if (modo() === 'editar') {
              <label class="field field--full">
                <span class="field__label">Motivo da mudança de identificador</span>
                <textarea class="textarea" formControlName="motivoMudancaIdentificador"></textarea>
              </label>
            }
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
          {{ saving() ? 'Salvando...' : modo() === 'criar' ? 'Criar unidade' : 'Salvar unidade' }}
        </button>
      </div>
    </ui-drawer>

    <ui-confirm-dialog
      [(visible)]="confirmOpen"
      heading="Remover unidade"
      [message]="confirmMessage()"
      confirmLabel="Remover"
      confirmVariant="danger"
      (confirmed)="removerConfirmado()"
    />
  `,
})
export class UnidadesPage {
  private readonly api = inject(UnidadesApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(ORGANIZACAO_BASE_PATH);

  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly busca = signal('');
  protected readonly tipoFiltro = signal('');
  protected readonly drawerOpen = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly unidadeSelecionada = signal<UnidadeDto | null>(null);
  protected readonly unidadeParaRemover = signal<UnidadeDto | null>(null);
  protected readonly modo = signal<ModoFormulario>('criar');
  protected readonly unidadeEmEdicaoId = signal<string | null>(null);
  protected readonly origemEmEdicao = signal<string | null>(null);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());

  // Termo de busca aplicado — debounced (uma request por rajada, não por tecla).
  private readonly buscaAplicada = toSignal(
    toObservable(this.busca).pipe(
      map((termo) => termo.trim()),
      debounceTime(BUSCA_DEBOUNCE_MS),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );

  // Chave do filtro vigente — fonte do reset de paginação.
  private readonly filtroKey = computed(() => JSON.stringify([this.buscaAplicada(), this.tipoFiltro()]));

  /**
   * Cursor da página atual (`undefined` = primeira). Volta para a primeira
   * página sempre que o filtro muda (linkedSignal: `source` = `filtroKey`).
   * "Carregar mais" faz `cursor.set(next)` — navegação só para frente, casando
   * com o cursor forward-only do ADR-0026 (sem "Anterior", sem nº de página).
   */
  private readonly cursor = linkedSignal<string, Cursor | undefined>({
    source: () => this.filtroKey(),
    computation: () => undefined,
  });

  /**
   * GET reativo de `/api/unidades`. Re-dispara quando filtro (`q`/`tipo`) ou
   * `cursor` mudam; `httpResource` cancela a request anterior nativamente — sem
   * `unsubscribe`/guarda manual. Vendor MIME `unidade v1` no HttpContext.
   */
  private readonly lista = useApiResource<readonly UnidadeDto[]>(() => ({
    url: `${this.basePath}/api/unidades`,
    params: this.montarParams(),
    context: withVendorMime('unidade', 1),
  }));

  protected readonly loading = this.lista.isLoading;

  /** Próximo cursor (rel="next" do header Link). `null` = última página. */
  protected readonly nextCursor = computed(() =>
    extractNextCursor(this.lista.headers()?.get('Link') ?? null),
  );

  /**
   * Acumulação reativa das páginas ("Carregar mais"): substitui na primeira
   * página (cursor `undefined` — cobre carga inicial, troca de filtro e refetch
   * pós-mutação) e concatena nas seguintes. `linkedSignal` em vez de `effect`
   * (guidance oficial Angular: `effect` não serve para atualizar outro signal).
   */
  protected readonly unidades = linkedSignal<
    ApiResult<readonly UnidadeDto[]> | undefined,
    readonly UnidadeDto[]
  >({
    source: () => this.lista.value(),
    computation: (envelope, previous) => {
      const acumulado = previous?.value ?? [];
      // Loading inicial ou falha: preserva o que já está na tela (o banner de
      // erro cobre a falha; não piscar a lista para vazio).
      if (envelope === undefined || !envelope.ok) {
        return acumulado;
      }
      // Lê o cursor no instante em que os dados chegam — `untracked` porque a
      // única dependência reativa deste linkedSignal é `lista.value()`; rastrear
      // o cursor reexecutaria a computação com dados velhos e duplicaria a página.
      const primeiraPagina = untracked(() => this.cursor() === undefined);
      return primeiraPagina ? [...envelope.data] : [...acumulado, ...envelope.data];
    },
  });

  /** Mensagem de erro da listagem (RFC 9457 → título i18n). */
  protected readonly errorMessage = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar unidades.' : null;
  });

  /** Há filtro ativo? Distingue "sem unidades" de "filtro sem resultado". */
  protected readonly temFiltro = computed(
    () => this.buscaAplicada().length > 0 || this.tipoFiltro().length > 0,
  );

  protected readonly tipoOptions = TIPOS_UNIDADE.map((tipo) => ({
    value: String(tipo.value),
    label: tipo.label,
  }));
  protected readonly origemOptions = ORIGENS_UNIDADE.map((origem) => ({
    value: String(origem.value),
    label: origem.label,
  }));

  /**
   * Chips de tipo a partir do roster fechado `TIPOS_UNIDADE` (11 tipos, valor
   * numérico). Estático — não derivado da página: com filtro server-side a
   * contagem por tipo exigiria facetas que o backend não expõe, então sem count.
   */
  protected readonly tipoChips: readonly UiFilterChipOption[] = [
    { value: '', label: 'Todas' },
    ...TIPOS_UNIDADE.map((tipo) => ({ value: String(tipo.value), label: tipo.label })),
  ];

  // A árvore reflete o conjunto carregado/filtrado. Com filtro ativo, nós cujo
  // pai foi filtrado aparecem como raiz — comportamento documentado (#397): não
  // há endpoint de hierarquia dedicado.
  protected readonly arvore = computed(() => montarArvore(this.unidades()));
  protected readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Nova unidade' : 'Editar unidade',
  );
  protected readonly origemEmEdicaoLabel = computed(() =>
    origemDisplayLabel(this.origemEmEdicao()),
  );
  protected readonly confirmMessage = computed(() => {
    const unidade = this.unidadeParaRemover();
    return unidade
      ? `Deseja remover ${unidade.sigla}? A remoção respeita as regras do backend para unidades subordinadas.`
      : 'Deseja remover esta unidade?';
  });

  protected readonly form: FormGroup<UnidadeForm> = new FormGroup<UnidadeForm>({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(250)],
    }),
    alias: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    slug: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    sigla: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
    unidadeSuperiorId: new FormControl('', { nonNullable: true }),
    tipo: new FormControl('4', { nonNullable: true, validators: [Validators.required] }),
    unidadeAcademica: new FormControl(false, { nonNullable: true }),
    vigenciaInicio: new FormControl(dataAtualIso(), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    vigenciaFim: new FormControl('', { nonNullable: true }),
    origem: new FormControl('2', { nonNullable: true, validators: [Validators.required] }),
    motivoMudancaIdentificador: new FormControl('', { nonNullable: true }),
  });

  // Reativo ao select de tipo: na edição, um `tipo` vindo do backend que não
  // casa com nenhum dos 11 tipos conhecidos resulta em controle vazio — em vez
  // de coagir silenciosamente para "Outro". Mantém o submit bloqueado (tipo é
  // obrigatório) até o usuário escolher um tipo válido conscientemente.
  private readonly tipoControlValue = toSignal(this.form.controls.tipo.valueChanges, {
    initialValue: this.form.controls.tipo.value,
  });
  protected readonly tipoNaoReconhecido = computed(
    () => this.tipoControlValue().trim().length === 0,
  );

  constructor() {
    // 5xx na listagem → toast persistente além do banner inline. Disparado só
    // quando o problem muda (não duplica em re-render). 4xx fica só no banner.
    effect(() => {
      const problem = this.lista.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });
  }

  protected carregarMais(): void {
    const proximo = this.nextCursor();
    if (proximo !== null && !this.loading()) {
      // Só avança (cursor forward-only). A acumulação fica a cargo do
      // linkedSignal `unidades` quando a próxima página chega.
      this.cursor.set(proximo);
    }
  }

  private montarParams(): HttpParams {
    let params = new HttpParams().set('limit', String(PAGE_SIZE));
    const q = this.buscaAplicada();
    if (q.length > 0) {
      params = params.set('q', q);
    }
    const tipo = this.tipoFiltro();
    if (tipo.length > 0) {
      // Valor numérico-como-string do roster TIPOS_UNIDADE; `tipo` é repetível
      // no contrato (?tipo=3). Valor fora do roster → backend responde 400.
      params = params.append('tipo', tipo);
    }
    const cursor = this.cursor();
    if (cursor !== undefined) {
      params = params.set('cursor', cursorToString(cursor));
    }
    return params;
  }

  protected abrirCadastro(): void {
    this.modo.set('criar');
    this.unidadeEmEdicaoId.set(null);
    this.origemEmEdicao.set(null);
    this.form.controls.origem.enable({ emitEvent: false });
    this.form.reset({
      nome: '',
      alias: '',
      slug: '',
      sigla: '',
      codigo: '',
      unidadeSuperiorId: '',
      tipo: '4',
      unidadeAcademica: false,
      vigenciaInicio: dataAtualIso(),
      vigenciaFim: '',
      origem: '2',
      motivoMudancaIdentificador: '',
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  protected abrirEdicao(unidade: UnidadeDto): void {
    this.modo.set('editar');
    this.unidadeEmEdicaoId.set(unidade.id);
    this.origemEmEdicao.set(unidade.origem);
    this.form.controls.origem.disable({ emitEvent: false });
    this.form.reset({
      nome: unidade.nome,
      alias: unidade.alias ?? '',
      slug: unidade.slug,
      sigla: unidade.sigla,
      codigo: unidade.codigo,
      unidadeSuperiorId: unidade.unidadeSuperiorId ?? '',
      tipo: tipoValueFromLabel(unidade.tipo),
      unidadeAcademica: unidade.unidadeAcademica,
      vigenciaInicio: unidade.vigenciaInicio,
      vigenciaFim: unidade.vigenciaFim ?? '',
      origem: origemValueFromLabel(unidade.origem),
      motivoMudancaIdentificador: '',
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.drawerOpen.set(false);
    this.formOpen.set(true);
  }

  protected abrirDetalhe(unidade: UnidadeDto): void {
    this.unidadeSelecionada.set(unidade);
    this.drawerOpen.set(true);
  }

  protected pedirRemocao(unidade: UnidadeDto): void {
    this.unidadeParaRemover.set(unidade);
    this.drawerOpen.set(false);
    this.confirmOpen.set(true);
  }

  protected removerConfirmado(): void {
    const unidade = this.unidadeParaRemover();
    if (unidade === null || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.api
      .remover(unidade.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.saving.set(false);
        if (result.ok) {
          this.notifications.success('Unidade removida', unidade.sigla);
          this.confirmOpen.set(false);
          this.unidadeParaRemover.set(null);
          this.recarregar();
          return;
        }
        // Falha de remoção é disparada de fora do drawer de formulário: a razão
        // (ex.: 409 "unidade é superior de outra") vai para a notificação, não
        // para `formError` — que pertence ao formulário e não está visível aqui.
        const mensagem = this.problemI18n.resolve(result.problem).title;
        this.notifications.errorFromProblem(result.problem, { title: mensagem });
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
        this.unidadeEmEdicaoId() ?? '',
        this.atualizarCommand(),
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result));
  }

  protected erroDoCampo(nome: keyof UnidadeForm): string | null {
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

  protected unidadeSuperiorLabel(id: string | null): string {
    if (id === null) {
      return 'Sem superior';
    }
    const superior = this.unidades().find((unidade) => unidade.id === id);
    return superior ? `${superior.sigla} — ${superior.nome}` : 'Não carregada';
  }

  protected vigenciaLabel(unidade: UnidadeDto): string {
    return unidade.vigenciaFim === null
      ? `Desde ${formatarData(unidade.vigenciaInicio)}`
      : `${formatarData(unidade.vigenciaInicio)} a ${formatarData(unidade.vigenciaFim)}`;
  }

  protected inputValue(event: Event): string {
    return event.target instanceof HTMLInputElement ? event.target.value : '';
  }

  protected limparFiltros(): void {
    this.busca.set('');
    this.tipoFiltro.set('');
  }

  private recarregar(): void {
    // Pós-mutação: volta para a primeira página e refaz o fetch. Se já está na
    // primeira (cursor undefined), `reload()` força o refetch (params iguais);
    // senão, resetar o cursor dispara o refetch reativo pelo httpResource. Em
    // ambos os casos o linkedSignal `unidades` substitui (não acumula).
    if (this.cursor() === undefined) {
      this.lista.reload();
    } else {
      this.cursor.set(undefined);
    }
  }

  private handleSalvarResult(result: ApiResult<string | void>): void {
    this.saving.set(false);
    if (result.ok) {
      this.notifications.success(this.modo() === 'criar' ? 'Unidade criada' : 'Unidade atualizada');
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

  private criarCommand(): CriarUnidadeCommand {
    const raw = this.form.getRawValue();
    return {
      nome: raw.nome.trim(),
      alias: nullIfBlank(raw.alias),
      slug: raw.slug.trim(),
      sigla: raw.sigla.trim(),
      codigo: raw.codigo.trim(),
      unidadeSuperiorId: nullIfBlank(raw.unidadeSuperiorId),
      tipo: Number(raw.tipo) as TipoUnidade,
      unidadeAcademica: raw.unidadeAcademica,
      vigenciaInicio: raw.vigenciaInicio,
      vigenciaFim: nullIfBlank(raw.vigenciaFim),
      origem: Number(raw.origem) as OrigemUnidade,
    };
  }

  private atualizarCommand(): AtualizarUnidadeCommand {
    const raw = this.form.getRawValue();
    return {
      id: this.unidadeEmEdicaoId() ?? '',
      nome: raw.nome.trim(),
      alias: nullIfBlank(raw.alias),
      slug: raw.slug.trim(),
      sigla: raw.sigla.trim(),
      codigo: raw.codigo.trim(),
      unidadeSuperiorId: nullIfBlank(raw.unidadeSuperiorId),
      tipo: Number(raw.tipo) as TipoUnidade,
      unidadeAcademica: raw.unidadeAcademica,
      vigenciaFim: nullIfBlank(raw.vigenciaFim),
      motivoMudancaIdentificador: nullIfBlank(raw.motivoMudancaIdentificador),
    };
  }
}

function montarArvore(unidades: readonly UnidadeDto[]): readonly UnidadeTreeNode[] {
  const nodes = new Map<string, { unidade: UnidadeDto; children: UnidadeTreeNode[] }>();
  for (const unidade of unidades) {
    nodes.set(unidade.id, { unidade, children: [] });
  }

  const roots: UnidadeTreeNode[] = [];
  for (const node of nodes.values()) {
    const parentId = node.unidade.unidadeSuperiorId;
    const parent = parentId === null ? undefined : nodes.get(parentId);
    if (parent === undefined) {
      roots.push(node);
    } else {
      parent.children.push(node);
    }
  }

  return ordenarArvore(roots);
}

function ordenarArvore(nodes: readonly UnidadeTreeNode[]): readonly UnidadeTreeNode[] {
  return [...nodes]
    .sort((a, b) => a.unidade.nome.localeCompare(b.unidade.nome, 'pt-BR'))
    .map((node) => ({ ...node, children: ordenarArvore(node.children) }));
}

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function controlNameFromBackendField(field: string): keyof UnidadeForm | null {
  const normalized =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  if (normalized in BACKEND_FIELD_TO_CONTROL) {
    return BACKEND_FIELD_TO_CONTROL[normalized as keyof typeof BACKEND_FIELD_TO_CONTROL];
  }

  const camelCase = normalized.charAt(0).toLocaleLowerCase('pt-BR') + normalized.slice(1);
  return isUnidadeControlName(camelCase) ? camelCase : null;
}

function isUnidadeControlName(value: string): value is keyof UnidadeForm {
  return [
    'alias',
    'codigo',
    'motivoMudancaIdentificador',
    'nome',
    'origem',
    'sigla',
    'slug',
    'tipo',
    'unidadeAcademica',
    'unidadeSuperiorId',
    'vigenciaFim',
    'vigenciaInicio',
  ].includes(value);
}

function dataAtualIso(): string {
  // Data local (não UTC): `toISOString` poderia adiantar um dia à noite em
  // fusos negativos (ex.: 21h BRT vira o dia seguinte em UTC).
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function formatarData(value: string): string {
  const [year, month, day] = value.split('-');
  if (year === undefined || month === undefined || day === undefined) {
    return value;
  }
  return `${day}/${month}/${year}`;
}

function tipoValueFromLabel(label: string): string {
  const option = TIPOS_UNIDADE.find(
    (tipo) => normalizarEnumLabel(tipo.label) === normalizarEnumLabel(label),
  );
  // Sem casamento: devolve vazio (controle inválido) em vez de assumir "Outro" —
  // editar+salvar não deve reclassificar a unidade silenciosamente.
  return option === undefined ? '' : String(option.value);
}

function origemValueFromLabel(label: string): string {
  const option = ORIGENS_UNIDADE.find(
    (origem) => normalizarEnumLabel(origem.label) === normalizarEnumLabel(label),
  );
  return option === undefined ? '' : String(option.value);
}

function origemDisplayLabel(label: string | null): string {
  if (label === null || label.trim().length === 0) {
    return '';
  }

  const option = ORIGENS_UNIDADE.find(
    (origem) => normalizarEnumLabel(origem.label) === normalizarEnumLabel(label),
  );
  return option?.label ?? label;
}

function normalizarEnumLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\+/gu, 'plus')
    .replace(/[^a-z0-9]/giu, '')
    .toLocaleLowerCase('pt-BR');
}
