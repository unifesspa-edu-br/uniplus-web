import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  AlertComponent,
  EmptyStateComponent,
  FilterBarComponent,
  FilterChipsComponent,
  PageHeaderComponent,
  SegmentedComponent,
  SpinnerComponent,
  TagComponent,
  type UiFilterChipOption,
  type UiSegmentedOption,
  type UiTagVariant,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { normalizarParaBusca } from '@uniplus/shared-utils';

import {
  SITUACAO_PUBLICACAO_LABEL,
  SITUACAO_PUBLICACAO_VARIANT,
  SITUACOES_PUBLICACAO_EXIBIDAS,
  type Publicacao,
  type SituacaoPublicacao,
} from './publicacoes.model';
import { PublicacoesRepository } from './publicacoes.repository';

type VisaoPublicacoes = 'lista' | 'cards';

const VIEW_OPTIONS: readonly UiSegmentedOption<VisaoPublicacoes>[] = [
  { value: 'lista', label: 'Lista', icon: 'pi-list' },
  { value: 'cards', label: 'Cards', icon: 'pi-th-large' },
];

/** Abaixo desta largura a lista é a forma canônica — mesma decisão da vitrine de editais. */
const COMPACT_MEDIA_QUERY = '(max-width: 599.98px)';

const VISAO_STORE_KEY = 'uniplus.portal.publicacoes-visao';

function readVisao(): VisaoPublicacoes {
  try {
    const valor = localStorage.getItem(VISAO_STORE_KEY);
    return valor === 'cards' ? 'cards' : 'lista';
  } catch {
    return 'lista';
  }
}

function writeVisao(visao: VisaoPublicacoes): void {
  try {
    localStorage.setItem(VISAO_STORE_KEY, visao);
  } catch {
    // Storage pode estar indisponível em navegação privada.
  }
}

/**
 * Tela 1 do menu Publicações — lista os processos seletivos ainda não
 * finalizados. Dado mocado por ora, servido por `PublicacoesRepository`
 * (CA-11: a interface não conhece o mock, só o contrato `listar()`); busca
 * e filtro rodam em memória sobre o que o repositório devolveu.
 */
@Component({
  selector: 'ptl-publicacoes-lista',
  standalone: true,
  imports: [
    RouterLink,
    DateBrPipe,
    AlertComponent,
    EmptyStateComponent,
    FilterBarComponent,
    FilterChipsComponent,
    PageHeaderComponent,
    SegmentedComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './publicacoes-lista.css',
  templateUrl: './publicacoes-lista.html',
})
export class PublicacoesListaComponent {
  private readonly repository = inject(PublicacoesRepository);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly viewOptions = VIEW_OPTIONS;

  protected readonly termoBusca = signal('');
  protected readonly situacaoSelecionada = signal<string | null>(null);
  protected readonly visao = signal<VisaoPublicacoes>(readVisao());

  /** O que o repositório devolveu na última busca — já sem os processos finalizados. */
  private readonly ativas = signal<readonly Publicacao[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  private carregamentoEmAndamento: Subscription | undefined;

  protected readonly situacaoChips = computed<readonly UiFilterChipOption[]>(() =>
    SITUACOES_PUBLICACAO_EXIBIDAS.map((situacao) => ({
      value: situacao,
      label: SITUACAO_PUBLICACAO_LABEL[situacao],
      count: this.ativas().filter((publicacao) => publicacao.situacao === situacao).length,
    })),
  );

  protected readonly publicacoes = computed<readonly Publicacao[]>(() => {
    const termo = normalizarParaBusca(this.termoBusca());
    const situacao = this.situacaoSelecionada();
    return this.ativas().filter((publicacao) => {
      const combinaSituacao = situacao === null || publicacao.situacao === situacao;
      const combinaTermo =
        termo.length === 0 ||
        normalizarParaBusca(publicacao.titulo).includes(termo) ||
        normalizarParaBusca(publicacao.numeroEdital).includes(termo);
      return combinaSituacao && combinaTermo;
    });
  });

  protected readonly temFiltrosAtivos = computed(
    () => this.termoBusca().trim().length > 0 || this.situacaoSelecionada() !== null,
  );

  /** Detecta a largura em que a lista é a forma canônica (<600px), via `matchMedia`. */
  protected readonly isCompacto = signal(this.mediaCompacta()?.matches ?? false);

  /** Abaixo de 600px a visão fica travada em lista, mesmo com "cards" salvo. */
  protected readonly visaoEfetiva = computed<VisaoPublicacoes>(() =>
    this.isCompacto() ? 'lista' : this.visao(),
  );

  constructor() {
    this.escutarBreakpoint();
    effect(() => writeVisao(this.visao()));
    this.carregar();
    this.destroyRef.onDestroy(() => this.carregamentoEmAndamento?.unsubscribe());
  }

  protected statusLabel(situacao: SituacaoPublicacao): string {
    return SITUACAO_PUBLICACAO_LABEL[situacao];
  }

  protected statusVariant(situacao: SituacaoPublicacao): UiTagVariant {
    return SITUACAO_PUBLICACAO_VARIANT[situacao];
  }

  protected setVisao(visao: VisaoPublicacoes | null): void {
    if (visao !== null) {
      this.visao.set(visao);
    }
  }

  protected limparFiltros(): void {
    this.termoBusca.set('');
    this.situacaoSelecionada.set(null);
  }

  protected tentarNovamente(): void {
    if (!this.carregando()) {
      this.carregar();
    }
  }

  /** Cada tentativa cancela a anterior — clicar "Tentar novamente" várias vezes não deixa uma resposta atrasada chegar por último. */
  private carregar(): void {
    this.carregamentoEmAndamento?.unsubscribe();
    this.erro.set(null);
    this.carregando.set(true);
    this.carregamentoEmAndamento = this.repository.listarNaoFinalizadas().subscribe({
      next: (publicacoes) => this.ativas.set(publicacoes),
      error: () => {
        this.erro.set('Não foi possível carregar as publicações.');
        this.carregando.set(false);
      },
      complete: () => this.carregando.set(false),
    });
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
