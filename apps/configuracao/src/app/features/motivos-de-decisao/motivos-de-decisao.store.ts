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
import { MotivoDeDecisaoDto, SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { navegacaoPorCursor, recuperarDeCursorObsoleto } from '../../shared/navegacao-por-cursor';
import { TIPO_INICIAL } from './tipos-de-motivo';

const PAGE_SIZE = 50;

/** Estado da listagem do cadastro de motivos: o tipo escolhido, os desativados, a busca e a paginação. */
@Injectable()
export class MotivosDeDecisaoStore {
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly basePath = inject(SELECAO_BASE_PATH);
  private readonly pagina = signal<CursorPagina | undefined>(undefined);

  readonly tipo = signal(TIPO_INICIAL);
  readonly comDesativados = signal(false);
  readonly termoBusca = signal('');

  private readonly lista = useApiResource<readonly MotivoDeDecisaoDto[]>(() => ({
    url: `${this.basePath}/api/selecao/motivos-de-decisao`,
    params: this.montarParams(),
    context: withVendorMime('motivo-de-decisao', 1),
  }));
  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);

  readonly motivos = this.navegacao.itens;
  readonly anterior = this.navegacao.anterior;
  readonly proximo = this.navegacao.proximo;
  readonly motivosFiltrados = computed(() => {
    const termo = this.termoBusca().trim().toLocaleLowerCase('pt-BR');
    if (termo.length === 0) return this.motivos();
    return this.motivos().filter(
      (motivo) =>
        motivo.codigo.toLocaleLowerCase('pt-BR').includes(termo) ||
        motivo.descricao.toLocaleLowerCase('pt-BR').includes(termo),
    );
  });
  readonly temFiltro = computed(() => this.termoBusca().trim().length > 0);
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
    if (this.recuperandoDeCursorObsoleto()) return null;
    const problem = this.lista.problem();
    if (problem) return this.problemI18n.resolve(problem).title;
    return this.lista.error() ? 'Erro inesperado ao carregar os motivos de decisão.' : null;
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

  /** Trocar o tipo ou a visão dos desativados volta à primeira página do novo recorte. */
  escolherTipo(tipo: string): void {
    this.tipo.set(tipo);
    this.pagina.set(undefined);
  }

  alternarDesativados(incluir: boolean): void {
    this.comDesativados.set(incluir);
    this.pagina.set(undefined);
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
    const filtro = new HttpParams()
      .set('tipo', this.tipo())
      .set('apenasAtivos', String(!this.comDesativados()));
    if (pagina === undefined) return filtro.set('limit', String(PAGE_SIZE));
    return filtro.set('cursor', cursorToString(pagina.cursor)).set('direction', pagina.direction);
  }
}
