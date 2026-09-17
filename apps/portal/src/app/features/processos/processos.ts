import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
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

type CertameStatus = 'aberto' | 'ultimos-dias' | 'encerrado';
type CertameModalidade = 'graduacao' | 'pos-graduacao' | 'vagas-reservadas' | 'cursos-tecnicos';
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

interface Certame {
  readonly id: string;
  readonly numero: string;
  readonly titulo: string;
  readonly resumo: string;
  readonly status: CertameStatus;
  readonly modalidade: CertameModalidade;
  readonly modalidadeLabel: string;
  /** ISO (aaaa-mm-dd) — precisa ser ordenável, não só exibível (ver `compararPorUrgencia`). */
  readonly encerraEm: string;
  readonly vagas: string;
  /** Certame exibido no hero de destaque. No máximo um `true` no conjunto. */
  readonly destaque?: boolean;
}

const STATUS_LABEL: Record<CertameStatus, string> = {
  aberto: 'Inscrições abertas',
  'ultimos-dias': 'Últimos dias',
  encerrado: 'Encerrado',
};

const STATUS_VARIANT: Record<CertameStatus, UiTagVariant> = {
  aberto: 'success',
  'ultimos-dias': 'warning',
  encerrado: 'neutral',
};

const MODALIDADE_LABEL: Record<CertameModalidade, string> = {
  graduacao: 'Graduação',
  'pos-graduacao': 'Pós-graduação',
  'vagas-reservadas': 'Vagas reservadas',
  'cursos-tecnicos': 'Cursos técnicos',
};

const VIEW_OPTIONS: readonly UiSegmentedOption<VisaoCertames>[] = [
  { value: 'lista', label: 'Lista', icon: 'pi-list' },
  { value: 'cards', label: 'Cards', icon: 'pi-th-large' },
];

/** Abaixo desta largura a lista é a forma canônica (decisão do design system). */
const COMPACT_MEDIA_QUERY = '(max-width: 599.98px)';

const PAGE_SIZE = 5;

const VISAO_STORE_KEY = 'uniplus.portal.certames-visao';

/**
 * Dados de exemplo — ainda não existe endpoint público de certames (só o
 * client administrativo `ProcessosSeletivosApi`, sem filtros de busca).
 * Troque `carregarCertames()` por uma chamada real quando o endpoint existir.
 */
const CERTAMES_MOCK: readonly Certame[] = [
  {
    id: 'sisu-2026-1',
    numero: 'Edital 12/2026',
    titulo: 'SISU 2026.1 — Cursos de graduação',
    resumo:
      'Sistema de Seleção Unificada para vagas remanescentes da UNIFESSPA, semestre 2026.1. ' +
      'Inclui modalidades de ampla concorrência e cotas PPI, escola pública e PcD.',
    status: 'aberto',
    modalidade: 'graduacao',
    modalidadeLabel: MODALIDADE_LABEL.graduacao,
    encerraEm: '2026-04-16',
    vagas: '1.234',
    destaque: true,
  },
  {
    id: 'pos-educacao-2026',
    numero: 'Edital 09/2026',
    titulo: 'Pós-graduação em Educação',
    resumo:
      'Mestrado e doutorado — Programa de Pós-Graduação em Educação na Amazônia, com linhas de ' +
      'pesquisa em educação indígena, formação de professores e políticas públicas.',
    status: 'ultimos-dias',
    modalidade: 'pos-graduacao',
    modalidadeLabel: MODALIDADE_LABEL['pos-graduacao'],
    encerraEm: '2026-03-22',
    vagas: '47',
  },
  {
    id: 'vestibular-indigena-2026',
    numero: 'Edital 04/2026',
    titulo: 'Vestibular Indígena 2026',
    resumo:
      'Vagas reservadas para candidatos autodeclarados indígenas. Inscrição em modalidade ' +
      'específica, com etapas adaptadas para comunidades originárias do Sul e Sudeste do Pará.',
    status: 'aberto',
    modalidade: 'vagas-reservadas',
    modalidadeLabel: MODALIDADE_LABEL['vagas-reservadas'],
    encerraEm: '2026-04-30',
    vagas: '86',
  },
  {
    id: 'tecnico-informatica-2026',
    numero: 'Edital 15/2026',
    titulo: 'Técnico em Informática',
    resumo:
      'Curso técnico integrado, oferta noturna, com aulas práticas em laboratório e estágio ' +
      'supervisionado no último semestre.',
    status: 'aberto',
    modalidade: 'cursos-tecnicos',
    modalidadeLabel: MODALIDADE_LABEL['cursos-tecnicos'],
    encerraEm: '2026-05-10',
    vagas: '120',
  },
  {
    id: 'mestrado-computacao-2026',
    numero: 'Edital 11/2026',
    titulo: 'Mestrado em Ciência da Computação',
    resumo:
      'Programa de Pós-Graduação stricto sensu, linhas de pesquisa em inteligência artificial, ' +
      'sistemas distribuídos e engenharia de software.',
    status: 'aberto',
    modalidade: 'pos-graduacao',
    modalidadeLabel: MODALIDADE_LABEL['pos-graduacao'],
    encerraEm: '2026-05-05',
    vagas: '30',
  },
  {
    id: 'tecnico-enfermagem-2026',
    numero: 'Edital 07/2026',
    titulo: 'Técnico em Enfermagem',
    resumo:
      'Curso técnico subsequente, oferta vespertina, com estágio em unidades de saúde parceiras ' +
      'da rede municipal.',
    status: 'ultimos-dias',
    modalidade: 'cursos-tecnicos',
    modalidadeLabel: MODALIDADE_LABEL['cursos-tecnicos'],
    encerraEm: '2026-03-25',
    vagas: '60',
  },
  {
    id: 'vestibular-quilombola-2026',
    numero: 'Edital 02/2026',
    titulo: 'Vestibular Quilombola 2026',
    resumo:
      'Vagas reservadas para candidatos autodeclarados quilombolas, com etapas de heteroidentificação ' +
      'e cronograma próprio.',
    status: 'encerrado',
    modalidade: 'vagas-reservadas',
    modalidadeLabel: MODALIDADE_LABEL['vagas-reservadas'],
    encerraEm: '2026-02-15',
    vagas: '40',
  },
  {
    id: 'sisu-2025-2-remanescente',
    numero: 'Edital 28/2025',
    titulo: 'SISU 2025.2 — Vagas remanescentes',
    resumo:
      'Chamada complementar para preenchimento de vagas remanescentes do semestre 2025.2, cursos ' +
      'de graduação diversos.',
    status: 'encerrado',
    modalidade: 'graduacao',
    modalidadeLabel: MODALIDADE_LABEL.graduacao,
    encerraEm: '2026-01-20',
    vagas: '300',
  },
];

function grupoUrgencia(status: CertameStatus): number {
  return status === 'encerrado' ? 1 : 0;
}

/**
 * Abertos e em últimos dias antes de encerrados; dentro de cada grupo, prazo
 * mais próximo primeiro (CA-01 da story #776 — "quem encerra antes no topo").
 * `encerraEm` em ISO ordena cronologicamente por comparação de string.
 */
function compararPorUrgencia(a: Certame, b: Certame): number {
  const grupo = grupoUrgencia(a.status) - grupoUrgencia(b.status);
  return grupo !== 0 ? grupo : a.encerraEm.localeCompare(b.encerraEm);
}

/** Mesmo tratamento de diacríticos já usado em `unidades.page.ts` — sem isso,
 * buscar "tecnico" ou "graduacao" (sem acento) não encontra nada. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR');
}

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

/**
 * Lista de certames do portal público (issue #779) — busca, filtros por
 * situação/modalidade com contadores, paginação e três estados (carregando,
 * vazio, erro). Abaixo de 600px a lista é a forma canônica: o controle de
 * alternância some e a visão fica travada em "lista", independente da
 * preferência lembrada (ADR de design system referenciada na issue).
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

  protected readonly viewOptions = VIEW_OPTIONS;
  protected readonly passos = PASSOS;

  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly certames = signal<readonly Certame[]>([]);

  protected readonly busca = signal('');
  protected readonly statusSelecionado = signal<string | null>(null);
  protected readonly modalidadeSelecionada = signal<string | null>(null);
  protected readonly visao = signal<VisaoCertames>(readVisao());
  protected readonly paginaAtual = signal(0);

  /** Detecta a largura canônica de lista (<600px) via matchMedia (ADR-0002-like). */
  protected readonly isCompacto = signal(this.mediaCompacta()?.matches ?? false);

  /** Abaixo de 600px a visão fica travada em lista, mesmo com "cards" salvo. */
  protected readonly visaoEfetiva = computed<VisaoCertames>(() =>
    this.isCompacto() ? 'lista' : this.visao(),
  );

  private readonly porBuscaEModalidade = computed(() =>
    this.certames()
      .filter((certame) => this.combinaBusca(certame))
      .filter((certame) => this.combinaModalidade(certame)),
  );

  private readonly porBuscaEStatus = computed(() =>
    this.certames()
      .filter((certame) => this.combinaBusca(certame))
      .filter((certame) => this.combinaStatus(certame)),
  );

  protected readonly statusChips = computed<readonly UiFilterChipOption[]>(() => {
    const base = this.porBuscaEModalidade();
    return (Object.keys(STATUS_LABEL) as CertameStatus[]).map((status) => ({
      value: status,
      label: STATUS_LABEL[status],
      count: base.filter((certame) => certame.status === status).length,
    }));
  });

  protected readonly modalidadeChips = computed<readonly UiFilterChipOption[]>(() => {
    const base = this.porBuscaEStatus();
    return (Object.keys(MODALIDADE_LABEL) as CertameModalidade[]).map((modalidade) => ({
      value: modalidade,
      label: MODALIDADE_LABEL[modalidade],
      count: base.filter((certame) => certame.modalidade === modalidade).length,
    }));
  });

  protected readonly certamesFiltrados = computed(() =>
    [...this.certames()]
      .filter((certame) => this.combinaBusca(certame))
      .filter((certame) => this.combinaStatus(certame))
      .filter((certame) => this.combinaModalidade(certame))
      .sort(compararPorUrgencia),
  );

  /** Certame do hero — fonte única com a listagem, não um literal solto no template. */
  protected readonly destaque = computed<Certame | null>(
    () => this.certames().find((certame) => certame.destaque) ?? null,
  );

  protected readonly totalFiltrados = computed(() => this.certamesFiltrados().length);
  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.totalFiltrados() / PAGE_SIZE)),
  );

  protected readonly itensPagina = computed(() => {
    const inicio = this.paginaAtual() * PAGE_SIZE;
    return this.certamesFiltrados().slice(inicio, inicio + PAGE_SIZE);
  });

  protected readonly hasPrevious = computed(() => this.paginaAtual() > 0);
  protected readonly hasNext = computed(() => this.paginaAtual() < this.totalPaginas() - 1);

  protected readonly statusPaginacao = computed(
    () => `Página ${this.paginaAtual() + 1} de ${this.totalPaginas()}`,
  );

  protected readonly temFiltrosAtivos = computed(
    () =>
      this.busca().trim().length > 0 ||
      this.statusSelecionado() !== null ||
      this.modalidadeSelecionada() !== null,
  );

  constructor() {
    this.carregarCertames();
    this.escutarBreakpoint();

    // Qualquer mudança de busca/filtro invalida a página atual (evita cair
    // numa página vazia quando o total de resultados encolhe).
    effect(() => {
      this.busca();
      this.statusSelecionado();
      this.modalidadeSelecionada();
      this.paginaAtual.set(0);
    });

    effect(() => writeVisao(this.visao()));
  }

  protected statusLabel(status: CertameStatus): string {
    return STATUS_LABEL[status];
  }

  protected statusVariant(status: CertameStatus): UiTagVariant {
    return STATUS_VARIANT[status];
  }

  protected setVisao(visao: VisaoCertames | null): void {
    if (visao !== null) {
      this.visao.set(visao);
    }
  }

  protected limparFiltros(): void {
    this.busca.set('');
    this.statusSelecionado.set(null);
    this.modalidadeSelecionada.set(null);
  }

  protected proximaPagina(): void {
    if (this.hasNext()) {
      this.paginaAtual.update((pagina) => pagina + 1);
    }
  }

  protected paginaAnterior(): void {
    if (this.hasPrevious()) {
      this.paginaAtual.update((pagina) => pagina - 1);
    }
  }

  protected tentarNovamente(): void {
    if (!this.carregando()) {
      this.carregarCertames();
    }
  }

  private carregarCertames(): void {
    this.carregando.set(true);
    this.erro.set(null);
    // Deferido para o próximo tick do event loop: exercita o estado
    // "carregando" de fato, no mesmo formato assíncrono que uma chamada de
    // API real teria. Sem caminho de falha porque o dado é mockado — ao
    // trocar por uma chamada real, o catch precisa chamar
    // `this.erro.set(mensagem)`; isso não acontece sozinho.
    const temporizador = setTimeout(() => {
      this.certames.set(CERTAMES_MOCK);
      this.carregando.set(false);
    });
    this.destroyRef.onDestroy(() => clearTimeout(temporizador));
  }

  private combinaBusca(certame: Certame): boolean {
    const termo = normalizar(this.busca().trim());
    if (termo.length === 0) return true;
    return (
      normalizar(certame.titulo).includes(termo) ||
      normalizar(certame.resumo).includes(termo) ||
      normalizar(certame.numero).includes(termo) ||
      normalizar(certame.modalidadeLabel).includes(termo)
    );
  }

  private combinaStatus(certame: Certame): boolean {
    const status = this.statusSelecionado();
    return status === null || certame.status === status;
  }

  private combinaModalidade(certame: Certame): boolean {
    const modalidade = this.modalidadeSelecionada();
    return modalidade === null || certame.modalidade === modalidade;
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
