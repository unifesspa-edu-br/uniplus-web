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
  AtualizarOfertaCursoCommand,
  CONFIGURACAO_BASE_PATH,
  CriarOfertaCursoCommand,
  CursoDto,
  FORMATOS_PEDAGOGICOS,
  LocalOfertaDto,
  OfertaCursoDto,
  OfertasCursoApi,
  PROGRAMAS_DE_OFERTA,
  PROGRAMA_DE_OFERTA_REGULAR,
  TIPOS_LOCAL_OFERTA,
  TURNOS_OFERTA,
} from '@uniplus/shared-data/configuracao';
import { ORGANIZACAO_BASE_PATH, UnidadeDto } from '@uniplus/shared-data/organizacao';
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

/** Janela dos lookups de FK (selects do formulário e resolução de rótulos da lista). */
const LOOKUP_LIMIT = 200;

type ModoFormulario = 'criar' | 'editar';

interface OfertaCursoForm {
  cursoId: FormControl<string>;
  localOfertaId: FormControl<string>;
  unidadeOfertanteOrigemId: FormControl<string>;
  programaDeOferta: FormControl<string>;
  formatoPedagogico: FormControl<string>;
  turno: FormControl<string>;
  eMecCodigo: FormControl<string>;
  codigoSga: FormControl<string>;
  vagasAnuaisAutorizadas: FormControl<number | null>;
  baseLegal: FormControl<string>;
  atoAutorizacaoMec: FormControl<string>;
}

@Component({
  selector: 'cfg-ofertas-curso-page',
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
        <h1 class="page-header__title">Oferta de curso</h1>
        <p class="page-header__desc">
          Instância regulatória que liga um Curso a um Local de oferta e à unidade ofertante ·
          UNI-REQ-0010.
        </p>
      </div>
    </div>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar as ofertas de curso">
        {{ errorMessage() }}
        <div class="cfg-ofertas__retry">
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

    <section class="panel" aria-labelledby="cfg-ofertas-list-title">
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 id="cfg-ofertas-list-title">Ofertas de curso</h2>
          @if (loading()) {
            <span class="cfg-ofertas__loading"><ui-spinner size="sm" /> Carregando</span>
          }
        </div>
        <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
          <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
          Nova oferta de curso
        </button>
      </div>

      @if (ofertas().length > 0) {
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th scope="col">Curso</th>
                <th scope="col">Local de oferta</th>
                <th scope="col">Unidade ofertante</th>
                <th scope="col">Programa</th>
                <th scope="col">Formato</th>
                <th scope="col">Turno</th>
                <th scope="col">Vagas e-MEC</th>
                <th scope="col"><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              @for (oferta of ofertas(); track oferta.id) {
                <tr>
                  <td data-label="Curso">{{ cursoLabel(oferta.cursoId) }}</td>
                  <td data-label="Local de oferta">{{ localOfertaLabel(oferta.localOfertaId) }}</td>
                  <td data-label="Unidade ofertante">
                    {{ oferta.unidadeOfertante.sigla }} — {{ oferta.unidadeOfertante.nome }}
                  </td>
                  <td data-label="Programa">
                    <span class="tag">{{ programaLabel(oferta.programaDeOferta) }}</span>
                  </td>
                  <td data-label="Formato">{{ formatoLabel(oferta.formatoPedagogico) }}</td>
                  <td data-label="Turno">{{ turnoLabel(oferta.turno) }}</td>
                  <td data-label="Vagas e-MEC">{{ oferta.vagasAnuaisAutorizadas ?? '—' }}</td>
                  <td class="table-responsive__actions" data-label="Ações">
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm btn--rect"
                      [disabled]="loading()"
                      (click)="abrirEdicao(oferta)"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm btn--rect"
                      [disabled]="loading()"
                      (click)="pedirRemocao(oferta)"
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
          heading="Nenhuma oferta de curso cadastrada"
          description="Cadastre a primeira oferta para vincular curso, local e unidade ofertante."
        >
          <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
            Nova oferta de curso
          </button>
        </ui-empty-state>
      }

      @if (prevCursor() !== null || nextCursor() !== null) {
        <ui-pager
          statusText="Navegação por páginas"
          navigationLabel="Paginação de ofertas de curso"
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
      ariaLabel="Formulário de oferta de curso"
      position="right"
    >
      @if (formError()) {
        <ui-alert variant="danger" heading="Não foi possível salvar">{{ formError() }}</ui-alert>
      }

      <form
        [formGroup]="form"
        id="cfg-oferta-curso-form"
        (ngSubmit)="salvar()"
        novalidate
        class="cfg-form"
      >
        <section aria-labelledby="cfg-oferta-vinculos">
          <h3 id="cfg-oferta-vinculos" class="form-section__title">Vínculos</h3>
          <div class="form-grid form-grid--1col">
            @if (modo() === 'criar') {
              <label class="field" [class.is-error]="erroDoCampo('cursoId')">
                <span class="field__label is-required">Curso</span>
                <select class="select" formControlName="cursoId">
                  <option value="" disabled>Selecione…</option>
                  @for (curso of cursosOpcoes(); track curso.id) {
                    <option [value]="curso.id">{{ curso.codigo }} — {{ curso.nome }}</option>
                  }
                </select>
                @if (cursoContexto()) {
                  <span class="field__hint">{{ cursoContexto() }}</span>
                }
                @if (cursosComErro()) {
                  <span class="field__error">
                    Não foi possível carregar os cursos.
                    <button type="button" class="cfg-link-button" (click)="recarregarCursos()">
                      Tentar novamente
                    </button>
                  </span>
                }
                @if (erroDoCampo('cursoId')) {
                  <span class="field__error">{{ erroDoCampo('cursoId') }}</span>
                }
              </label>
              <label class="field" [class.is-error]="erroDoCampo('localOfertaId')">
                <span class="field__label is-required">Local de oferta</span>
                <select class="select" formControlName="localOfertaId">
                  <option value="" disabled>Selecione…</option>
                  @for (local of locaisOfertaOpcoes(); track local.id) {
                    <option [value]="local.id">{{ localOfertaLabel(local.id) }}</option>
                  }
                </select>
                @if (localContexto()) {
                  <span class="field__hint">{{ localContexto() }}</span>
                }
                @if (locaisOfertaComErro()) {
                  <span class="field__error">
                    Não foi possível carregar os locais de oferta.
                    <button type="button" class="cfg-link-button" (click)="recarregarLocaisOferta()">
                      Tentar novamente
                    </button>
                  </span>
                }
                @if (erroDoCampo('localOfertaId')) {
                  <span class="field__error">{{ erroDoCampo('localOfertaId') }}</span>
                }
              </label>
              <label class="field" [class.is-error]="erroDoCampo('unidadeOfertanteOrigemId')">
                <span class="field__label is-required">Unidade ofertante</span>
                <select class="select" formControlName="unidadeOfertanteOrigemId">
                  <option value="" disabled>Selecione…</option>
                  @for (unidade of unidadesOpcoes(); track unidade.id) {
                    <option [value]="unidade.id">{{ unidade.sigla }} — {{ unidade.nome }}</option>
                  }
                </select>
                @if (unidadeContexto()) {
                  <span class="field__hint">{{ unidadeContexto() }}</span>
                }
                <span class="field__hint">
                  Congelada por snapshot-copy ao criar — alterações posteriores na unidade de
                  origem não afetam a oferta (ADR-0061).
                </span>
                @if (unidadesComErro()) {
                  <span class="field__error">
                    Não foi possível carregar as unidades.
                    <button type="button" class="cfg-link-button" (click)="recarregarUnidades()">
                      Tentar novamente
                    </button>
                  </span>
                }
                @if (erroDoCampo('unidadeOfertanteOrigemId')) {
                  <span class="field__error">{{ erroDoCampo('unidadeOfertanteOrigemId') }}</span>
                }
              </label>
            } @else {
              <div class="field">
                <span class="field__label">Curso</span>
                <p class="cfg-readonly-value">{{ cursoContexto() ?? cursoLabel(form.controls.cursoId.value) }}</p>
              </div>
              <div class="field">
                <span class="field__label">Local de oferta</span>
                <p class="cfg-readonly-value">{{ localOfertaLabel(form.controls.localOfertaId.value) }}</p>
              </div>
              <div class="field">
                <span class="field__label">Unidade ofertante</span>
                <p class="cfg-readonly-value">{{ unidadeOfertanteEmEdicaoLabel() }}</p>
                <span class="field__hint">
                  Identidade congelada no ato de criação (ADR-0061). Alterações na unidade de
                  origem não são refletidas aqui.
                </span>
              </div>
            }
          </div>
        </section>

        <section aria-labelledby="cfg-oferta-regime">
          <h3 id="cfg-oferta-regime" class="form-section__title">Regime de oferta</h3>
          <div class="form-grid">
            <label class="field" [class.is-error]="erroDoCampo('programaDeOferta')">
              <span class="field__label is-required">Programa de oferta</span>
              <select class="select" formControlName="programaDeOferta">
                @for (opcao of programaOptions; track opcao.value) {
                  <option [value]="opcao.value">{{ opcao.label }}</option>
                }
              </select>
              @if (erroDoCampo('programaDeOferta')) {
                <span class="field__error">{{ erroDoCampo('programaDeOferta') }}</span>
              }
            </label>
            <label class="field" [class.is-error]="erroDoCampo('formatoPedagogico')">
              <span class="field__label is-required">Formato pedagógico</span>
              <select class="select" formControlName="formatoPedagogico">
                @for (opcao of formatoOptions; track opcao.value) {
                  <option [value]="opcao.value">{{ opcao.label }}</option>
                }
              </select>
              @if (erroDoCampo('formatoPedagogico')) {
                <span class="field__error">{{ erroDoCampo('formatoPedagogico') }}</span>
              }
            </label>
            <label class="field" [class.is-error]="erroDoCampo('turno')">
              <span class="field__label">Turno</span>
              <select class="select" formControlName="turno">
                <option value="">(Sem turno)</option>
                @for (opcao of turnoOptions; track opcao.value) {
                  <option [value]="opcao.value">{{ opcao.label }}</option>
                }
              </select>
              @if (erroDoCampo('turno')) {
                <span class="field__error">{{ erroDoCampo('turno') }}</span>
              }
            </label>
            <label class="field" [class.is-error]="erroDoCampo('vagasAnuaisAutorizadas')">
              <span class="field__label">Vagas anuais autorizadas</span>
              <input
                class="input"
                type="number"
                min="0"
                step="1"
                formControlName="vagasAnuaisAutorizadas"
              />
              <span class="field__hint">Teto anual autorizado pelo e-MEC — não as vagas do certame.</span>
              @if (erroDoCampo('vagasAnuaisAutorizadas')) {
                <span class="field__error">{{ erroDoCampo('vagasAnuaisAutorizadas') }}</span>
              }
            </label>
          </div>
        </section>

        <section aria-labelledby="cfg-oferta-codigos">
          <h3 id="cfg-oferta-codigos" class="form-section__title">Códigos externos</h3>
          <div class="form-grid form-grid--pair">
            <label class="field" [class.is-error]="erroDoCampo('eMecCodigo')">
              <span class="field__label">Código e-MEC</span>
              <input class="input" type="text" inputmode="numeric" formControlName="eMecCodigo" />
              @if (erroDoCampo('eMecCodigo')) {
                <span class="field__error">{{ erroDoCampo('eMecCodigo') }}</span>
              }
            </label>
            <label class="field" [class.is-error]="erroDoCampo('codigoSga')">
              <span class="field__label">Código SGA</span>
              <input class="input" type="text" formControlName="codigoSga" />
              @if (erroDoCampo('codigoSga')) {
                <span class="field__error">{{ erroDoCampo('codigoSga') }}</span>
              }
            </label>
          </div>
        </section>

        @if (exigeBaseLegal()) {
          <fieldset
            class="form-section"
            aria-live="polite"
            aria-atomic="true"
            aria-labelledby="cfg-oferta-base-legal"
          >
            <legend id="cfg-oferta-base-legal" class="form-section__title">
              Base legal e ato autorizativo
              <span class="tag tag--warning">Base legal obrigatória</span>
            </legend>
            <div class="form-grid form-grid--1col">
              <label class="field" [class.is-error]="erroDoCampo('baseLegal')">
                <span class="field__label is-required">Base legal</span>
                <input
                  class="input"
                  type="text"
                  placeholder="Ex.: Convênio Forma Pará nº 004/2020"
                  formControlName="baseLegal"
                />
                <span class="field__hint">Norma do programa-mãe: tipo + número + ano.</span>
                @if (erroDoCampo('baseLegal')) {
                  <span class="field__error">{{ erroDoCampo('baseLegal') }}</span>
                }
              </label>
              <label class="field" [class.is-error]="erroDoCampo('atoAutorizacaoMec')">
                <span class="field__label">Ato de autorização (e-MEC)</span>
                <input
                  class="input"
                  type="text"
                  placeholder="Ex.: Portaria SERES/MEC nº 270/2021"
                  formControlName="atoAutorizacaoMec"
                />
                @if (erroDoCampo('atoAutorizacaoMec')) {
                  <span class="field__error">{{ erroDoCampo('atoAutorizacaoMec') }}</span>
                }
              </label>
            </div>
          </fieldset>
        }
      </form>

      <div class="cfg-form-footer">
        <button type="button" class="btn btn--tertiary btn--rect" (click)="formOpen.set(false)">
          Cancelar
        </button>
        <button
          type="submit"
          form="cfg-oferta-curso-form"
          class="btn btn--primary"
          [disabled]="saving()"
        >
          @if (saving()) {
            <ui-spinner size="sm" />
          }
          {{ saving() ? 'Salvando...' : modo() === 'criar' ? 'Criar oferta' : 'Salvar oferta' }}
        </button>
      </div>
    </ui-drawer>

    <ui-confirm-dialog
      [(visible)]="confirmOpen"
      heading="Remover oferta de curso"
      [message]="confirmMessage()"
      confirmLabel="Remover"
      confirmVariant="danger"
      (confirmed)="removerConfirmado()"
    />
  `,
})
export class OfertasCursoPage {
  private readonly api = inject(OfertasCursoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  private readonly organizacaoBasePath = inject(ORGANIZACAO_BASE_PATH);

  protected readonly programaOptions = PROGRAMAS_DE_OFERTA;
  protected readonly formatoOptions = FORMATOS_PEDAGOGICOS;
  protected readonly turnoOptions = TURNOS_OFERTA;

  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly modo = signal<ModoFormulario>('criar');
  protected readonly ofertaEmEdicao = signal<OfertaCursoDto | null>(null);
  protected readonly ofertaParaRemover = signal<OfertaCursoDto | null>(null);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());

  private readonly pagina = signal<
    { readonly cursor: Cursor; readonly direction: PaginationDirection } | undefined
  >(undefined);

  private readonly lista = useApiResource<readonly OfertaCursoDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/ofertas-curso`,
    params: this.montarParams(),
    context: withVendorMime('oferta-curso', 1),
  }));

  protected readonly loading = this.lista.isLoading;

  // Lookups de Curso e Local de oferta ficam sempre ativos (não lazy): a
  // própria listagem de ofertas precisa resolver os rótulos (o DTO só traz
  // `cursoId`/`localOfertaId`, sem nome aninhado — diferente da Unidade
  // ofertante, que já vem congelada por snapshot-copy no DTO da oferta).
  private readonly cursosResource = useApiResource<readonly CursoDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/cursos`,
    params: new HttpParams().set('limit', String(LOOKUP_LIMIT)),
    context: withVendorMime('curso', 1),
  }));
  protected readonly cursosOpcoes = computed(() => this.cursosResource.data() ?? []);
  protected readonly cursosComErro = computed(() => {
    const envelope = this.cursosResource.value();
    return (envelope !== undefined && !envelope.ok) || this.cursosResource.error() !== undefined;
  });
  private readonly cursosPorId = computed(
    () => new Map(this.cursosOpcoes().map((curso) => [curso.id, curso] as const)),
  );

  private readonly locaisOfertaResource = useApiResource<readonly LocalOfertaDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/locais-oferta`,
    params: new HttpParams().set('limit', String(LOOKUP_LIMIT)),
    context: withVendorMime('local-oferta', 1),
  }));
  protected readonly locaisOfertaOpcoes = computed(() => this.locaisOfertaResource.data() ?? []);
  protected readonly locaisOfertaComErro = computed(() => {
    const envelope = this.locaisOfertaResource.value();
    return (
      (envelope !== undefined && !envelope.ok) || this.locaisOfertaResource.error() !== undefined
    );
  });
  private readonly locaisOfertaPorId = computed(
    () => new Map(this.locaisOfertaOpcoes().map((local) => [local.id, local] as const)),
  );

  // Lookup de Unidade — cross-módulo (Organização, ADR-0056). Lazy: só usado
  // para popular o select de criação; a lista e a edição exibem o snapshot já
  // congelado em `oferta.unidadeOfertante`.
  private readonly carregarUnidades = signal(false);
  private readonly unidadesResource = useApiResource<readonly UnidadeDto[]>(() => {
    if (!this.carregarUnidades()) {
      return undefined;
    }
    return {
      url: `${this.organizacaoBasePath}/api/organizacao/unidades`,
      params: new HttpParams().set('limit', String(LOOKUP_LIMIT)),
      context: withVendorMime('unidade', 1),
    };
  });
  protected readonly unidadesOpcoes = computed(() => this.unidadesResource.data() ?? []);
  protected readonly unidadesComErro = computed(() => {
    const envelope = this.unidadesResource.value();
    return (envelope !== undefined && !envelope.ok) || this.unidadesResource.error() !== undefined;
  });
  private readonly unidadesPorId = computed(
    () => new Map(this.unidadesOpcoes().map((unidade) => [unidade.id, unidade] as const)),
  );

  private readonly cursores = linkedSignal<
    ApiResult<readonly OfertaCursoDto[]> | undefined,
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

  protected readonly ofertas = linkedSignal<
    ApiResult<readonly OfertaCursoDto[]> | undefined,
    readonly OfertaCursoDto[]
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

  protected readonly errorMessage = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar ofertas de curso.' : null;
  });

  protected readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Nova oferta de curso' : 'Editar oferta de curso',
  );

  protected readonly confirmMessage = computed(() => {
    const oferta = this.ofertaParaRemover();
    return oferta
      ? `Deseja remover esta oferta (${this.cursoLabel(oferta.cursoId)})? A remoção é lógica (soft-delete). Cópias já congeladas em quadros de vagas de processos publicados não são afetadas.`
      : 'Deseja remover esta oferta de curso?';
  });

  protected readonly form: FormGroup<OfertaCursoForm> = new FormGroup<OfertaCursoForm>({
    cursoId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    localOfertaId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    unidadeOfertanteOrigemId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    programaDeOferta: new FormControl(PROGRAMA_DE_OFERTA_REGULAR, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    formatoPedagogico: new FormControl('PRESENCIAL', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    turno: new FormControl('', { nonNullable: true }),
    eMecCodigo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(20)],
    }),
    codigoSga: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(30)],
    }),
    vagasAnuaisAutorizadas: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
    baseLegal: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    atoAutorizacaoMec: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(300)],
    }),
  });

  private readonly cursoIdValue = toSignal(this.form.controls.cursoId.valueChanges, {
    initialValue: this.form.controls.cursoId.value,
  });
  protected readonly cursoContexto = computed<string | null>(() => {
    const curso = this.cursosPorId().get(this.cursoIdValue());
    return curso ? `${curso.grau} · ${curso.nivelEnsino}` : null;
  });

  private readonly localOfertaIdValue = toSignal(this.form.controls.localOfertaId.valueChanges, {
    initialValue: this.form.controls.localOfertaId.value,
  });
  protected readonly localContexto = computed<string | null>(() => {
    const local = this.locaisOfertaPorId().get(this.localOfertaIdValue());
    return local ? `${local.cidade.nome} · ${this.tipoLocalLabel(local)}` : null;
  });

  private readonly unidadeIdValue = toSignal(
    this.form.controls.unidadeOfertanteOrigemId.valueChanges,
    { initialValue: this.form.controls.unidadeOfertanteOrigemId.value },
  );
  protected readonly unidadeContexto = computed<string | null>(() => {
    const unidade = this.unidadesPorId().get(this.unidadeIdValue());
    return unidade ? `${unidade.sigla} · ${unidade.nome} · ${unidade.tipo}` : null;
  });

  // Coerência Natureza/programa ↔ Base legal (ADR-0066): fora de REGULAR, a
  // base legal é obrigatória. `exigeBaseLegal` é só estado derivado; a
  // aplicação/remoção do Validators.required é side-effect no `effect` abaixo
  // (nunca dentro do `computed`).
  private readonly programaValue = toSignal(this.form.controls.programaDeOferta.valueChanges, {
    initialValue: this.form.controls.programaDeOferta.value,
  });
  protected readonly exigeBaseLegal = computed(
    () => this.programaValue() !== PROGRAMA_DE_OFERTA_REGULAR,
  );

  constructor() {
    effect(() => {
      const problem = this.lista.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });

    effect(() => {
      const exige = this.exigeBaseLegal();
      untracked(() => {
        const control = this.form.controls.baseLegal;
        if (exige) {
          control.addValidators(Validators.required);
        } else {
          // Diferente de `atoAutorizacaoMec` (dado factual independente do
          // programa — a API o expõe sem vínculo com REGULAR, e uma oferta
          // Regular pode legitimamente ter um ato de autorização registrado),
          // `baseLegal` só faz sentido para programas não-Regular; limpá-lo ao
          // voltar para REGULAR evita que um valor inválido (ex.: acima do
          // maxLength, digitado enquanto outro programa estava selecionado)
          // bloqueie o submit sem nenhum campo visível para corrigir.
          control.removeValidators(Validators.required);
          control.setValue('');
        }
        control.updateValueAndValidity({ emitEvent: false });
      });
    });
  }

  protected programaLabel(token: string): string {
    return PROGRAMAS_DE_OFERTA.find((p) => p.value === token)?.label ?? token;
  }

  protected formatoLabel(token: string): string {
    return FORMATOS_PEDAGOGICOS.find((f) => f.value === token)?.label ?? token;
  }

  protected turnoLabel(token: string | null): string {
    if (token === null) {
      return '—';
    }
    return TURNOS_OFERTA.find((t) => t.value === token)?.label ?? token;
  }

  protected cursoLabel(cursoId: string): string {
    const curso = this.cursosPorId().get(cursoId);
    return curso ? `${curso.codigo} — ${curso.nome}` : 'Vinculado';
  }

  protected localOfertaLabel(localOfertaId: string): string {
    const local = this.locaisOfertaPorId().get(localOfertaId);
    return local ? `${this.tipoLocalLabel(local)} — ${local.cidade.nome}` : 'Vinculado';
  }

  protected unidadeOfertanteEmEdicaoLabel(): string {
    const oferta = this.ofertaEmEdicao();
    if (oferta === null) {
      return '—';
    }
    return `${oferta.unidadeOfertante.sigla} · ${oferta.unidadeOfertante.nome} · ${oferta.unidadeOfertante.tipo}`;
  }

  private tipoLocalLabel(local: LocalOfertaDto): string {
    return TIPOS_LOCAL_OFERTA.find((t) => t.value === local.tipo)?.label ?? local.tipo;
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

  protected recarregarCursos(): void {
    this.cursosResource.reload();
  }

  protected recarregarLocaisOferta(): void {
    this.locaisOfertaResource.reload();
  }

  protected recarregarUnidades(): void {
    this.unidadesResource.reload();
  }

  protected abrirCadastro(): void {
    this.modo.set('criar');
    this.ofertaEmEdicao.set(null);
    this.form.reset({
      cursoId: '',
      localOfertaId: '',
      unidadeOfertanteOrigemId: '',
      programaDeOferta: PROGRAMA_DE_OFERTA_REGULAR,
      formatoPedagogico: 'PRESENCIAL',
      turno: '',
      eMecCodigo: '',
      codigoSga: '',
      vagasAnuaisAutorizadas: null,
      baseLegal: '',
      atoAutorizacaoMec: '',
    });
    this.form.controls.cursoId.enable();
    this.form.controls.localOfertaId.enable();
    this.form.controls.unidadeOfertanteOrigemId.enable();
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.carregarUnidades.set(true);
    this.formOpen.set(true);
  }

  protected abrirEdicao(oferta: OfertaCursoDto): void {
    this.modo.set('editar');
    this.ofertaEmEdicao.set(oferta);
    this.form.reset({
      cursoId: oferta.cursoId,
      localOfertaId: oferta.localOfertaId,
      unidadeOfertanteOrigemId: oferta.unidadeOfertante.origemId,
      programaDeOferta: oferta.programaDeOferta,
      formatoPedagogico: oferta.formatoPedagogico,
      turno: oferta.turno ?? '',
      eMecCodigo: oferta.eMecCodigo ?? '',
      codigoSga: oferta.codigoSga ?? '',
      vagasAnuaisAutorizadas: normalizarVagas(oferta.vagasAnuaisAutorizadas),
      baseLegal: oferta.baseLegal ?? '',
      atoAutorizacaoMec: oferta.atoAutorizacaoMec ?? '',
    });
    // Os 3 vínculos são imutáveis pós-criação (ADR-0066) — o command de
    // atualização não os aceita; desabilitar evita a falsa impressão de que
    // são editáveis (o rótulo read-only no template cobre a exibição).
    this.form.controls.cursoId.disable();
    this.form.controls.localOfertaId.disable();
    this.form.controls.unidadeOfertanteOrigemId.disable();
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  protected pedirRemocao(oferta: OfertaCursoDto): void {
    this.ofertaParaRemover.set(oferta);
    this.confirmOpen.set(true);
  }

  protected removerConfirmado(): void {
    const oferta = this.ofertaParaRemover();
    if (oferta === null || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.api
      .remover(oferta.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.saving.set(false);
        if (result.ok) {
          this.notifications.success('Oferta de curso removida');
          this.confirmOpen.set(false);
          this.ofertaParaRemover.set(null);
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

    const oferta = this.ofertaEmEdicao();
    this.api
      .atualizar(
        oferta?.id ?? '',
        this.atualizarCommand(oferta?.id ?? ''),
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result));
  }

  protected erroDoCampo(nome: keyof OfertaCursoForm): string | null {
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
    if (control.errors['min']) return 'Valor não pode ser negativo.';
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
        this.modo() === 'criar' ? 'Oferta de curso criada' : 'Oferta de curso atualizada',
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
    // DomainErrors únicos do backend (sem `errors[]`, que só existe no
    // pipeline FluentValidation/422) que se referem a um campo específico.
    const controlName = OFERTA_ERROR_CODE_TO_CONTROL.get(problem.code ?? '');
    if (controlName !== undefined) {
      this.renovarIdempotencyKey();
      const control = this.form.controls[controlName];
      control.setErrors({
        backend: { code: problem.code, message: this.problemI18n.resolve(problem).title },
      });
      control.markAsTouched();
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

  private criarCommand(): CriarOfertaCursoCommand {
    const raw = this.form.getRawValue();
    return {
      cursoId: raw.cursoId,
      localOfertaId: raw.localOfertaId,
      unidadeOfertanteOrigemId: raw.unidadeOfertanteOrigemId,
      programaDeOferta: raw.programaDeOferta,
      formatoPedagogico: raw.formatoPedagogico,
      turno: nullIfBlank(raw.turno),
      eMecCodigo: nullIfBlank(raw.eMecCodigo),
      codigoSga: nullIfBlank(raw.codigoSga),
      vagasAnuaisAutorizadas: raw.vagasAnuaisAutorizadas,
      baseLegal: nullIfBlank(raw.baseLegal),
      atoAutorizacaoMec: nullIfBlank(raw.atoAutorizacaoMec),
    };
  }

  // Os 3 vínculos são imutáveis pós-criação: o command de atualização não os
  // aceita (ver `AtualizarOfertaCursoCommand`, sem cursoId/localOfertaId/
  // unidadeOfertanteOrigemId).
  private atualizarCommand(id: string): AtualizarOfertaCursoCommand {
    const raw = this.form.getRawValue();
    return {
      id,
      programaDeOferta: raw.programaDeOferta,
      formatoPedagogico: raw.formatoPedagogico,
      turno: nullIfBlank(raw.turno),
      eMecCodigo: nullIfBlank(raw.eMecCodigo),
      codigoSga: nullIfBlank(raw.codigoSga),
      vagasAnuaisAutorizadas: raw.vagasAnuaisAutorizadas,
      baseLegal: nullIfBlank(raw.baseLegal),
      atoAutorizacaoMec: nullIfBlank(raw.atoAutorizacaoMec),
    };
  }
}

const OFERTA_CONTROL_NAMES: ReadonlySet<string> = new Set<keyof OfertaCursoForm>([
  'cursoId',
  'localOfertaId',
  'unidadeOfertanteOrigemId',
  'programaDeOferta',
  'formatoPedagogico',
  'turno',
  'eMecCodigo',
  'codigoSga',
  'vagasAnuaisAutorizadas',
  'baseLegal',
  'atoAutorizacaoMec',
]);

// DomainErrors únicos (409/422 sem `errors[]`) mapeados diretamente ao campo —
// ver `OfertaCursoErrorCodes`/`ConfiguracaoDomainErrorRegistration` (uniplus-api).
const OFERTA_ERROR_CODE_TO_CONTROL: ReadonlyMap<string, keyof OfertaCursoForm> = new Map([
  ['uniplus.configuracao.oferta_curso.curso_inexistente_ou_removido', 'cursoId'],
  ['uniplus.configuracao.oferta_curso.local_oferta_inexistente_ou_removido', 'localOfertaId'],
  ['uniplus.configuracao.oferta_curso.unidade_ofertante_inexistente', 'unidadeOfertanteOrigemId'],
  ['uniplus.configuracao.oferta_curso.programa_de_oferta_invalido', 'programaDeOferta'],
  ['uniplus.configuracao.oferta_curso.formato_pedagogico_invalido', 'formatoPedagogico'],
  ['uniplus.configuracao.oferta_curso.turno_invalido', 'turno'],
  [
    'uniplus.configuracao.oferta_curso.base_legal_obrigatoria_para_programa_nao_regular',
    'baseLegal',
  ],
  ['uniplus.configuracao.oferta_curso.vagas_anuais_negativas', 'vagasAnuaisAutorizadas'],
]);

function controlNameFromBackendField(field: string): keyof OfertaCursoForm | null {
  const normalized =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  const camelCase = normalized.charAt(0).toLocaleLowerCase('pt-BR') + normalized.slice(1);
  return OFERTA_CONTROL_NAMES.has(camelCase) ? (camelCase as keyof OfertaCursoForm) : null;
}

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// `vagasAnuaisAutorizadas` é `int32` no contrato, mas o `schema.ts` gerado
// tipa como `number | string | null` (mesmo padrão de `PesoAreaEnemDto`) — o
// form (`FormControl<number | null>`) preserva o valor mesmo quando o backend
// serializa como string.
function normalizarVagas(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined) {
    return null;
  }
  const numero = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(numero) ? numero : null;
}
