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
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterOutlet } from '@angular/router';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import {
  ApiResult,
  Cursor,
  CursorPagina,
  ProblemI18nService,
  cursorToString,
  extractNextCursor,
  extractPrevCursor,
  useApiResource,
  useCursorObsoletoRecovery,
  withVendorMime,
} from '@uniplus/shared-core/http';
import {
  CertameNaVitrineDto,
  SELECAO_BASE_PATH,
  SituacaoDoCertame,
} from '@uniplus/shared-data/selecao';
import {
  AlertComponent,
  EmptyStateComponent,
  FilterBarComponent,
  FilterChipsComponent,
  ListFooterComponent,
  PageHeaderComponent,
  SegmentedComponent,
  SpinnerComponent,
  TagComponent,
  type UiFilterChipOption,
  type UiSegmentedOption,
  type UiTagVariant,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

type VisaoCertames = 'lista' | 'cards';

interface PassoComoFunciona {
  readonly numero: number;
  readonly titulo: string;
  readonly descricao: string;
}

const PASSOS: readonly PassoComoFunciona[] = [
  {
    numero: 1,
    titulo: 'Crie sua conta',
    descricao: 'Use seu CPF e e-mail. Se já tem conta gov.br, é mais rápido.',
  },
  {
    numero: 2,
    titulo: 'Escolha um edital',
    descricao: 'Compare modalidade, vagas, datas e leia tudo antes de começar.',
  },
  {
    numero: 3,
    titulo: 'Preencha sua inscrição',
    descricao: 'Salve a qualquer momento e volte depois — você não perde nada.',
  },
  {
    numero: 4,
    titulo: 'Acompanhe o resultado',
    descricao: 'Receba notificações por e-mail e veja tudo em "Minhas inscrições".',
  },
];

/** Ordem de exibição dos chips — não é a ordem alfabética do enum gerado. */
const SITUACOES_EXIBIDAS: readonly SituacaoDoCertame[] = [
  SituacaoDoCertame.emBreve,
  SituacaoDoCertame.inscricoesAbertas,
  SituacaoDoCertame.ultimosDias,
  SituacaoDoCertame.encerradas,
];

const SITUACAO_LABEL: Record<SituacaoDoCertame, string> = {
  [SituacaoDoCertame.emBreve]: 'Em breve',
  [SituacaoDoCertame.inscricoesAbertas]: 'Inscrições abertas',
  [SituacaoDoCertame.ultimosDias]: 'Últimos dias',
  [SituacaoDoCertame.encerradas]: 'Encerrado',
};

const SITUACAO_VARIANT: Record<SituacaoDoCertame, UiTagVariant> = {
  [SituacaoDoCertame.emBreve]: 'info',
  [SituacaoDoCertame.inscricoesAbertas]: 'success',
  [SituacaoDoCertame.ultimosDias]: 'warning',
  [SituacaoDoCertame.encerradas]: 'neutral',
};

/** Contagem por situação (headers `X-Certames-*`, só vem com `incluir_contadores=true`). */
interface ContadoresSituacao {
  readonly [situacao: string]: number;
}

const VIEW_OPTIONS: readonly UiSegmentedOption<VisaoCertames>[] = [
  { value: 'lista', label: 'Lista', icon: 'pi-list' },
  { value: 'cards', label: 'Cards', icon: 'pi-th-large' },
];

/** Abaixo desta largura a lista é a forma canônica (decisão do design system). */
const COMPACT_MEDIA_QUERY = '(max-width: 599.98px)';

/** Janela da vitrine por página (cursor pagination, ADR-0026). */
const PAGE_SIZE = 10;

/** Debounce da busca textual — uma request por rajada de digitação, não por tecla. */
const BUSCA_DEBOUNCE_MS = 300;

const VISAO_STORE_KEY = 'uniplus.portal.certames-visao';

function readVisao(): VisaoCertames {
  try {
    const valor = localStorage.getItem(VISAO_STORE_KEY);
    return valor === 'cards' ? 'cards' : 'lista';
  } catch {
    return 'lista';
  }
}

function writeVisao(visao: VisaoCertames): void {
  try {
    localStorage.setItem(VISAO_STORE_KEY, visao);
  } catch {
    // Storage pode estar indisponível em navegação privada.
  }
}

function numeroDoHeader(headers: { get(name: string): string | null } | undefined, nome: string): number {
  const valor = Number(headers?.get(nome));
  return Number.isFinite(valor) ? valor : 0;
}

/**
 * Vitrine pública de certames (issue #779) — consome `GET /api/selecao/certames`
 * do módulo Seleção (ADR-0131/ADR-0133 da `uniplus-api`; anônimo, sem passar
 * pela `portal-api`, que ainda é esqueleto). Busca e situação viram parâmetros
 * de request; contadores dos chips vêm dos headers `X-Certames-*`; paginação é
 * por cursor opaco (Anterior/Próximo, sem "Página X de Y" — o contrato não
 * expõe total). Abaixo de 600px a lista é a forma canônica: o controle de
 * alternância some e a visão fica travada em "lista".
 */
@Component({
  selector: 'ptl-processos',
  standalone: true,
  imports: [
    RouterLink,
    RouterOutlet,
    DateBrPipe,
    AlertComponent,
    EmptyStateComponent,
    FilterBarComponent,
    FilterChipsComponent,
    ListFooterComponent,
    PageHeaderComponent,
    SegmentedComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './processos.css',
  templateUrl: './processos.html',
})
export class ProcessosComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly basePath = inject(SELECAO_BASE_PATH);
  private readonly problemI18n = inject(ProblemI18nService);

  protected readonly viewOptions = VIEW_OPTIONS;
  protected readonly passos = PASSOS;

  /** Valor bruto do campo de busca — o que o `ui-filter-bar` lê/escreve a cada tecla. */
  protected readonly termoBusca = signal('');
  protected readonly situacaoSelecionada = signal<string | null>(null);
  protected readonly visao = signal<VisaoCertames>(readVisao());

  /** Termo aplicado à busca server-side (`?q=`) — debounced: uma request por rajada. */
  private readonly buscaAplicada = toSignal(
    toObservable(this.termoBusca).pipe(
      map((termo) => termo.trim()),
      debounceTime(BUSCA_DEBOUNCE_MS),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );

  /** Chave do filtro vigente — fonte do reset de paginação (o cursor carrega o filtro antigo). */
  private readonly filtroKey = computed(() =>
    JSON.stringify([this.buscaAplicada(), this.situacaoSelecionada()]),
  );

  /** Página de navegação atual (`undefined` = primeira). Volta à primeira quando o filtro muda. */
  private readonly pagina = linkedSignal<string, CursorPagina | undefined>({
    source: () => this.filtroKey(),
    computation: () => undefined,
  });

  private readonly lista = useApiResource<readonly CertameNaVitrineDto[]>(() => ({
    url: `${this.basePath}/api/selecao/certames`,
    params: this.montarParams(),
    context: withVendorMime('certame', 1),
  }));

  protected readonly carregando = this.lista.isLoading;

  private readonly cursores = linkedSignal<
    ApiResult<readonly CertameNaVitrineDto[]> | undefined,
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

  protected readonly hasPrevious = computed(() => this.cursores().prev !== null);
  protected readonly hasNext = computed(() => this.cursores().next !== null);

  protected readonly certames = linkedSignal<
    ApiResult<readonly CertameNaVitrineDto[]> | undefined,
    readonly CertameNaVitrineDto[]
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
      return envelope.data;
    },
  });

  /** Contadores dos chips de situação — sempre pedidos, cobrem a vitrine inteira, não só a página. */
  private readonly contadores = linkedSignal<
    ApiResult<readonly CertameNaVitrineDto[]> | undefined,
    ContadoresSituacao | null
  >({
    source: () => this.lista.value(),
    computation: (envelope, previous) => {
      const atual = previous?.value ?? null;
      if (envelope === undefined || !envelope.ok) {
        return atual;
      }
      const headers = untracked(() => this.lista.headers());
      return {
        [SituacaoDoCertame.emBreve]: numeroDoHeader(headers, 'X-Certames-Em-Breve'),
        [SituacaoDoCertame.inscricoesAbertas]: numeroDoHeader(headers, 'X-Certames-Inscricoes-Abertas'),
        [SituacaoDoCertame.ultimosDias]: numeroDoHeader(headers, 'X-Certames-Ultimos-Dias'),
        [SituacaoDoCertame.encerradas]: numeroDoHeader(headers, 'X-Certames-Encerrados'),
      };
    },
  });

  protected readonly statusChips = computed<readonly UiFilterChipOption[]>(() => {
    const contadores = this.contadores();
    return SITUACOES_EXIBIDAS.map((situacao) => ({
      value: situacao,
      label: SITUACAO_LABEL[situacao],
      count: contadores?.[situacao],
    }));
  });

  /**
   * Certame do hero — só na primeira página sem filtro ativo (a API já ordena
   * por urgência por padrão, então o primeiro item é o mais urgente).
   */
  protected readonly destaque = computed<CertameNaVitrineDto | null>(() => {
    if (
      this.pagina() !== undefined ||
      this.buscaAplicada().length > 0 ||
      this.situacaoSelecionada() !== null
    ) {
      return null;
    }
    return this.certames()[0] ?? null;
  });

  protected readonly temFiltrosAtivos = computed(
    () => this.buscaAplicada().length > 0 || this.situacaoSelecionada() !== null,
  );

  /** Detecta a largura canônica de lista (<600px) via matchMedia (ADR-0002-like). */
  protected readonly isCompacto = signal(this.mediaCompacta()?.matches ?? false);

  /** Abaixo de 600px a visão fica travada em lista, mesmo com "cards" salvo. */
  protected readonly visaoEfetiva = computed<VisaoCertames>(() =>
    this.isCompacto() ? 'lista' : this.visao(),
  );

  // Cursor que não continua esta consulta (400) ou que expirou (410): recomeça
  // a paginação sem cursor. Sem aviso ao candidato — o portal não tem um host
  // de notificação global (diferente dos apps administrativos), e para uma
  // navegação pública somente-leitura recarregar em silêncio do começo é uma
  // degradação aceitável, não uma perda de trabalho.
  private readonly recuperandoDeCursorObsoleto = useCursorObsoletoRecovery({
    problem: this.lista.problem,
    pagina: this.pagina,
    reiniciarPagina: () => this.pagina.set(undefined),
    aoRecuperar: () => undefined,
  });

  protected readonly erro = computed<string | null>(() => {
    if (this.recuperandoDeCursorObsoleto()) {
      return null;
    }
    const problem = this.lista.problem();
    if (problem) {
      const { title, detail } = this.problemI18n.resolve(problem);
      return problem.status === 422 && detail ? detail : title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar os certames.' : null;
  });

  constructor() {
    this.escutarBreakpoint();
    effect(() => writeVisao(this.visao()));
  }

  protected statusLabel(situacao: SituacaoDoCertame): string {
    return SITUACAO_LABEL[situacao];
  }

  protected statusVariant(situacao: SituacaoDoCertame): UiTagVariant {
    return SITUACAO_VARIANT[situacao];
  }

  /** `totalDeVagas` chega como `number | string` (contrato usa `pattern` no int32). */
  protected vagasFormatadas(totalDeVagas: number | string): string {
    return Number(totalDeVagas).toLocaleString('pt-BR');
  }

  protected setVisao(visao: VisaoCertames | null): void {
    if (visao !== null) {
      this.visao.set(visao);
    }
  }

  protected limparFiltros(): void {
    this.termoBusca.set('');
    this.situacaoSelecionada.set(null);
  }

  protected proximaPagina(): void {
    const proximo = this.cursores().next;
    if (proximo !== null && !this.carregando()) {
      this.pagina.set({ cursor: proximo, direction: 'next' });
    }
  }

  protected paginaAnterior(): void {
    const anterior = this.cursores().prev;
    if (anterior !== null && !this.carregando()) {
      this.pagina.set({ cursor: anterior, direction: 'prev' });
    }
  }

  protected tentarNovamente(): void {
    if (this.carregando()) {
      return;
    }
    if (this.pagina() === undefined) {
      this.lista.reload();
    } else {
      this.pagina.set(undefined);
    }
  }

  private montarParams(): HttpParams {
    let params = new HttpParams().set('incluir_contadores', 'true');
    const situacao = this.situacaoSelecionada();
    if (situacao !== null) {
      params = params.set('situacao', situacao);
    }
    const q = this.buscaAplicada();
    if (q.length > 0) {
      params = params.set('q', q);
    }
    const pagina = this.pagina();
    if (pagina === undefined) {
      return params.set('limit', String(PAGE_SIZE));
    }
    return params.set('cursor', cursorToString(pagina.cursor)).set('direction', pagina.direction);
  }

  private mediaCompacta(): MediaQueryList | null {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(COMPACT_MEDIA_QUERY)
      : null;
  }

  private escutarBreakpoint(): void {
    const mediaQuery = this.mediaCompacta();
    if (mediaQuery === null) return;

    const ouvinte = (evento: MediaQueryListEvent) => this.isCompacto.set(evento.matches);
    mediaQuery.addEventListener('change', ouvinte);
    this.destroyRef.onDestroy(() => mediaQuery.removeEventListener('change', ouvinte));
  }
}
