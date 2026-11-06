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

import { contadorDeFalhas, type ContadorDeFalhas } from '../contador-de-falhas';

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
  /** Falhas seguidas: 1 na falha que abre o alerta, mais uma a cada "Tentar novamente"
   *  que falha de novo; 0 depois de uma carga com itens. Recarga automática que falha
   *  recomeça em 1. */
  readonly tentativasSemSucesso: Signal<number>;
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
  readonly falhas: ContadorDeFalhas;
  /** A tentativa em curso foi pedida pelo operador em "Tentar novamente". */
  readonly doOperador: WritableSignal<boolean>;
  /** O alerta que estava na tela quando o operador pediu a tentativa em curso. */
  readonly falhaAntesDaTentativa: WritableSignal<boolean>;
  registrarFalha(): void;
}

function estadoDaLista<T>(): EstadoDaLista<T> {
  const falhas = contadorDeFalhas();
  const doOperador = signal(false);
  const falhaAntesDaTentativa = signal(false);
  return {
    ultimaUtil: signal<readonly T[]>([]),
    ultimoProblema: signal<ProblemDetails | null>(null),
    falhas,
    doOperador,
    falhaAntesDaTentativa,
    registrarFalha: () =>
      falhas.registrarFalha(untracked(doOperador) && untracked(falhaAntesDaTentativa)),
  };
}

/** Itens das páginas da tentativa em curso, até a última chegar. */
interface Coleta<T> {
  itens: readonly T[];
}

function registrarPagina<T>(
  resultado: ApiResult<readonly T[]>,
  fonte: FonteDaLista<T>,
  estado: EstadoDaLista<T>,
  coleta: Coleta<T>,
): void {
  if (!resultado.ok) {
    estado.ultimoProblema.set(resultado.problem);
    estado.registrarFalha();
    return;
  }
  estado.ultimoProblema.set(null);
  coleta.itens = [
    ...coleta.itens,
    ...resultado.data.map(fonte.normalizar).filter(fonte.utilizavel),
  ];
  if (extractNextCursor(resultado.headers.get('Link')) !== null) {
    return;
  }
  if (coleta.itens.length > 0) {
    estado.ultimaUtil.set(coleta.itens);
    estado.falhas.registrarSucesso();
  } else {
    estado.registrarFalha();
  }
}

/** Lê todas as páginas, guarda os itens utilizáveis e registra o desfecho da tentativa. */
function lookupColetor<T>(
  fonte: FonteDaLista<T>,
  estado: EstadoDaLista<T>,
  destroyRef: DestroyRef,
): LookupCompleto<T> {
  const coleta: Coleta<T> = { itens: [] };
  const aoFalhar = (): void => {
    estado.ultimoProblema.set(null);
    estado.registrarFalha();
  };
  return lookupCompleto<T>((cursor) => {
    if (cursor === undefined) {
      coleta.itens = [];
    }
    const aoReceber = (resultado: ApiResult<readonly T[]>): void =>
      registrarPagina(resultado, fonte, estado, coleta);
    return fonte.listar(cursor).pipe(tap({ next: aoReceber, error: aoFalhar }));
  }, destroyRef);
}

/** Os itens e o estado de falha que a tela enxerga, derivados da consulta e do estado. */
function sinaisDaLista<T>(
  lookup: LookupCompleto<T>,
  estado: EstadoDaLista<T>,
  fonte: FonteDaLista<T>,
): Pick<ListaDeReferencia<T>, 'opcoes' | 'comErro' | 'falhou'> {
  const atuais = computed(() => lookup.opcoes().map(fonte.normalizar).filter(fonte.utilizavel));
  /** Os itens da última lista utilizável: a recusa mantém os anteriores (`lookupCompleto`
   *  não os limpa), e a resposta vazia também. */
  const opcoes = computed(() => (atuais().length > 0 ? atuais() : estado.ultimaUtil()));
  /** `true` quando a última tentativa não trouxe itens: recusada, com erro ou vazia. */
  const comErro = computed(() => lookup.comErro() || (!lookup.pendente() && atuais().length === 0));
  const falhou = computed(() => {
    if (lookup.pendente()) {
      return estado.doOperador() && estado.falhaAntesDaTentativa();
    }
    return comErro() && opcoes().length === 0;
  });
  return { opcoes, comErro, falhou };
}

type Acionamentos = Pick<
  ListaDeReferencia<unknown>,
  'garantirCarregado' | 'recarregar' | 'tentarDeNovo'
>;

function acionamentosDaLista<T>(
  lookup: LookupCompleto<T>,
  estado: EstadoDaLista<T>,
  sinais: Pick<ListaDeReferencia<T>, 'comErro' | 'falhou'>,
): Acionamentos {
  let iniciado = false;
  const buscar = (pedidaPeloOperador: boolean): void => {
    iniciado = true;
    estado.falhaAntesDaTentativa.set(pedidaPeloOperador && untracked(sinais.falhou));
    estado.doOperador.set(pedidaPeloOperador);
    lookup.recarregar();
  };
  return {
    garantirCarregado: () => {
      if (iniciado && untracked(lookup.pendente)) {
        // Uma tela nova pede a lista enquanto corre o "Tentar novamente" de outra: para
        // ela, a tentativa é automática, e a falha da visita anterior não aparece.
        estado.doOperador.set(false);
        return;
      }
      if (iniciado && !untracked(sinais.comErro)) {
        return;
      }
      buscar(false);
    },
    recarregar: () => buscar(false),
    tentarDeNovo: () => buscar(true),
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
  return {
    ...sinais,
    ...acionamentosDaLista(lookup, estado, sinais),
    pendente: lookup.pendente,
    ultimoProblema: estado.ultimoProblema.asReadonly(),
    tentativasSemSucesso: estado.falhas.valor,
  };
}

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
  lista: Pick<ListaDeReferencia<unknown>, 'ultimoProblema'>,
  avisar: () => boolean = () => true,
): Signal<string | null> {
  const problemI18n = inject(ProblemI18nService);
  const notifications = inject(NotificationService);
  let jaAvisado = untracked(lista.ultimoProblema);
  effect(() => {
    const problema = lista.ultimoProblema();
    if (problema !== null && problema !== jaAvisado && problema.status >= 500 && avisar()) {
      jaAvisado = problema;
      untracked(() => notifications.errorFromProblem(problema));
    }
  });
  return computed(() => {
    const problema = lista.ultimoProblema();
    return problema === null ? null : problemI18n.resolve(problema).title;
  });
}
