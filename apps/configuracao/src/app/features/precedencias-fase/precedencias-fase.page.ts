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
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { finalize, merge } from 'rxjs';
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
  CODIGOS_FASE_CANONICA,
  CONFIGURACAO_BASE_PATH,
  FasesCanonicasApi,
  PrecedenciaFaseDto,
  PrecedenciasFaseApi,
  type AtualizarPrecedenciaFaseCommand,
  type CriarPrecedenciaFaseCommand,
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

/**
 * Janela da listagem. Um DAG sobre as quatorze fases canônicas comporta no
 * máximo 91 arestas (14 × 13 ÷ 2), então o universo inteiro cabe em uma página
 * — a busca client-side abaixo é, na prática, global. O pager continua ligado
 * porque a navegação por cursor é contrato do endpoint (ADR-0026).
 */
const PAGE_SIZE = 100;

/** Vendor codes dos DomainErrors de PrecedenciaFase (uniplus-api, todos 422). */
const ERRO_SELF_LOOP = 'uniplus.configuracao.precedencia_fase.self_loop';
const ERRO_ARESTA_DUPLICADA = 'uniplus.configuracao.precedencia_fase.aresta_duplicada';
const ERRO_CICLO_DETECTADO = 'uniplus.configuracao.precedencia_fase.ciclo_detectado';
const ERRO_ANTECESSORA_FORA_CANONICO =
  'uniplus.configuracao.precedencia_fase.antecessora_fora_do_conjunto_canonico';
const ERRO_SUCESSORA_FORA_CANONICO =
  'uniplus.configuracao.precedencia_fase.sucessora_fora_do_conjunto_canonico';
const ERRO_NAO_ENCONTRADA = 'uniplus.configuracao.precedencia_fase.nao_encontrada';

/**
 * 409 emitido quando a chave ainda está reservada por uma execução em curso —
 * o backend pede retry com a **mesma** chave, porque o comando anterior pode
 * ter persistido antes de a resposta falhar. Renová-la aqui transformaria o
 * retry seguro em um comando novo.
 */
const ERRO_IDEMPOTENCIA_EM_PROCESSAMENTO = 'uniplus.idempotency.processing_conflict';

type ModoFormulario = 'criar' | 'editar';

interface PrecedenciaForm {
  antecessoraCodigo: FormControl<string>;
  sucessoraCodigo: FormControl<string>;
  permiteSobreposicao: FormControl<boolean>;
}

const PRECEDENCIA_CONTROL_NAMES: ReadonlySet<string> = new Set<keyof PrecedenciaForm>([
  'antecessoraCodigo',
  'sucessoraCodigo',
  'permiteSobreposicao',
]);

/**
 * Vendor code → controle que recebe a mensagem inline. Só entram aqui os erros
 * de um código isolado; os que dependem do par têm tratamento próprio (ver
 * `CODIGOS_ERRO_DO_PAR`) e `ciclo_detectado` fica de fora dos dois porque a
 * aresta que fecha um ciclo é inválida pelo grafo inteiro, não por um campo —
 * vira banner do formulário.
 */
const CODIGO_ERRO_PARA_CONTROLE: ReadonlyMap<string, keyof PrecedenciaForm> = new Map([
  [ERRO_SUCESSORA_FORA_CANONICO, 'sucessoraCodigo'],
  [ERRO_ANTECESSORA_FORA_CANONICO, 'antecessoraCodigo'],
]);

/**
 * Erros que qualificam o par, não um campo. Ficam fora de `setErrors` do
 * controle: preso à sucessora, o erro sobreviveria à correção feita na
 * antecessora — o Angular não revalida erros manuais de um irmão — e deixaria
 * o formulário travado com uma dupla que já mudou.
 */
const CODIGOS_ERRO_DO_PAR: ReadonlySet<string> = new Set([ERRO_SELF_LOOP, ERRO_ARESTA_DUPLICADA]);

/** Antecessora igual à sucessora — o backend recusa com 422; barramos antes. */
function selfLoopValidator(grupo: AbstractControl): ValidationErrors | null {
  const antecessora = grupo.get('antecessoraCodigo')?.value;
  const sucessora = grupo.get('sucessoraCodigo')?.value;
  if (!antecessora || !sucessora) {
    return null;
  }
  return antecessora === sucessora ? { selfLoop: true } : null;
}

@Component({
  selector: 'cfg-precedencias-fase-page',
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
        <h1 class="page-header__title">Precedência de Fase</h1>
        <p class="page-header__desc">
          Grafo de dependência entre as fases canônicas do cronograma — cada aresta diz que uma fase
          antecede outra · UNI-REQ-0064.
        </p>
      </div>
    </div>

    <ui-alert variant="info" heading="Dependência condicional" [dynamic]="false">
      Uma aresta só vale onde as duas fases coexistem no cronograma de um processo seletivo — a
      ausência de uma delas não é violação. O par de fases é a chave da aresta e não muda: para
      corrigi-lo, remova a aresta e crie outra.
    </ui-alert>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar as precedências">
        {{ errorMessage() }}
        <div class="cfg-precedencias-fase__retry">
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

    <section class="panel" aria-labelledby="cfg-precedencias-fase-list-title">
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 id="cfg-precedencias-fase-list-title">Arestas de precedência</h2>
          @if (loading()) {
            <span class="cfg-precedencias-fase__loading"><ui-spinner size="sm" /> Carregando</span>
          }
        </div>
        <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
          <i class="pi pi-plus btn__icon" aria-hidden="true"></i>
          Nova aresta
        </button>
      </div>

      <ui-filter-bar
        ariaLabel="Filtrar arestas de precedência"
        searchPlaceholder="Buscar por fase antecessora ou sucessora…"
        searchAriaLabel="Buscar por fase antecessora ou sucessora"
        [(searchValue)]="termoBusca"
      />

      @if (arestasFiltradas().length > 0) {
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th scope="col">Fase antecessora</th>
                <th scope="col">Fase sucessora</th>
                <th scope="col">Permite sobreposição</th>
                <th scope="col"><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              @for (aresta of arestasFiltradas(); track aresta.id) {
                <tr [attr.data-aresta]="aresta.antecessoraCodigo + '>' + aresta.sucessoraCodigo">
                  <td data-label="Fase antecessora">
                    <code>{{ aresta.antecessoraCodigo }}</code>
                    <span class="cfg-precedencias-fase__nome">{{
                      nomeDaFase(aresta.antecessoraCodigo)
                    }}</span>
                  </td>
                  <td data-label="Fase sucessora">
                    <code>{{ aresta.sucessoraCodigo }}</code>
                    <span class="cfg-precedencias-fase__nome">{{
                      nomeDaFase(aresta.sucessoraCodigo)
                    }}</span>
                  </td>
                  <td data-label="Permite sobreposição">
                    @if (aresta.permiteSobreposicao) {
                      <span class="tag tag--success">Sim</span>
                    } @else {
                      <span class="tag">Não</span>
                    }
                  </td>
                  <td class="table-responsive__actions" data-label="Ações">
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm btn--rect"
                      [disabled]="loading()"
                      (click)="abrirEdicao(aresta)"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      class="btn btn--tertiary btn--sm btn--rect"
                      [disabled]="loading() || removendo()"
                      (click)="pedirRemocao(aresta)"
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
            heading="Nenhuma aresta encontrada"
            description="Ajuste a busca para ver resultados."
          >
            <button type="button" class="btn btn--secondary" (click)="limparFiltros()">
              Limpar busca
            </button>
          </ui-empty-state>
        } @else {
          <ui-empty-state
            heading="Nenhuma aresta de precedência cadastrada"
            description="Cadastre a primeira aresta para descrever a ordem entre as fases do cronograma."
          >
            <button type="button" class="btn btn--primary" (click)="abrirCadastro()">
              Nova aresta
            </button>
          </ui-empty-state>
        }
      }

      @if (prevCursor() !== null || nextCursor() !== null) {
        <ui-pager
          statusText="Navegação por páginas"
          navigationLabel="Paginação de arestas de precedência"
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
      ariaLabel="Formulário de aresta de precedência"
      position="right"
    >
      @if (formError()) {
        <ui-alert variant="danger" heading="Não foi possível salvar">{{ formError() }}</ui-alert>
      }

      @if (falhaAoCarregarFases()) {
        <ui-alert variant="warning" heading="Nomes das fases indisponíveis">
          Não foi possível consultar o cadastro de Fase Canônica agora, então as opções aparecem só
          com o código. O cadastro da aresta continua disponível.
        </ui-alert>
      }

      <form
        [formGroup]="form"
        id="cfg-precedencia-fase-form"
        (ngSubmit)="salvar()"
        novalidate
        class="cfg-form"
      >
        <section aria-labelledby="cfg-precedencia-par">
          <h3 id="cfg-precedencia-par" class="form-section__title">Par de fases</h3>
          <div class="form-grid form-grid--1col">
            @if (modo() === 'criar') {
              <label class="field" [class.is-error]="erroDoCampo('antecessoraCodigo')">
                <span class="field__label is-required">Fase antecessora</span>
                <select
                  id="cfg-precedencia-antecessora"
                  class="select"
                  formControlName="antecessoraCodigo"
                  aria-describedby="cfg-precedencia-antecessora-hint"
                  [attr.aria-invalid]="erroDoCampo('antecessoraCodigo') ? 'true' : null"
                >
                  <option value="" disabled>Selecione a fase antecessora</option>
                  @for (opcao of opcoesDeFase(); track opcao.codigo) {
                    <option [value]="opcao.codigo">{{ opcao.rotulo }}</option>
                  }
                </select>
                <span id="cfg-precedencia-antecessora-hint" class="field__hint">
                  Fase que precede. Imutável após a criação.
                </span>
                @if (erroDoCampo('antecessoraCodigo')) {
                  <span class="field__error" role="alert">{{
                    erroDoCampo('antecessoraCodigo')
                  }}</span>
                }
              </label>
            } @else {
              <label class="field">
                <span class="field__label is-required">Fase antecessora</span>
                <input
                  id="cfg-precedencia-antecessora"
                  class="input"
                  type="text"
                  formControlName="antecessoraCodigo"
                  readonly
                  aria-describedby="cfg-precedencia-antecessora-hint"
                />
                <span id="cfg-precedencia-antecessora-hint" class="field__hint">
                  O par de fases é a chave da aresta e não muda.
                </span>
              </label>
            }

            @if (modo() === 'criar') {
              <label class="field" [class.is-error]="erroDoCampo('sucessoraCodigo')">
                <span class="field__label is-required">Fase sucessora</span>
                <select
                  id="cfg-precedencia-sucessora"
                  class="select"
                  formControlName="sucessoraCodigo"
                  aria-describedby="cfg-precedencia-sucessora-hint"
                  [attr.aria-invalid]="erroDoCampo('sucessoraCodigo') ? 'true' : null"
                >
                  <option value="" disabled>Selecione a fase sucessora</option>
                  @for (opcao of opcoesDeFase(); track opcao.codigo) {
                    <option [value]="opcao.codigo">{{ opcao.rotulo }}</option>
                  }
                </select>
                <span id="cfg-precedencia-sucessora-hint" class="field__hint">
                  Fase que sucede. Não pode ser igual à antecessora.
                </span>
                @if (erroDoCampo('sucessoraCodigo')) {
                  <span class="field__error" role="alert">{{
                    erroDoCampo('sucessoraCodigo')
                  }}</span>
                }
              </label>
            } @else {
              <label class="field">
                <span class="field__label is-required">Fase sucessora</span>
                <input
                  id="cfg-precedencia-sucessora"
                  class="input"
                  type="text"
                  formControlName="sucessoraCodigo"
                  readonly
                  aria-describedby="cfg-precedencia-sucessora-hint"
                />
                <span id="cfg-precedencia-sucessora-hint" class="field__hint">
                  O par de fases é a chave da aresta e não muda.
                </span>
              </label>
            }
          </div>
        </section>

        <fieldset class="form-section">
          <legend class="form-section__title">Sobreposição</legend>
          <label class="field">
            <span class="field__label">Permite sobreposição</span>
            <select
              id="cfg-precedencia-sobreposicao"
              class="select"
              formControlName="permiteSobreposicao"
              aria-describedby="cfg-precedencia-sobreposicao-hint"
            >
              <option [ngValue]="true">Sim</option>
              <option [ngValue]="false">Não</option>
            </select>
            <span id="cfg-precedencia-sobreposicao-hint" class="field__hint">
              Define se as duas fases podem coexistir no tempo. O padrão é não sobrepor.
            </span>
          </label>
        </fieldset>
      </form>

      <div class="cfg-form-footer">
        <button
          type="button"
          class="btn btn--tertiary btn--rect"
          [disabled]="saving()"
          (click)="fecharFormulario()"
        >
          Cancelar
        </button>
        <button
          type="submit"
          form="cfg-precedencia-fase-form"
          class="btn btn--primary"
          [disabled]="saving()"
        >
          @if (saving()) {
            <ui-spinner size="sm" />
          }
          {{ saving() ? 'Salvando...' : modo() === 'criar' ? 'Criar aresta' : 'Salvar aresta' }}
        </button>
      </div>
    </ui-drawer>

    <ui-confirm-dialog
      [(visible)]="confirmOpen"
      heading="Remover aresta de precedência"
      [message]="confirmMessage()"
      confirmLabel="Remover"
      confirmVariant="danger"
      (confirmed)="removerConfirmado()"
    />
  `,
  host: { class: 'cfg-page' },
})
export class PrecedenciasFasePage {
  private readonly api = inject(PrecedenciasFaseApi);
  private readonly fasesApi = inject(FasesCanonicasApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  protected readonly saving = signal(false);
  /** Remoção tem estado próprio: não é bloqueada por uma gravação de formulário. */
  protected readonly removendo = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly formError = signal<string | null>(null);
  /** Mensagem de erro que qualifica o par, exibida no campo Fase sucessora. */
  protected readonly erroDoPar = signal<string | null>(null);
  protected readonly modo = signal<ModoFormulario>('criar');
  protected readonly arestaEmEdicaoId = signal<string | null>(null);
  protected readonly arestaParaRemover = signal<PrecedenciaFaseDto | null>(null);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());
  protected readonly termoBusca = signal('');

  /**
   * Nomes das fases canônicas cadastradas, por código. Só enriquece a
   * apresentação: o domínio fechado das opções é o roster canônico, que o
   * backend valida contra `FaseCanonicaCatalogo` — não contra este cadastro.
   */
  private readonly fases = lookupCompleto(
    (cursor) => this.fasesApi.listar({ cursor, direction: 'next', limit: API_MAX_PAGE_SIZE }),
    this.destroyRef,
  );
  private readonly nomesDasFases = computed(
    () => new Map(this.fases.opcoes().map((fase) => [fase.codigo, fase.nome])),
  );
  /**
   * A falha é sinalizada à parte para não se confundir com o erro da lista
   * principal: sem os nomes, as opções ainda aparecem, só que pelo código.
   */
  protected readonly falhaAoCarregarFases = this.fases.comErro;

  /**
   * Identifica a abertura de formulário que originou uma mutação. A resposta
   * chega depois e só pode mexer na UI se o contexto ainda for o mesmo — sem
   * isso, salvar A, fechar e abrir B faria a resposta de A fechar o drawer de B.
   */
  private readonly contextoDaAbertura = signal(0);

  private readonly pagina = signal<
    { readonly cursor: Cursor; readonly direction: PaginationDirection } | undefined
  >(undefined);

  private readonly lista = useApiResource<readonly PrecedenciaFaseDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/precedencias-fase`,
    params: this.montarParams(),
    context: withVendorMime('precedencia-fase', 1),
  }));

  protected readonly loading = this.lista.isLoading;

  private readonly cursores = linkedSignal<
    ApiResult<readonly PrecedenciaFaseDto[]> | undefined,
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

  protected readonly arestas = linkedSignal<
    ApiResult<readonly PrecedenciaFaseDto[]> | undefined,
    readonly PrecedenciaFaseDto[]
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

  // Busca client-side: o endpoint só aceita cursor/limit/direction, sem filtro
  // de texto. Como a janela (PAGE_SIZE) cobre o máximo de arestas possível no
  // grafo, o filtro alcança todo o cadastro.
  protected readonly arestasFiltradas = computed(() => {
    const termo = this.termoBusca().trim().toLocaleLowerCase('pt-BR');
    if (termo.length === 0) {
      return this.arestas();
    }
    return this.arestas().filter((aresta) => {
      const nomes = this.nomesDasFases();
      const alvos = [
        aresta.antecessoraCodigo,
        aresta.sucessoraCodigo,
        nomes.get(aresta.antecessoraCodigo) ?? '',
        nomes.get(aresta.sucessoraCodigo) ?? '',
      ];
      return alvos.some((alvo) => alvo.toLocaleLowerCase('pt-BR').includes(termo));
    });
  });

  protected readonly temFiltro = computed(() => this.termoBusca().trim().length > 0);

  /**
   * Opções dos selects: o roster canônico completo, porque é contra ele que o
   * backend valida. Fases ainda não cadastradas continuam selecionáveis e são
   * marcadas como tal — restringir ao cadastro faria a tela recusar arestas que
   * a API aceita, e o próprio seed do backend já cria arestas antes de as fases
   * existirem no cadastro.
   */
  protected readonly opcoesDeFase = computed(() => {
    const nomes = this.nomesDasFases();
    return CODIGOS_FASE_CANONICA.map((codigo) => {
      const nome = nomes.get(codigo);
      if (nome !== undefined) {
        return { codigo, rotulo: `${codigo} — ${nome}` };
      }
      return {
        codigo,
        rotulo: this.falhaAoCarregarFases() ? codigo : `${codigo} — (não cadastrada)`,
      };
    });
  });

  protected readonly errorMessage = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar as precedências de fase.' : null;
  });

  protected readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Nova aresta de precedência' : 'Editar aresta',
  );

  protected readonly confirmMessage = computed(() => {
    const aresta = this.arestaParaRemover();
    return aresta
      ? `Deseja remover a aresta de ${aresta.antecessoraCodigo} para ${aresta.sucessoraCodigo}? Cronogramas já publicados não são afetados — a ordem vigente neles foi congelada por snapshot no momento da publicação.`
      : 'Deseja remover esta aresta de precedência?';
  });

  protected readonly form: FormGroup<PrecedenciaForm> = new FormGroup<PrecedenciaForm>(
    {
      antecessoraCodigo: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      sucessoraCodigo: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      permiteSobreposicao: new FormControl(false, { nonNullable: true }),
    },
    { validators: selfLoopValidator },
  );

  constructor() {
    effect(() => {
      const problem = this.lista.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });

    // O erro do par deixa de valer assim que qualquer um dos dois lados muda.
    merge(
      this.form.controls.antecessoraCodigo.valueChanges,
      this.form.controls.sucessoraCodigo.valueChanges,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.erroDoPar.set(null));

    this.fases.recarregar();
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

  protected fecharFormulario(): void {
    if (!this.saving()) {
      this.formOpen.set(false);
    }
  }

  protected abrirCadastro(): void {
    this.modo.set('criar');
    this.arestaEmEdicaoId.set(null);
    this.form.reset({ antecessoraCodigo: '', sucessoraCodigo: '', permiteSobreposicao: false });
    this.formError.set(null);
    this.erroDoPar.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.contextoDaAbertura.update((contexto) => contexto + 1);
    this.formOpen.set(true);
  }

  protected abrirEdicao(aresta: PrecedenciaFaseDto): void {
    this.modo.set('editar');
    this.arestaEmEdicaoId.set(aresta.id);
    this.form.reset({
      antecessoraCodigo: aresta.antecessoraCodigo,
      sucessoraCodigo: aresta.sucessoraCodigo,
      permiteSobreposicao: aresta.permiteSobreposicao,
    });
    this.formError.set(null);
    this.erroDoPar.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.contextoDaAbertura.update((contexto) => contexto + 1);
    this.formOpen.set(true);
  }

  protected pedirRemocao(aresta: PrecedenciaFaseDto): void {
    this.arestaParaRemover.set(aresta);
    this.confirmOpen.set(true);
  }

  protected removerConfirmado(): void {
    const aresta = this.arestaParaRemover();
    if (aresta === null || this.removendo()) {
      return;
    }
    this.removendo.set(true);
    this.api
      .remover(aresta.id)
      .pipe(
        finalize(() => this.removendo.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result.ok) {
          this.notifications.success(
            'Aresta removida',
            `${aresta.antecessoraCodigo} → ${aresta.sucessoraCodigo}`,
          );
          this.confirmOpen.set(false);
          this.arestaParaRemover.set(null);
          this.recarregar();
          return;
        }
        // Removida por outro administrador entre a leitura e a confirmação: a
        // linha já não existe, então fechar o modal e recarregar deixa a tela
        // coerente em vez de insistir num alvo inexistente.
        if (result.problem.code === ERRO_NAO_ENCONTRADA || result.problem.status === 404) {
          this.confirmOpen.set(false);
          this.arestaParaRemover.set(null);
          this.recarregar();
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
      this.focarPrimeiroCampoInvalido();
      return;
    }
    this.formError.set(null);
    this.erroDoPar.set(null);

    const contexto = this.contextoDaAbertura();
    const criando = this.modo() === 'criar';
    // O payload é montado antes de congelar, e o congelamento impede que o
    // formulário mude sob a request — sem isso, a resposta de uma dupla
    // chegaria sobre outra dupla já digitada na tela.
    const command = criando ? this.criarCommand() : this.atualizarCommand();
    this.iniciarGravacao();

    if (criando) {
      this.api
        .criar(
          command as CriarPrecedenciaFaseCommand,
          withIdempotencyKey(this.idempotencyKeyAtual()),
        )
        .pipe(
          finalize(() => this.encerrarGravacao()),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((result) => this.handleSalvarResult(result, contexto));
      return;
    }

    this.api
      .atualizar(
        this.arestaEmEdicaoId() ?? '',
        command as AtualizarPrecedenciaFaseCommand,
        withIdempotencyKey(this.idempotencyKeyAtual()),
      )
      .pipe(
        finalize(() => this.encerrarGravacao()),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => this.handleSalvarResult(result, contexto));
  }

  private iniciarGravacao(): void {
    this.saving.set(true);
    this.form.disable({ emitEvent: false });
  }

  /**
   * Idempotente de propósito: é chamado no início do tratamento da resposta,
   * para que os erros do backend sejam aplicados sobre um formulário já
   * reabilitado, e de novo pelo `finalize` como rede de segurança. Sem a
   * guarda, o segundo `enable()` revalidaria o formulário e apagaria os erros
   * que o primeiro caminho acabou de gravar.
   */
  private encerrarGravacao(): void {
    if (this.form.disabled) {
      this.form.enable({ emitEvent: false });
    }
    this.saving.set(false);
  }

  protected erroDoCampo(nome: keyof PrecedenciaForm): string | null {
    // Erros do par são exibidos na sucessora, que é o campo escolhido por
    // último. O do backend nasce de um envio explícito, então não depende de o
    // campo ter sido tocado.
    if (nome === 'sucessoraCodigo') {
      const erroPar = this.erroDoPar();
      if (erroPar !== null) {
        return erroPar;
      }
    }
    const control = this.form.controls[nome];
    const shouldShowError = control.touched || control.dirty;
    if (!shouldShowError) {
      return null;
    }
    if (nome === 'sucessoraCodigo' && this.form.hasError('selfLoop')) {
      return 'A fase sucessora não pode ser igual à antecessora.';
    }
    if (control.errors === null) {
      return null;
    }
    if (control.errors['backend']) {
      const backend = control.errors['backend'] as { code: string; message: string };
      return backend.message;
    }
    if (control.errors['required']) return 'Campo obrigatório.';
    return 'Valor inválido.';
  }

  protected nomeDaFase(codigo: string): string {
    return this.nomesDasFases().get(codigo) ?? '';
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

  private handleSalvarResult(result: ApiResult<string | void>, contexto: number): void {
    // Reabilita antes de qualquer `setErrors`: `enable()` revalida e apagaria
    // os erros do backend se viesse depois.
    this.encerrarGravacao();
    if (result.ok) {
      // Efeitos de UI só valem para a abertura que originou a request.
      if (contexto === this.contextoDaAbertura()) {
        this.notifications.success(this.modo() === 'criar' ? 'Aresta criada' : 'Aresta atualizada');
        this.formOpen.set(false);
        this.idempotencyKeyAtual.set(idempotencyKey.create());
      }
      this.recarregar();
      return;
    }
    if (contexto === this.contextoDaAbertura()) {
      this.aplicarFalha(result.problem);
    }
  }

  private aplicarFalha(problem: ProblemDetails): void {
    // Falha corrigível renova a chave: o filtro de idempotência guarda a
    // resposta de qualquer status abaixo de 500, então reenviar o formulário
    // corrigido com a chave anterior devolveria `body_mismatch` em vez de
    // processar o novo comando. A exceção é o conflito de processamento, em
    // que a execução anterior ainda pode concluir e o retry precisa continuar
    // sendo o mesmo comando.
    if (
      problem.code !== ERRO_IDEMPOTENCIA_EM_PROCESSAMENTO &&
      (problem.status === 422 || problem.status === 409)
    ) {
      this.renovarIdempotencyKey();
    }

    // O drawer pode ter sido fechado durante a gravação — o botão Cancelar
    // respeita `saving`, mas o X do cabeçalho e o Esc do `<dialog>` não. Com o
    // formulário fora da tela, erro de campo e banner não seriam vistos por
    // ninguém, então a falha vira notificação.
    if (!this.formOpen()) {
      this.notifications.errorFromProblem(problem, {
        title: this.problemI18n.resolve(problem).title,
      });
      this.recarregar();
      return;
    }

    // A aresta sumiu entre abrir o formulário e salvar.
    if (problem.code === ERRO_NAO_ENCONTRADA || problem.status === 404) {
      this.formOpen.set(false);
      this.notifications.errorFromProblem(problem, {
        title: this.problemI18n.resolve(problem).title,
      });
      this.recarregar();
      return;
    }

    // DomainError não traz `errors[]` (só o pipeline de validação traz), então
    // os erros de grafo são reconhecidos pelo `code`.
    if (CODIGOS_ERRO_DO_PAR.has(problem.code)) {
      this.erroDoPar.set(this.problemI18n.resolve(problem).title);
      this.form.controls.sucessoraCodigo.markAsTouched();
      this.focarCampo('sucessoraCodigo');
      return;
    }

    const controle = CODIGO_ERRO_PARA_CONTROLE.get(problem.code);
    if (controle !== undefined) {
      this.form.controls[controle].setErrors({
        backend: { code: problem.code, message: this.problemI18n.resolve(problem).title },
      });
      this.form.controls[controle].markAsTouched();
      this.focarCampo(controle);
      return;
    }

    // O ciclo não pertence a um campo: é o grafo inteiro que recusa a aresta.
    if (problem.code === ERRO_CICLO_DETECTADO) {
      this.formError.set(this.problemI18n.resolve(problem).title);
      return;
    }

    if (problem.status === 422 && problem.errors && problem.errors.length > 0) {
      this.aplicarErrosDeValidacao(problem.errors);
      return;
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
    let primeiro: keyof PrecedenciaForm | null = null;
    for (const erro of errors) {
      const controlName = controlNameFromBackendField(erro.field);
      if (controlName === null) continue;
      const control = this.form.controls[controlName];
      control.setErrors({ backend: { code: erro.code, message: erro.message } });
      control.markAsTouched();
      aplicouAlgum = true;
      primeiro ??= controlName;
    }

    if (aplicouAlgum) {
      this.formError.set(null);
      if (primeiro !== null) {
        this.focarCampo(primeiro);
      }
      return;
    }
    this.formError.set('Não foi possível mapear os erros de validação. Revise os campos.');
  }

  private focarPrimeiroCampoInvalido(): void {
    if (this.form.controls.antecessoraCodigo.invalid) {
      this.focarCampo('antecessoraCodigo');
      return;
    }
    this.focarCampo('sucessoraCodigo');
  }

  private focarCampo(nome: keyof PrecedenciaForm): void {
    if (typeof document === 'undefined') {
      return;
    }
    const id =
      nome === 'antecessoraCodigo'
        ? 'cfg-precedencia-antecessora'
        : nome === 'sucessoraCodigo'
          ? 'cfg-precedencia-sucessora'
          : 'cfg-precedencia-sobreposicao';
    queueMicrotask(() => document.getElementById(id)?.focus());
  }

  private criarCommand(): CriarPrecedenciaFaseCommand {
    // Projeção explícita: nunca repassar `getRawValue()` nem espalhar o objeto
    // do formulário, para que um campo novo no form não vaze para o payload.
    const raw = this.form.getRawValue();
    return {
      antecessoraCodigo: nullIfBlank(raw.antecessoraCodigo),
      sucessoraCodigo: nullIfBlank(raw.sucessoraCodigo),
      permiteSobreposicao: raw.permiteSobreposicao,
    };
  }

  private atualizarCommand(): AtualizarPrecedenciaFaseCommand {
    // O par de fases é imutável: o comando de atualização só transporta o
    // sinalizador de sobreposição, mesmo que o formulário ainda os exiba.
    const raw = this.form.getRawValue();
    return {
      id: this.arestaEmEdicaoId() ?? '',
      permiteSobreposicao: raw.permiteSobreposicao,
    };
  }
}

function controlNameFromBackendField(field: string): keyof PrecedenciaForm | null {
  const normalized =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  const camelCase = normalized.charAt(0).toLocaleLowerCase('pt-BR') + normalized.slice(1);
  return PRECEDENCIA_CONTROL_NAMES.has(camelCase) ? (camelCase as keyof PrecedenciaForm) : null;
}

function nullIfBlank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
