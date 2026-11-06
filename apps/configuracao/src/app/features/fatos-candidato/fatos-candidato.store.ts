import { HttpParams } from '@angular/common/http';
import {
  Injectable,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import {
  CursorPagina,
  ProblemI18nService,
  cursorToString,
  ehCursorDePaginacaoExpirado,
  useApiResource,
  useCursorObsoletoRecovery,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CONFIGURACAO_BASE_PATH, FatoCandidatoDto } from '@uniplus/shared-data/configuracao';
import { navegacaoPorCursor } from '../../shared/navegacao-por-cursor';
import { AprovacaoDoCatalogo } from '../../shared/protecao-do-catalogo';

/** Tamanho da janela de cada página (cursor pagination, ADR-0026). */
const PAGE_SIZE = 50;

/**
 * Estado da listagem de fatos do candidato: filtros de origem e situação, busca sobre a página
 * carregada, paginação e recarga. A API filtra por origem e situação, não por texto.
 */
@Injectable()
export class FatosCandidatoStore {
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  private readonly aprovacao = inject(AprovacaoDoCatalogo);

  readonly termoBusca = signal('');
  readonly filtroOrigem = signal('');
  /** Começa em "Ativos": é esse o padrão que fica de fora, não "Todos". */
  readonly filtroSituacao = signal('true');

  /** O cursor pertence ao filtro com que foi emitido: trocar o filtro volta à primeira página. */
  private readonly pagina = linkedSignal<string, CursorPagina | undefined>({
    source: () => JSON.stringify([this.filtroOrigem(), this.filtroSituacao()]),
    computation: () => undefined,
  });

  private readonly lista = useApiResource<readonly FatoCandidatoDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/admin/fatos-candidato`,
    params: this.montarParams(),
    context: withVendorMime('fato-candidato', 1),
  }));

  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);

  readonly carregando = this.lista.isLoading;
  readonly fatos = this.navegacao.itens;
  readonly anterior = this.navegacao.anterior;
  readonly proximo = this.navegacao.proximo;

  readonly fatosBuscados = computed(() => {
    const termo = this.termoBusca().trim().toLocaleLowerCase('pt-BR');
    return termo.length === 0
      ? this.fatos()
      : this.fatos().filter((fato) =>
          [fato.codigo, fato.nome].some((texto) => contem(texto, termo)),
        );
  });

  /**
   * Cursor recusado (consulta mudou ou expirou): reinicia a lista do começo, porque "Tentar
   * novamente" repetiria o mesmo cursor morto indefinidamente.
   */
  private readonly recuperandoDeCursorObsoleto = useCursorObsoletoRecovery({
    problem: this.lista.problem,
    pagina: this.pagina,
    reiniciarPagina: () => this.pagina.set(undefined),
    aoRecuperar: (problem) =>
      this.notifications.info(
        problem && ehCursorDePaginacaoExpirado(problem)
          ? 'A listagem ficou aberta tempo demais e a consulta expirou.'
          : 'A paginação foi reiniciada porque a consulta mudou.',
        'Recarregamos a listagem do começo.',
      ),
  });

  readonly mensagemDeErro = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem && this.recuperandoDeCursorObsoleto()) return null;
    return problem ? this.problemI18n.resolve(problem).title : null;
  });

  constructor() {
    this.aprovacao.carregar();
    effect(() => {
      const problem = this.lista.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });
  }

  /** O fato da página carregada com este id, ou `null` se a releitura o tirou dela. */
  fatoDe(id: string | null): FatoCandidatoDto | null {
    return id === null ? null : (this.fatos().find((fato) => fato.id === id) ?? null);
  }

  proximaPagina(): void {
    this.navegacao.irParaProxima();
  }

  paginaAnterior(): void {
    this.navegacao.irParaAnterior();
  }

  tentarNovamente(): void {
    this.lista.reload();
  }

  /** Volta à primeira página e relê a situação de aprovação: criar ou editar muda o que a solicitação leva. */
  recarregar(): void {
    this.aprovacao.carregar();
    if (this.pagina() === undefined) {
      this.lista.reload();
    } else {
      this.pagina.set(undefined);
    }
  }

  private montarParams(): HttpParams {
    let params = new HttpParams();
    const origem = this.filtroOrigem();
    const situacao = this.filtroSituacao();
    if (origem !== '') params = params.set('origem', origem);
    if (situacao !== '') params = params.set('ativo', situacao);
    const pagina = this.pagina();
    return pagina === undefined
      ? params.set('limit', String(PAGE_SIZE))
      : params.set('cursor', cursorToString(pagina.cursor)).set('direction', pagina.direction);
  }
}

function contem(texto: string, termo: string): boolean {
  return texto.toLocaleLowerCase('pt-BR').includes(termo);
}
