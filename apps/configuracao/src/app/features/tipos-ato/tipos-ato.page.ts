import { HttpParams } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import {
  ApiResult,
  Cursor,
  CursorPagina,
  ProblemDetails,
  ProblemI18nService,
  ProblemValidationError,
  STATUS_HTTP,
  cursorToString,
  deveRotacionarIdempotencyKey,
  ehCursorDePaginacaoExpirado,
  extractNextCursor,
  extractPrevCursor,
  idempotencyKey,
  useApiResource,
  useCursorObsoletoRecovery,
  withIdempotencyKey,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  PUBLICACOES_BASE_PATH,
  TipoAtoPublicadoDto,
  TiposAtoApi,
  type AtualizarTipoAtoPublicadoCommand,
  type CriarTipoAtoPublicadoCommand,
} from '@uniplus/shared-data/publicacoes';
import { formatIsoDateBr } from '@uniplus/shared-data/utils';
import {
  AlertComponent,
  ConfirmDialogComponent,
  DrawerComponent,
  EmptyStateComponent,
  FilterBarComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { controlNameFromBackendField, nullIfBlank } from '../../shared/formulario';

/**
 * Janela de cada página (cursor pagination, ADR-0026), no teto que a API aceita.
 * Acima dele a resposta é 422. O teto importa aqui porque a busca é local: o
 * contrato da listagem não tem parâmetro de texto, então quanto mais linhas a
 * página traz, menos casos sobram em que a busca não alcança o catálogo todo.
 */
const PAGE_SIZE = 100;

const VIGENCIA_SOBREPOSTA = 'uniplus.publicacoes.tipo_ato.vigencia_sobreposta';

const SINALIZADORES = [
  {
    controle: 'ehResultado',
    rotulo: 'Determina a situação do candidato',
    ajuda:
      'Habilita o ciclo recursal: só um ato assim pode ser publicação preliminar, e sem uma ' +
      'preliminar a etapa não admite recurso.',
  },
  {
    controle: 'congelaConfiguracao',
    rotulo: 'Congela a configuração',
    ajuda: 'O ato produz nova versão congelada. Publicar e retificar exigem um tipo congelante.',
  },
  {
    controle: 'unicoPorObjeto',
    rotulo: 'Único por objeto',
    ajuda: 'O objeto admite um só ato vivo deste tipo.',
  },
  {
    controle: 'efeitoIrreversivel',
    rotulo: 'Efeito irreversível',
    ajuda: 'A publicação não pode ser desfeita.',
  },
] as const satisfies readonly { controle: keyof AtoForm; rotulo: string; ajuda: string }[];

interface AtoForm {
  codigo: FormControl<string>;
  nome: FormControl<string>;
  vigenciaInicio: FormControl<string>;
  vigenciaFim: FormControl<string>;
  congelaConfiguracao: FormControl<boolean>;
  unicoPorObjeto: FormControl<boolean>;
  efeitoIrreversivel: FormControl<boolean>;
  ehResultado: FormControl<boolean>;
  baseLegal: FormControl<string>;
}

const ATO_CONTROL_NAMES: ReadonlySet<string> = new Set<keyof AtoForm>([
  'codigo',
  'nome',
  'vigenciaInicio',
  'vigenciaFim',
  'congelaConfiguracao',
  'unicoPorObjeto',
  'efeitoIrreversivel',
  'ehResultado',
  'baseLegal',
]);

@Component({
  selector: 'cfg-tipos-ato-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ConfirmDialogComponent,
    DrawerComponent,
    EmptyStateComponent,
    FilterBarComponent,
    IconButtonComponent,
    PagerComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Tipo de Ato</h1>
        <p class="page-header__desc">
          Vocabulário de publicação — os tipos de ato que um processo seletivo pode publicar, e o
          que cada um determina.
        </p>
      </div>
      <div class="page-header__actions">
        <button
          type="button"
          class="btn btn--primary"
          [disabled]="saving()"
          (click)="abrirCriacao()"
        >
          Cadastrar tipo de ato
        </button>
      </div>
    </div>

    <ui-alert
      variant="info"
      heading="Um tipo por vigência, e o código agrupa a série"
      [dynamic]="false"
    >
      Cada linha é uma <strong>vigência</strong> de um código, e o código não muda depois de criado:
      para alterar o que um tipo significa a partir de certa data, cadastre uma vigência nova e
      encerre a anterior. Duas vigências do mesmo código não podem se sobrepor. A data de fim é o
      <strong>primeiro dia sem validade</strong>: uma vigência que termina em 30/06 já não vale no
      dia 30.
    </ui-alert>

    @if (errorMessage()) {
      <ui-alert variant="danger" heading="Não foi possível carregar os tipos de ato">
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

    <section class="panel" aria-labelledby="cfg-tipos-ato-list-title">
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 id="cfg-tipos-ato-list-title">Tipos de ato</h2>
          @if (loading()) {
            <span class="cfg-list__loading"><ui-spinner size="sm" /> Carregando</span>
          }
        </div>
      </div>

      <ui-filter-bar
        ariaLabel="Filtrar tipos de ato"
        searchPlaceholder="Buscar por código ou nome…"
        searchAriaLabel="Buscar tipos de ato"
        [(searchValue)]="termoBusca"
      />

      @if (buscaLimitadaAPagina()) {
        <p class="field__hint cfg-tipos-ato__historico" role="status">
          O catálogo tem mais de uma página e a busca alcança só a que está carregada — navegue
          pelas páginas para procurar no restante.
        </p>
      }

      <div class="field cfg-tipos-ato__historico">
        <label class="checkbox">
          <input
            type="checkbox"
            [checked]="somenteEmVigor()"
            (change)="alternarSomenteEmVigor()"
            aria-describedby="cfg-ato-em-vigor-ajuda"
          />
          <span class="checkbox__box" aria-hidden="true"></span>
          Mostrar apenas as vigências em vigor hoje
        </label>
        <span class="field__hint" id="cfg-ato-em-vigor-ajuda">
          Por padrão a lista traz a série completa de cada código — o que já terminou e o que ainda
          vai começar.
        </span>
      </div>

      @if (atosFiltrados().length > 0) {
        <div class="table-responsive">
          <table>
            <caption class="sr-only">
              Tipos de ato publicáveis, com vigência e o que cada um determina
            </caption>
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Nome</th>
                <th scope="col">Vigência</th>
                <th scope="col">Resultado</th>
                <th scope="col"><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              @for (ato of atosFiltrados(); track ato.id) {
                <tr>
                  <td data-label="Código">
                    <code>{{ ato.codigo }}</code>
                  </td>
                  <td data-label="Nome">{{ ato.nome }}</td>
                  <td data-label="Vigência">{{ periodo(ato) }}</td>
                  <td data-label="Resultado">
                    <span [class]="ato.ehResultado ? 'tag tag--success' : 'tag'">
                      {{ ato.ehResultado ? 'Sim' : 'Não' }}
                    </span>
                  </td>
                  <td class="table-responsive__actions cfg-tipos-ato__acoes" data-label="Ações">
                    <ui-icon-button
                      icon="pi-pencil"
                      [accessibleName]="'Editar tipo de ato ' + identificacaoDaVigencia(ato)"
                      tooltip="Editar tipo de ato"
                      [isDisabled]="loading() || saving()"
                      (triggered)="abrirEdicao(ato)"
                    />
                    <ui-icon-button
                      icon="pi-trash"
                      [accessibleName]="'Remover vigência do tipo de ato ' + identificacaoDaVigencia(ato)"
                      tooltip="Remover esta vigência"
                      [isDisabled]="loading() || saving()"
                      (triggered)="pedirRemocao(ato)"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (!loading() && !errorMessage()) {
        @if (temFiltro()) {
          <ui-empty-state
            heading="Nenhum tipo de ato encontrado"
            [description]="
              buscaLimitadaAPagina()
                ? 'A busca alcança só a página carregada — ajuste o termo ou navegue pelas páginas.'
                : 'Ajuste os filtros para ver resultados.'
            "
          >
            <button type="button" class="btn btn--secondary" (click)="limparFiltros()">
              Limpar filtros
            </button>
          </ui-empty-state>
        } @else {
          <ui-empty-state
            heading="Nenhum tipo de ato cadastrado"
            description="Sem tipo de ato, um processo seletivo não consegue declarar o que publica — nem o resultado contra o qual cabe recurso."
          >
            <button
              type="button"
              class="btn btn--primary"
              [disabled]="saving()"
              (click)="abrirCriacao()"
            >
              Cadastrar tipo de ato
            </button>
          </ui-empty-state>
        }
      }

      @if (prevCursor() !== null || nextCursor() !== null) {
        <ui-pager
          statusText="Navegação por páginas"
          navigationLabel="Paginação de tipos de ato"
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
      [closable]="!saving()"
      [heading]="emEdicao() ? 'Editar tipo de ato' : 'Cadastrar tipo de ato'"
      ariaLabel="Formulário de tipo de ato"
      position="right"
    >
      @if (formError()) {
        <ui-alert variant="danger" heading="Não foi possível salvar">{{ formError() }}</ui-alert>
      }

      <form
        [formGroup]="form"
        id="cfg-tipo-ato-form"
        (ngSubmit)="salvar()"
        novalidate
        class="cfg-form"
      >
        <section aria-labelledby="cfg-ato-identificacao">
          <h3 id="cfg-ato-identificacao" class="form-section__title">Identificação</h3>
          <div class="form-grid form-grid--1col">
            <label class="field" [class.is-error]="erroDoCampo('codigo')">
              <span class="field__label is-required">Código</span>
              <input
                class="input cfg-input-uppercase"
                type="text"
                formControlName="codigo"
                [readonly]="emEdicao()"
                [attr.aria-invalid]="erroDoCampo('codigo') ? 'true' : null"
              />
              <span class="field__hint">
                @if (emEdicao()) {
                  Imutável: é a identidade da série de vigências.
                } @else {
                  Em maiúsculas, separado por underscore — por exemplo, RESULTADO_PRELIMINAR.
                }
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
              @if (erroDoCampo('nome')) {
                <span class="field__error">{{ erroDoCampo('nome') }}</span>
              }
            </label>
          </div>
        </section>

        <section aria-labelledby="cfg-ato-vigencia">
          <h3 id="cfg-ato-vigencia" class="form-section__title">Vigência</h3>
          <div class="form-grid form-grid--2col">
            <label class="field" [class.is-error]="erroDoCampo('vigenciaInicio')">
              <span class="field__label is-required">Início</span>
              <input
                class="input"
                type="date"
                formControlName="vigenciaInicio"
                [attr.aria-invalid]="erroDoCampo('vigenciaInicio') ? 'true' : null"
              />
              @if (erroDoCampo('vigenciaInicio')) {
                <span class="field__error">{{ erroDoCampo('vigenciaInicio') }}</span>
              }
            </label>
            <label class="field" [class.is-error]="erroDoCampo('vigenciaFim')">
              <span class="field__label">Fim</span>
              <input
                class="input"
                type="date"
                formControlName="vigenciaFim"
                [attr.aria-invalid]="erroDoCampo('vigenciaFim') ? 'true' : null"
              />
              <span class="field__hint">
                Primeiro dia em que o tipo deixa de valer — a data informada já fica fora da
                vigência. Em branco, não tem fim previsto.
              </span>
              @if (erroDoCampo('vigenciaFim')) {
                <span class="field__error">{{ erroDoCampo('vigenciaFim') }}</span>
              }
            </label>
          </div>
        </section>

        <section aria-labelledby="cfg-ato-sinalizadores">
          <h3 id="cfg-ato-sinalizadores" class="form-section__title">O que este ato determina</h3>
          <div class="form-grid form-grid--1col">
            @for (sinalizador of SINALIZADORES; track sinalizador.controle) {
              <div class="field">
                <label class="checkbox">
                  <input
                    type="checkbox"
                    [formControlName]="sinalizador.controle"
                    [attr.aria-describedby]="sinalizador.controle + '-ajuda'"
                  />
                  <span class="checkbox__box" aria-hidden="true"></span>
                  {{ sinalizador.rotulo }}
                </label>
                <span class="field__hint" [id]="sinalizador.controle + '-ajuda'">
                  {{ sinalizador.ajuda }}
                </span>
              </div>
            }
            <label class="field" [class.is-error]="erroDoCampo('baseLegal')">
              <span class="field__label">Base legal</span>
              <textarea
                class="textarea"
                formControlName="baseLegal"
                [attr.aria-invalid]="erroDoCampo('baseLegal') ? 'true' : null"
              ></textarea>
              @if (erroDoCampo('baseLegal')) {
                <span class="field__error">{{ erroDoCampo('baseLegal') }}</span>
              }
            </label>
          </div>
        </section>
      </form>

      <div class="cfg-form-footer">
        <button
          type="button"
          class="btn btn--tertiary btn--rect"
          [disabled]="saving()"
          (click)="formOpen.set(false)"
        >
          Cancelar
        </button>
        <button
          type="submit"
          form="cfg-tipo-ato-form"
          class="btn btn--primary"
          [disabled]="saving()"
        >
          @if (saving()) {
            <ui-spinner size="sm" />
          }
          {{ saving() ? 'Salvando...' : 'Salvar tipo de ato' }}
        </button>
      </div>
    </ui-drawer>

    <ui-confirm-dialog
      [(visible)]="confirmOpen"
      heading="Remover vigência"
      [message]="confirmMessage()"
      confirmLabel="Remover"
      confirmVariant="danger"
      (confirmed)="removerConfirmado()"
    />
  `,
  host: { class: 'cfg-page' },
})
export class TiposAtoPage {
  private readonly api = inject(TiposAtoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(PUBLICACOES_BASE_PATH);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  protected readonly SINALIZADORES = SINALIZADORES;

  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly confirmOpen = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly atoEmEdicaoId = signal<string | null>(null);
  protected readonly atoParaRemover = signal<TipoAtoPublicadoDto | null>(null);
  protected readonly idempotencyKeyAtual = signal(idempotencyKey.create());
  protected readonly termoBusca = signal('');
  protected readonly somenteEmVigor = signal(false);

  private readonly pagina = signal<CursorPagina | undefined>(undefined);

  private readonly lista = useApiResource<readonly TipoAtoPublicadoDto[]>(() => ({
    url: `${this.basePath}/api/publicacoes/tipos-ato`,
    params: this.montarParams(),
    context: withVendorMime('tipo-ato', 1),
  }));

  protected readonly loading = this.lista.isLoading;
  protected readonly emEdicao = computed(() => this.atoEmEdicaoId() !== null);

  private readonly cursores = linkedSignal<
    ApiResult<readonly TipoAtoPublicadoDto[]> | undefined,
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

  protected readonly atos = linkedSignal<
    ApiResult<readonly TipoAtoPublicadoDto[]> | undefined,
    readonly TipoAtoPublicadoDto[]
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

  // A listagem não aceita filtro de texto: o contrato só tem vigentes, cursor e limite.
  protected readonly atosFiltrados = computed(() => {
    const termo = this.termoBusca().trim().toLocaleLowerCase('pt-BR');
    if (termo.length === 0) {
      return this.atos();
    }
    return this.atos().filter(
      (ato) =>
        ato.codigo.toLocaleLowerCase('pt-BR').includes(termo) ||
        ato.nome.toLocaleLowerCase('pt-BR').includes(termo),
    );
  });

  // O estado vazio precisa distinguir catálogo vazio de recorte vazio: oferecer
  // cadastro quando o filtro é que escondeu tudo convida à duplicata.
  /**
   * A listagem não tem busca no servidor: o contrato só aceita `vigentes`,
   * cursor, limite e direção. Enquanto tudo couber numa página o recorte local
   * responde pelo catálogo inteiro; quando não couber, a tela diz.
   */
  protected readonly buscaLimitadaAPagina = computed(
    () =>
      this.termoBusca().trim().length > 0 &&
      (this.prevCursor() !== null || this.nextCursor() !== null),
  );

  protected readonly temFiltro = computed(
    () => this.termoBusca().trim().length > 0 || this.somenteEmVigor(),
  );

  // Cursor que não continua esta consulta (400) ou que expirou (410): recomeça a
  // paginação sem cursor e avisa o operador, em vez de deixar a tela presa numa
  // página que não existe mais — cujo "Tentar novamente" repetiria o mesmo cursor
  // morto indefinidamente.
  private readonly recuperandoDeCursorObsoleto = useCursorObsoletoRecovery({
    problem: this.lista.problem,
    pagina: this.pagina,
    reiniciarPagina: () => this.pagina.set(undefined),
    aoRecuperar: (problem) => {
      this.notifications.info(
        problem && ehCursorDePaginacaoExpirado(problem)
          ? 'A listagem ficou aberta tempo demais e a consulta expirou.'
          : 'A paginação foi reiniciada porque a consulta mudou.',
        'Recarregamos a listagem do começo.',
      );
    },
  });

  protected readonly errorMessage = computed<string | null>(() => {
    // Cursor obsoleto numa página navegada recarrega sozinho do começo e avisa
    // por notificação — sem alerta vermelho de "não foi possível carregar", que
    // descreveria mal um estado que já está se resolvendo.
    if (this.recuperandoDeCursorObsoleto()) {
      return null;
    }
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar tipos de ato.' : null;
  });

  protected readonly confirmMessage = computed(() => {
    const ato = this.atoParaRemover();
    return ato
      ? `Deseja remover a vigência de ${ato.codigo} iniciada em ${formatIsoDateBr(ato.vigenciaInicio)}? Atos já publicados não são afetados — eles copiaram por valor o que precisavam.`
      : 'Deseja remover esta vigência?';
  });

  protected readonly form: FormGroup<AtoForm> = new FormGroup<AtoForm>({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(60)],
    }),
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(200)],
    }),
    vigenciaInicio: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    vigenciaFim: new FormControl('', { nonNullable: true }),
    congelaConfiguracao: new FormControl(false, { nonNullable: true }),
    unicoPorObjeto: new FormControl(false, { nonNullable: true }),
    efeitoIrreversivel: new FormControl(false, { nonNullable: true }),
    ehResultado: new FormControl(false, { nonNullable: true }),
    baseLegal: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
  });

  constructor() {
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

  /**
   * Nome de cada ação de linha. Mostrando as vigências encerradas, o mesmo
   * código aparece em várias linhas, e o código sozinho daria nome idêntico a
   * ações que removem períodos diferentes.
   */
  protected identificacaoDaVigencia(ato: TipoAtoPublicadoDto): string {
    return `${ato.codigo}, vigência iniciada em ${formatIsoDateBr(ato.vigenciaInicio)}`;
  }

  protected periodo(ato: TipoAtoPublicadoDto): string {
    return ato.vigenciaFim === null
      ? `Desde ${formatIsoDateBr(ato.vigenciaInicio)}`
      : `De ${formatIsoDateBr(ato.vigenciaInicio)} até antes de ${formatIsoDateBr(ato.vigenciaFim)}`;
  }

  protected alternarSomenteEmVigor(): void {
    this.somenteEmVigor.update((valor) => !valor);
    this.pagina.set(undefined);
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
    if (this.somenteEmVigor()) {
      this.somenteEmVigor.set(false);
      this.pagina.set(undefined);
    }
  }

  protected abrirCriacao(): void {
    if (this.saving()) {
      return;
    }
    this.atoEmEdicaoId.set(null);
    this.form.reset({
      codigo: '',
      nome: '',
      vigenciaInicio: '',
      vigenciaFim: '',
      congelaConfiguracao: false,
      unicoPorObjeto: false,
      efeitoIrreversivel: false,
      ehResultado: false,
      baseLegal: '',
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  protected abrirEdicao(ato: TipoAtoPublicadoDto): void {
    if (this.saving()) {
      return;
    }
    this.atoEmEdicaoId.set(ato.id);
    this.form.reset({
      codigo: ato.codigo,
      nome: ato.nome,
      vigenciaInicio: ato.vigenciaInicio,
      vigenciaFim: ato.vigenciaFim ?? '',
      congelaConfiguracao: ato.congelaConfiguracao,
      unicoPorObjeto: ato.unicoPorObjeto,
      efeitoIrreversivel: ato.efeitoIrreversivel,
      ehResultado: ato.ehResultado,
      baseLegal: ato.baseLegal ?? '',
    });
    this.formError.set(null);
    this.formOpen.set(true);
  }

  protected pedirRemocao(ato: TipoAtoPublicadoDto): void {
    this.atoParaRemover.set(ato);
    this.confirmOpen.set(true);
  }

  protected removerConfirmado(): void {
    const ato = this.atoParaRemover();
    if (ato === null || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.api
      .remover(ato.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.saving.set(false);
        if (result.ok) {
          this.notifications.success('Vigência removida', ato.codigo);
          this.confirmOpen.set(false);
          this.atoParaRemover.set(null);
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
      this.focarPrimeiroCampoInvalido();
      return;
    }
    this.saving.set(true);
    this.formError.set(null);

    const id = this.atoEmEdicaoId();
    // Idempotency-Key só no POST: a ADR-0027 dispensa PUT puro, e a rota não declara o header.
    const requisicao: Observable<ApiResult<unknown>> =
      id === null
        ? this.api.criar(this.criarCommand(), withIdempotencyKey(this.idempotencyKeyAtual()))
        : this.api.atualizar(id, this.atualizarCommand(id));

    // O corpo já foi montado acima: editar durante o voo perderia as alterações
    // em silêncio no sucesso, e no 422 marcaria os erros do corpo enviado sobre
    // valores que já são outros.
    this.form.disable({ emitEvent: false });

    requisicao
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.handleSalvarResult(result));
  }

  protected erroDoCampo(nome: keyof AtoForm): string | null {
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
    if (control.errors['minlength']) return 'Valor abaixo do tamanho mínimo.';
    if (control.errors['maxlength']) return 'Valor acima do tamanho permitido.';
    return 'Valor inválido.';
  }

  /**
   * O backend recebe o código como digitado; a convenção do cadastro é caixa
   * alta. O modelo é normalizado sem reescrever a view (`emitModelToViewChange:
   * false`) para não reposicionar o cursor; a apresentação em caixa alta fica
   * por conta do `text-transform` do campo. Na edição nunca escreve: o código
   * vigente é imutável e qualquer divergência com o persistido é recusada pelo
   * agregado num campo que a tela nem deixa corrigir.
   */
  private normalizarCaixaDoCodigo(codigo: string): void {
    if (this.emEdicao()) {
      return;
    }
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
    const base = new HttpParams().set('vigentes', String(this.somenteEmVigor()));
    const pagina = this.pagina();
    if (pagina === undefined) {
      return base.set('limit', String(PAGE_SIZE));
    }
    return base.set('cursor', cursorToString(pagina.cursor)).set('direction', pagina.direction);
  }

  private recarregar(): void {
    if (this.pagina() === undefined) {
      this.lista.reload();
    } else {
      this.pagina.set(undefined);
    }
  }

  private handleSalvarResult(result: ApiResult<unknown>): void {
    this.saving.set(false);
    this.form.enable({ emitEvent: false });
    if (result.ok) {
      this.notifications.success(
        this.emEdicao() ? 'Tipo de ato atualizado' : 'Tipo de ato cadastrado',
      );
      this.formOpen.set(false);
      this.idempotencyKeyAtual.set(idempotencyKey.create());
      this.recarregar();
      return;
    }
    this.aplicarFalha(result.problem);
  }

  private aplicarFalha(problem: ProblemDetails): void {
    // A política de rotação da chave é do contrato, não desta tela: a API guarda
    // a resposta de qualquer status abaixo de 500 contra o hash do corpo, e
    // `processing_conflict` é a exceção que pede retry do mesmo comando com a
    // mesma chave.
    if (deveRotacionarIdempotencyKey(problem)) {
      this.renovarIdempotencyKey();
    }
    if (
      problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO &&
      problem.errors &&
      problem.errors.length > 0
    ) {
      this.aplicarErrosDeValidacao(problem.errors);
      return;
    }
    this.formError.set(
      problem.code === VIGENCIA_SOBREPOSTA
        ? 'Já existe uma vigência deste código cobrindo parte deste período. Encerre a anterior ou escolha outro início.'
        : this.problemI18n.resolve(problem).title,
    );
    if (problem.status >= 500) {
      this.notifications.errorFromProblem(problem);
    }
  }

  /**
   * Submeter pelo rodapé com um campo recusado acima da dobra deixava o foco no
   * botão: as mensagens aparecem fora da vista e não são região viva, então
   * quem navega por teclado ou leitor de tela não recebe indicação nenhuma.
   */
  private focarPrimeiroCampoInvalido(): void {
    const nome = (Object.keys(this.form.controls) as (keyof AtoForm)[]).find(
      (controle) => this.form.controls[controle].invalid,
    );
    if (nome === undefined) {
      return;
    }
    const campo = this.host.nativeElement.querySelector<HTMLElement>(
      `[formcontrolname="${nome}"]`,
    );
    campo?.focus();
  }

  private renovarIdempotencyKey(): void {
    this.idempotencyKeyAtual.set(idempotencyKey.create());
  }

  private aplicarErrosDeValidacao(errors: ReadonlyArray<ProblemValidationError>): void {
    let aplicouAlgum = false;
    for (const erro of errors) {
      const controlName = controlNameFromBackendField<keyof AtoForm>(erro.field, ATO_CONTROL_NAMES);
      if (controlName === null) continue;
      const control = this.form.controls[controlName];
      control.setErrors({ backend: { code: erro.code, message: erro.message } });
      control.markAsTouched();
      aplicouAlgum = true;
    }

    if (aplicouAlgum) {
      this.formError.set(null);
      this.focarPrimeiroCampoInvalido();
      return;
    }
    this.formError.set('Não foi possível mapear os erros de validação. Revise os campos.');
  }

  private criarCommand(): CriarTipoAtoPublicadoCommand {
    const raw = this.form.getRawValue();
    return {
      codigo: raw.codigo.trim(),
      nome: raw.nome.trim(),
      congelaConfiguracao: raw.congelaConfiguracao,
      unicoPorObjeto: raw.unicoPorObjeto,
      efeitoIrreversivel: raw.efeitoIrreversivel,
      ehResultado: raw.ehResultado,
      vigenciaInicio: raw.vigenciaInicio,
      vigenciaFim: nullIfBlank(raw.vigenciaFim),
      baseLegal: nullIfBlank(raw.baseLegal),
    };
  }

  // O `id` do corpo reapresenta o da rota, e o `codigo` volta idêntico ao
  // persistido — o agregado recusa divergência nos dois.
  private atualizarCommand(id: string): AtualizarTipoAtoPublicadoCommand {
    return { id, ...this.criarCommand() };
  }
}
