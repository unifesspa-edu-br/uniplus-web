import { HttpParams } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  CursorPagina,
  ProblemI18nService,
  cursorToString,
  ehCursorDePaginacaoObsoleto,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  BaseLegalBonusRegionalDto,
  CONFIGURACAO_BASE_PATH,
} from '@uniplus/shared-data/configuracao';
import { navegacaoPorCursor } from '../../shared/navegacao-por-cursor';

/** Tamanho da janela de cada página (cursor pagination, ADR-0026). */
const PAGE_SIZE = 50;

/**
 * Estado da listagem de bases legais: página, busca, paginação e recarga. O contrato da listagem
 * só pagina por cursor, sem filtro de texto, então a busca recorta a página carregada.
 */
@Injectable()
export class BaseLegalBonusRegionalStore {
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  private readonly pagina = signal<CursorPagina | undefined>(undefined);

  private readonly lista = useApiResource<readonly BaseLegalBonusRegionalDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/base-legal-bonus-regional`,
    params: this.montarParams(),
    context: withVendorMime('base-legal-bonus-regional', 1),
  }));

  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);

  readonly carregando = this.lista.isLoading;
  readonly bases = this.navegacao.itens;
  readonly anterior = this.navegacao.anterior;
  readonly proximo = this.navegacao.proximo;
  readonly termoBusca = signal('');
  readonly temFiltro = computed(() => this.termoBusca().trim().length > 0);

  readonly basesFiltradas = computed(() => {
    const termo = this.termoBusca().trim().toLocaleLowerCase('pt-BR');
    if (termo.length === 0) {
      return this.bases();
    }
    return this.bases().filter((base) =>
      base.identificacao.toLocaleLowerCase('pt-BR').includes(termo),
    );
  });

  readonly mensagemDeErro = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar as bases legais.' : null;
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

  /**
   * Um cursor rejeitado (400/410) nunca volta a valer: repetir a mesma página travaria o
   * "Tentar novamente" num laço de erro. Nesse caso a listagem recomeça do início.
   */
  tentarNovamente(): void {
    if (this.carregando()) {
      return;
    }
    const problem = this.lista.problem();
    if (problem && ehCursorDePaginacaoObsoleto(problem)) {
      this.recarregar();
      return;
    }
    this.lista.reload();
  }

  /** Volta à primeira página, para a lista refletir o que acabou de ser gravado. */
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
