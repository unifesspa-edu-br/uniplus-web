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
import {
  CONFIGURACAO_BASE_PATH,
  ReferenciaReservaDemograficaDto,
} from '@uniplus/shared-data/configuracao';
import { navegacaoPorCursor } from '../../shared/navegacao-por-cursor';

const PAGE_SIZE = 100;

/** Consulta e navegação das referências demográficas. */
@Injectable()
export class ReservaDemograficaStore {
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  private readonly pagina = signal<CursorPagina | undefined>(undefined);
  private readonly lista = useApiResource<readonly ReferenciaReservaDemograficaDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/referencias-reserva-demografica`,
    params: this.montarParams(),
    context: withVendorMime('referencia-reserva-demografica', 1),
  }));
  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);

  readonly carregando = this.lista.isLoading;
  readonly referencias = this.navegacao.itens;
  readonly anterior = this.navegacao.anterior;
  readonly proximo = this.navegacao.proximo;
  readonly termoBusca = signal('');
  readonly temFiltro = computed(() => this.termoBusca().trim().length > 0);
  readonly referenciasFiltradas = computed(() => {
    const termo = this.termoBusca().trim().toLocaleLowerCase('pt-BR');
    if (termo.length === 0) return this.referencias();
    return this.referencias().filter((ref) =>
      ref.censoReferencia.toLocaleLowerCase('pt-BR').includes(termo),
    );
  });
  readonly mensagemDeErro = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) return this.problemI18n.resolve(problem).title;
    return this.lista.error() ? 'Erro inesperado ao carregar referências.' : null;
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
    if (!this.carregando()) this.lista.reload();
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
    if (pagina === undefined) return new HttpParams().set('limit', String(PAGE_SIZE));
    return new HttpParams()
      .set('cursor', cursorToString(pagina.cursor))
      .set('direction', pagina.direction);
  }
}
