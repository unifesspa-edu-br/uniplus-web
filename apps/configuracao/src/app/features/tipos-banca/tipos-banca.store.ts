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
import { CONFIGURACAO_BASE_PATH, TipoBancaDto } from '@uniplus/shared-data/configuracao';
import { navegacaoPorCursor } from '../../shared/navegacao-por-cursor';

/** Tamanho da janela de cada página (cursor pagination, ADR-0026). */
const PAGE_SIZE = 50;

/**
 * Estado da listagem de tipos-banca: consulta, paginação e recarga.
 */
@Injectable()
export class TiposBancaStore {
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  private readonly pagina = signal<CursorPagina | undefined>(undefined);

  private readonly lista = useApiResource<readonly TipoBancaDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/tipos-banca`,
    params: this.montarParams(),
    context: withVendorMime('tipo-banca', 1),
  }));

  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);

  readonly carregando = this.lista.isLoading;
  readonly bancas = this.navegacao.itens;
  readonly termoBusca = signal('');
  readonly temFiltro = computed(() => this.termoBusca().trim().length > 0);
  readonly bancasFiltradas = computed(() => {
    const termo = this.termoBusca().trim().toLocaleLowerCase('pt-BR');
    return this.bancas().filter(
      (banca) =>
        banca.codigo.toLocaleLowerCase('pt-BR').includes(termo) ||
        banca.nome.toLocaleLowerCase('pt-BR').includes(termo),
    );
  });
  readonly anterior = this.navegacao.anterior;
  readonly proximo = this.navegacao.proximo;

  readonly mensagemDeErro = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar tipos de banca.' : null;
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
