import {
  DestroyRef,
  Signal,
  WritableSignal,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import {
  ApiResult,
  ProblemI18nService,
  extractNextCursor,
  lookupCompleto,
  type Cursor,
  type LookupCompleto,
  type ProblemDetails,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { Observable, tap } from 'rxjs';

/**
 * Lista de referência que a tela precisa para funcionar (vocabulário, áreas): carga,
 * falha com alerta e "Tentar novamente".
 *
 * Sobre `lookupCompleto`, acrescenta as regras de uma lista que sempre tem itens:
 * - lista vazia é falha de carga, como a recusa;
 * - o alerta (`falhou`) só aparece quando não há lista utilizável: se a recarga falha,
 *   ou volta vazia, e já havia lista, a tela segue com a anterior;
 * - durante a tentativa pedida pelo operador (`tentarDeNovo`), a falha anterior continua
 *   na tela até a tentativa terminar: o alerta não some levando o botão com o foco;
 * - durante uma recarga automática (`garantirCarregado`, `recarregar`), a falha anterior
 *   não aparece: ela é de outra visita, e anunciá-la de novo seria falso.
 */
export interface ListaDeReferencia<T> extends LookupCompleto<T> {
  /** Se a tela deve mostrar o alerta de falha, com "Tentar novamente". */
  readonly falhou: Signal<boolean>;
  /** A recusa da API na última tentativa, para o alerta dizer o motivo (ex.: falta de
   *  permissão) e a tela avisar o erro de servidor com o traceId; `null` quando a
   *  última tentativa deu certo ou falhou sem resposta da API. */
  readonly ultimoProblema: Signal<ProblemDetails | null>;
  /** Busca na primeira vez e reaproveita o que já está em memória; depois de uma
   *  falha, tenta outra vez. */
  garantirCarregado(): void;
  /** Nova tentativa pedida pelo operador em "Tentar novamente". */
  tentarDeNovo(): void;
}

/** Como a tela lê a lista: a consulta e o que ela considera um item utilizável. */
interface FonteDaLista<T> {
  readonly listar: (cursor?: Cursor) => Observable<ApiResult<readonly T[]>>;
  readonly utilizavel: (item: T) => boolean;
  readonly normalizar: (item: T) => T;
}

interface EstadoDaLista<T> {
  /** A última lista completa com itens: continua valendo se a recarga voltar vazia. */
  readonly ultimaUtil: WritableSignal<readonly T[]>;
  readonly ultimoProblema: WritableSignal<ProblemDetails | null>;
  /** A tentativa em curso foi pedida pelo operador em "Tentar novamente". */
  readonly doOperador: WritableSignal<boolean>;
  /** O alerta que estava na tela quando o operador pediu a tentativa em curso. */
  readonly falhaAntesDaTentativa: WritableSignal<boolean>;
}

function estadoDaLista<T>(): EstadoDaLista<T> {
  const doOperador = signal(false);
  const falhaAntesDaTentativa = signal(false);
  return {
    ultimaUtil: signal<readonly T[]>([]),
    ultimoProblema: signal<ProblemDetails | null>(null),
    doOperador,
    falhaAntesDaTentativa,
  };
}

/** Lê as páginas de uma tentativa, junta os itens utilizáveis e registra o desfecho dela. */
class ColetaDaLista<T> {
  /** Itens das páginas da tentativa em curso, até a última chegar. */
  private itens: readonly T[] = [];

  constructor(
    private readonly fonte: FonteDaLista<T>,
    private readonly estado: EstadoDaLista<T>,
  ) {}

  paginaDe(cursor?: Cursor): Observable<ApiResult<readonly T[]>> {
    if (cursor === undefined) {
      this.itens = [];
    }
    const aoFalhar = (): void => this.estado.ultimoProblema.set(null);
    return this.fonte
      .listar(cursor)
      .pipe(tap({ next: (resultado) => this.registrarPagina(resultado), error: aoFalhar }));
  }

  private registrarPagina(resultado: ApiResult<readonly T[]>): void {
    if (!resultado.ok) {
      this.estado.ultimoProblema.set(resultado.problem);
      return;
    }
    this.estado.ultimoProblema.set(null);
    this.itens = [
      ...this.itens,
      ...resultado.data.map(this.fonte.normalizar).filter(this.fonte.utilizavel),
    ];
    if (extractNextCursor(resultado.headers.get('Link')) === null && this.itens.length > 0) {
      this.estado.ultimaUtil.set(this.itens);
    }
  }
}

/** Lê todas as páginas, guarda os itens utilizáveis e registra o desfecho da tentativa. */
function lookupColetor<T>(
  fonte: FonteDaLista<T>,
  estado: EstadoDaLista<T>,
  destroyRef: DestroyRef,
): LookupCompleto<T> {
  const coleta = new ColetaDaLista(fonte, estado);
  return lookupCompleto<T>((cursor) => coleta.paginaDe(cursor), destroyRef);
}

type SinaisDaLista<T> = Pick<
  ListaDeReferencia<T>,
  'opcoes' | 'comErro' | 'falhou' | 'pendente' | 'ultimoProblema'
>;

/** Os itens e o estado de falha que a tela enxerga, derivados da consulta e do estado. */
function sinaisDaLista<T>(
  lookup: LookupCompleto<T>,
  estado: EstadoDaLista<T>,
  fonte: FonteDaLista<T>,
): SinaisDaLista<T> {
  const itens = itensDaLista(lookup, estado, fonte);
  return {
    ...itens,
    falhou: falhaParaMostrar(lookup, estado, itens),
    pendente: lookup.pendente,
    ultimoProblema: estado.ultimoProblema.asReadonly(),
  };
}

function itensDaLista<T>(
  lookup: LookupCompleto<T>,
  estado: EstadoDaLista<T>,
  fonte: FonteDaLista<T>,
): Pick<ListaDeReferencia<T>, 'opcoes' | 'comErro'> {
  const atuais = computed(() => lookup.opcoes().map(fonte.normalizar).filter(fonte.utilizavel));
  /** Os itens da última lista utilizável: a recusa mantém os anteriores (`lookupCompleto`
   *  não os limpa), e a resposta vazia também. */
  const opcoes = computed(() => (atuais().length > 0 ? atuais() : estado.ultimaUtil()));
  /** `true` quando a última tentativa não trouxe itens: recusada, com erro ou vazia. */
  const comErro = computed(() => lookup.comErro() || (!lookup.pendente() && atuais().length === 0));
  return { opcoes, comErro };
}

function falhaParaMostrar<T>(
  lookup: LookupCompleto<T>,
  estado: EstadoDaLista<T>,
  itens: Pick<ListaDeReferencia<T>, 'opcoes' | 'comErro'>,
): Signal<boolean> {
  return computed(() => {
    if (lookup.pendente()) {
      return estado.doOperador() && estado.falhaAntesDaTentativa();
    }
    return itens.comErro() && itens.opcoes().length === 0;
  });
}

/** As ações da tela sobre a lista e o que já foi pedido. */
class AcionamentosDaLista<T> {
  #iniciado = false;
  readonly #lookup: LookupCompleto<T>;
  readonly #estado: EstadoDaLista<T>;
  readonly #sinais: Pick<ListaDeReferencia<T>, 'comErro' | 'falhou'>;

  constructor(
    lookup: LookupCompleto<T>,
    estado: EstadoDaLista<T>,
    sinais: Pick<ListaDeReferencia<T>, 'comErro' | 'falhou'>,
  ) {
    this.#lookup = lookup;
    this.#estado = estado;
    this.#sinais = sinais;
  }

  readonly garantirCarregado = (): void => {
    if (this.#iniciado && untracked(this.#lookup.pendente)) {
      // Uma tela nova pede a lista enquanto corre o "Tentar novamente" de outra: para
      // ela, a tentativa é automática, e a falha da visita anterior não aparece.
      this.#estado.doOperador.set(false);
      return;
    }
    if (this.#iniciado && !untracked(this.#sinais.comErro)) {
      return;
    }
    this.#buscar(false);
  };

  readonly recarregar = (): void => this.#buscar(false);

  readonly tentarDeNovo = (): void => this.#buscar(true);

  #buscar(pedidaPeloOperador: boolean): void {
    this.#iniciado = true;
    this.#estado.falhaAntesDaTentativa.set(pedidaPeloOperador && untracked(this.#sinais.falhou));
    this.#estado.doOperador.set(pedidaPeloOperador);
    this.#lookup.recarregar();
  }
}

type AcoesDaLista<T> = Pick<
  ListaDeReferencia<T>,
  'garantirCarregado' | 'recarregar' | 'tentarDeNovo'
>;

function acoesDaLista<T>(
  lookup: LookupCompleto<T>,
  estado: EstadoDaLista<T>,
  sinais: SinaisDaLista<T>,
): AcoesDaLista<T> {
  const acoes = new AcionamentosDaLista(lookup, estado, sinais);
  return {
    garantirCarregado: acoes.garantirCarregado,
    recarregar: acoes.recarregar,
    tentarDeNovo: acoes.tentarDeNovo,
  };
}

/**
 * @param utilizavel Item que a tela consegue usar, já normalizado. Os demais são
 *   descartados na chegada, e uma resposta sem nenhum item utilizável conta como lista
 *   vazia (falha de carga).
 * @param normalizar Ajuste de cada item na chegada (ex.: aparar o código), antes de
 *   `utilizavel`: nenhum consumidor da lista vê o item cru.
 */
export function listaDeReferencia<T>(
  listar: (cursor?: Cursor) => Observable<ApiResult<readonly T[]>>,
  destroyRef: DestroyRef,
  utilizavel: (item: T) => boolean = () => true,
  normalizar: (item: T) => T = (item) => item,
): ListaDeReferencia<T> {
  const fonte: FonteDaLista<T> = { listar, utilizavel, normalizar };
  const estado = estadoDaLista<T>();
  const lookup = lookupColetor(fonte, estado, destroyRef);
  const sinais = sinaisDaLista(lookup, estado, fonte);
  return { ...sinais, ...acoesDaLista(lookup, estado, sinais) };
}

type ComUltimoProblema = Pick<ListaDeReferencia<unknown>, 'ultimoProblema'>;

/**
 * O motivo da falha de uma lista para o alerta — o título da recusa da API (ex.: falta
 * de permissão), ou `null` quando a falha não teve resposta da API — e o aviso do erro
 * de servidor, com o traceId para o suporte. O aviso sai só para falha acontecida com a
 * tela aberta: a de uma visita anterior, guardada num catálogo raiz, já foi avisada.
 *
 * `avisar` diz se a lista está sendo pedida pelo fluxo do usuário: com `false`, a falha
 * de uma carga de fundo não gera aviso, e ele sai quando `avisar` volta a `true` (uma
 * única vez por falha).
 *
 * Chamar em contexto de injeção (inicializador de campo ou construtor).
 */
export function motivoDaFalha(
  lista: ComUltimoProblema,
  avisar: () => boolean = () => true,
): Signal<string | null> {
  const problemI18n = inject(ProblemI18nService);
  avisarFalhaDeServidor(lista, avisar);
  return computed(() => {
    const problema = lista.ultimoProblema();
    return problema === null ? null : problemI18n.resolve(problema).title;
  });
}

function avisarFalhaDeServidor(lista: ComUltimoProblema, avisar: () => boolean): void {
  const notifications = inject(NotificationService);
  let jaAvisado = untracked(lista.ultimoProblema);
  effect(() => {
    const problema = lista.ultimoProblema();
    if (problema !== null && problema !== jaAvisado && problema.status >= 500 && avisar()) {
      jaAvisado = problema;
      untracked(() => notifications.errorFromProblem(problema));
    }
  });
}
