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
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import {
  CursorPagina,
  ProblemI18nService,
  STATUS_HTTP,
  cursorToString,
  ehCursorDePaginacaoExpirado,
  useApiResource,
  useCursorObsoletoRecovery,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CONFIGURACAO_BASE_PATH, CursoDto } from '@uniplus/shared-data/configuracao';
import { DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE_OPTIONS } from '@uniplus/shared-ui/components';
import { CatalogoGruposAreaEnem } from '../../shared/grupos-area-enem';
import { navegacaoPorCursor } from '../../shared/navegacao-por-cursor';

/**
 * Debounce da busca textual — uma request por rajada de digitação, não por tecla (mesmo padrão de
 * Unidades). No Angular 21.x o caminho oficial é a interop `toObservable → debounceTime → toSignal`.
 */
const BUSCA_DEBOUNCE_MS = 300;

/**
 * Estado da listagem de cursos: busca no servidor, limite, paginação e recarga.
 */
@Injectable()
export class CursosStore {
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  private readonly grupos = inject(CatalogoGruposAreaEnem);

  readonly termoBusca = signal('');
  /** Itens por página escolhidos no rodapé; só em memória (volta ao padrão a cada visita). */
  readonly limite = signal<number>(DEFAULT_PAGE_SIZE);
  readonly opcoesLimite = DEFAULT_PAGE_SIZE_OPTIONS;

  /**
   * Termo aplicado à busca server-side (`?q=`) — debounced. O backend filtra por código/nome; o
   * cliente não filtra em memória (o filtro só valeria para a página carregada).
   */
  private readonly buscaAplicada = toSignal(
    toObservable(this.termoBusca).pipe(
      map((termo) => termo.trim()),
      debounceTime(BUSCA_DEBOUNCE_MS),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );

  /** Há busca ativa? Distingue "sem cursos" de "busca sem resultado" no estado vazio. */
  readonly temBusca = computed(() => this.buscaAplicada().length > 0);

  /**
   * Página corrente (`undefined` = primeira). Volta à primeira sempre que a busca ou o limite
   * mudam: o cursor da página atual carrega o filtro e a janela antigos, então navegar a partir
   * dele ignoraria a mudança.
   */
  private readonly pagina = linkedSignal<string, CursorPagina | undefined>({
    source: () => JSON.stringify([this.buscaAplicada(), this.limite()]),
    computation: () => undefined,
  });

  private readonly lista = useApiResource<readonly CursoDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/cursos`,
    params: this.montarParams(),
    context: withVendorMime('curso', 1),
  }));

  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);

  readonly carregando = this.lista.isLoading;
  readonly anterior = this.navegacao.anterior;
  readonly proximo = this.navegacao.proximo;
  readonly cursos = this.navegacao.itens;

  /**
   * Os cursos como a tela os mostra: o grupo com o rótulo do vocabulário quando ele o tem, como no
   * select, para o mesmo grupo não aparecer com dois textos. Até o vocabulário chegar (ou se ele
   * falhar), vale o rótulo do registro.
   */
  readonly cursosExibidos = computed(() =>
    this.cursos().map((curso) =>
      curso.grupoAreaEnem
        ? { ...curso, grupoAreaEnem: this.grupos.exibivel(curso.grupoAreaEnem) }
        : curso,
    ),
  );

  /**
   * Cursor que não continua esta consulta (400) ou que expirou (410): recomeça a paginação sem
   * cursor e avisa o operador, em vez de deixar a tela vazia ou presa numa página que não existe.
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
      const { title, detail } = this.problemI18n.resolve(problem);
      // 422 de `q`: a API nomeia o motivo no `detail` — é o texto que o operador precisa para corrigir.
      return problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO && detail ? detail : title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar cursos.' : null;
  });

  constructor() {
    // A tabela usa o rótulo do vocabulário. A falha desta carga de fundo não aparece na
    // listagem: o alerta de grupos só existe no formulário, que tenta de novo ao abrir.
    this.grupos.garantirCarregado();
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
   * Troca o limite. A página é derivada do limite, então a mudança já volta à primeira página e
   * redispara o GET.
   */
  aoTrocarLimite(valor: number | null): void {
    if (valor !== null && valor !== this.limite()) {
      this.limite.set(valor);
    }
  }

  limparBusca(): void {
    this.termoBusca.set('');
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
    let params = new HttpParams();
    // `q` acompanha toda página: o cursor keyset carrega a âncora e a ordem, não o predicado de
    // filtro — omiti-lo na navegação traria itens fora da busca (mesmo contrato de Unidades).
    const q = this.buscaAplicada();
    if (q.length > 0) {
      params = params.set('q', q);
    }
    const pagina = this.pagina();
    if (pagina === undefined) {
      // Sem `sort`: a apresentação padrão consome a ordem alfabética que a API já devolve.
      return params.set('limit', String(this.limite()));
    }
    return params.set('cursor', cursorToString(pagina.cursor)).set('direction', pagina.direction);
  }
}
