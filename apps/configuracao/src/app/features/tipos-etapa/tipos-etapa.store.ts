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
import { CONFIGURACAO_BASE_PATH, TipoEtapaDto } from '@uniplus/shared-data/configuracao';
import { navegacaoPorCursor } from '../../shared/navegacao-por-cursor';

const PAGE_SIZE = 50;

@Injectable()
export class TiposEtapaStore {
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  private readonly pagina = signal<CursorPagina | undefined>(undefined);

  private readonly lista = useApiResource<readonly TipoEtapaDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/tipos-etapa`,
    params: this.montarParams(),
    context: withVendorMime('tipo-etapa', 1),
  }));

  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);

  readonly carregando = this.lista.isLoading;
  readonly resultado = this.lista.value;
  readonly tipos = this.navegacao.itens;
  readonly termoBusca = signal('');
  readonly tiposFiltrados = computed(() => {
    const termo = this.termoBusca().trim().toLocaleLowerCase('pt-BR');
    if (termo.length === 0) {
      return this.tipos();
    }
    return this.tipos().filter(
      (tipo) =>
        tipo.codigo.toLocaleLowerCase('pt-BR').includes(termo) ||
        tipo.nome.toLocaleLowerCase('pt-BR').includes(termo),
    );
  });
  readonly temFiltro = computed(() => this.termoBusca().trim().length > 0);
  readonly anterior = this.navegacao.anterior;
  readonly proximo = this.navegacao.proximo;

  readonly mensagemDeErro = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar tipos de etapa.' : null;
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
