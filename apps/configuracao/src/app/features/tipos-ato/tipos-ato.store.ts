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
import { PUBLICACOES_BASE_PATH, TipoAtoPublicadoDto } from '@uniplus/shared-data/publicacoes';
import { navegacaoPorCursor } from '../../shared/navegacao-por-cursor';

/**
 * Janela de cada página (cursor pagination, ADR-0026), no teto que a API aceita. Acima dele a
 * resposta é 422. O teto importa aqui porque a busca é local: o contrato da listagem não tem
 * parâmetro de texto, então quanto mais linhas a página traz, menos casos sobram em que a busca
 * não alcança o catálogo todo.
 */
const PAGE_SIZE = 100;

/**
 * Estado da listagem de tipos de ato: vigências, paginação e recarga. A listagem não aceita
 * filtro de texto, só vigentes, cursor e limite, então a busca recorta a página carregada.
 */
@Injectable()
export class TiposAtoStore {
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly basePath = inject(PUBLICACOES_BASE_PATH);

  readonly termoBusca = signal('');
  readonly somenteEmVigor = signal(false);

  /** Trocar o recorte de vigência volta à primeira página: o cursor carrega a consulta antiga. */
  private readonly pagina = linkedSignal<boolean, CursorPagina | undefined>({
    source: this.somenteEmVigor,
    computation: () => undefined,
  });

  private readonly lista = useApiResource<readonly TipoAtoPublicadoDto[]>(() => ({
    url: `${this.basePath}/api/publicacoes/tipos-ato`,
    params: this.montarParams(),
    context: withVendorMime('tipo-ato', 1),
  }));

  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);

  readonly carregando = this.lista.isLoading;
  readonly atos = this.navegacao.itens;
  readonly anterior = this.navegacao.anterior;
  readonly proximo = this.navegacao.proximo;

  readonly atosFiltrados = computed(() => {
    const termo = this.termoBusca().trim().toLocaleLowerCase('pt-BR');
    if (termo.length === 0) {
      return this.atos();
    }
    return this.atos().filter(
      (ato) =>
        ato.codigo.toLocaleLowerCase('pt-BR').includes(termo) ||
        ato.nome.toLocaleLowerCase('pt-BR').includes(termo),
    );
  });

  /**
   * Cursor que não continua esta consulta (400) ou que expirou (410): recomeça a paginação sem
   * cursor e avisa o operador, em vez de deixar a tela presa numa página que não existe mais,
   * cujo "Tentar novamente" repetiria o mesmo cursor indefinidamente.
   */
  private readonly recuperandoDeCursorObsoleto = useCursorObsoletoRecovery({
    problem: this.lista.problem,
    pagina: this.pagina,
    reiniciarPagina: () => this.pagina.set(undefined),
    aoRecuperar: (problem) => {
      this.notifications.info(
        problem && ehCursorDePaginacaoExpirado(problem)
          ? 'A listagem ficou aberta tempo demais e a consulta expirou.'
          : 'A paginação foi reiniciada porque a consulta mudou.',
        'Recarregamos a listagem do começo.',
      );
    },
  });

  readonly mensagemDeErro = computed<string | null>(() => {
    // A recuperação de cursor obsoleto avisa por notificação; um alerta de "não foi possível
    // carregar" descreveria mal um estado que já está se resolvendo.
    if (this.recuperandoDeCursorObsoleto()) {
      return null;
    }
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar tipos de ato.' : null;
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
    const base = new HttpParams().set('vigentes', String(this.somenteEmVigor()));
    const pagina = this.pagina();
    if (pagina === undefined) {
      return base.set('limit', String(PAGE_SIZE));
    }
    return base.set('cursor', cursorToString(pagina.cursor)).set('direction', pagina.direction);
  }
}
