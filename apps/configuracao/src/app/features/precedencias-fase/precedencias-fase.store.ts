import { HttpParams } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  CursorPagina,
  ProblemI18nService,
  cursorToString,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CONFIGURACAO_BASE_PATH, PrecedenciaFaseDto } from '@uniplus/shared-data/configuracao';
import { navegacaoPorCursor, recuperarDeCursorObsoleto } from '../../shared/navegacao-por-cursor';
import { FasesDoGrafoStore } from './fases-do-grafo.store';

/**
 * Janela da listagem. Um grafo acíclico sobre as dezesseis fases canônicas comporta até 120
 * arestas (16 × 15 ÷ 2), acima desta janela: o pager navega por cursor entre as páginas, e a busca
 * no navegador vale apenas para a página carregada.
 */
const PAGE_SIZE = 100;

@Injectable()
export class PrecedenciasFaseStore {
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  private readonly fases = inject(FasesDoGrafoStore);

  private readonly pagina = signal<CursorPagina | undefined>(undefined);

  private readonly lista = useApiResource<readonly PrecedenciaFaseDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/precedencias-fase`,
    params: this.montarParams(),
    context: withVendorMime('precedencia-fase', 1),
  }));

  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);

  readonly arestas = this.navegacao.itens;
  readonly termoBusca = signal('');
  /** O endpoint só aceita cursor e limite, sem filtro de texto: a busca casa código e nome na página carregada. */
  readonly arestasFiltradas = computed(() => {
    const termo = this.termoBusca().trim().toLocaleLowerCase('pt-BR');
    if (termo.length === 0) {
      return this.arestas();
    }
    return this.arestas().filter((aresta) =>
      [
        aresta.antecessoraCodigo,
        aresta.sucessoraCodigo,
        this.fases.nomeDaFase(aresta.antecessoraCodigo),
        this.fases.nomeDaFase(aresta.sucessoraCodigo),
      ].some((alvo) => alvo.toLocaleLowerCase('pt-BR').includes(termo)),
    );
  });
  readonly temFiltro = computed(() => this.termoBusca().trim().length > 0);
  readonly anterior = this.navegacao.anterior;
  readonly proximo = this.navegacao.proximo;

  private readonly recuperandoDeCursorObsoleto = recuperarDeCursorObsoleto({
    problem: this.lista.problem,
    pagina: this.pagina,
    notificacoes: this.notifications,
  });

  /** Inclui o intervalo entre o cursor recusado e a nova leitura. */
  readonly carregando = computed(
    () => this.lista.isLoading() || this.recuperandoDeCursorObsoleto(),
  );

  readonly mensagemDeErro = computed<string | null>(() => {
    if (this.recuperandoDeCursorObsoleto()) {
      return null;
    }
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar as precedências de fase.' : null;
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

  proximaPagina(): void {
    this.navegacao.irParaProxima();
  }

  paginaAnterior(): void {
    this.navegacao.irParaAnterior();
  }

  tentarNovamente(): void {
    if (!this.carregando()) {
      this.lista.reload();
    }
  }

  recarregar(): void {
    if (this.pagina() === undefined) {
      this.lista.reload();
    } else {
      this.pagina.set(undefined);
    }
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
}
