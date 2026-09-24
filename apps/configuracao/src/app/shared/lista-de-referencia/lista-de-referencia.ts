import { DestroyRef, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
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

import { contadorDeFalhas } from '../contador-de-falhas';

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

/**
 * @param utilizavel Item que a tela consegue usar. Os demais são descartados na chegada,
 *   e uma resposta sem nenhum item utilizável conta como lista vazia (falha de carga).
 */
export function listaDeReferencia<T>(
  listar: (cursor?: Cursor) => Observable<ApiResult<readonly T[]>>,
  destroyRef: DestroyRef,
  utilizavel: (item: T) => boolean = () => true,
): ListaDeReferencia<T> {
  /** A última lista completa com itens: continua valendo se a recarga voltar vazia. */
  const ultimaUtil = signal<readonly T[]>([]);
  const ultimoProblema = signal<ProblemDetails | null>(null);
  const falhas = contadorDeFalhas();
  let iniciado = false;
  /** A tentativa em curso foi pedida pelo operador em "Tentar novamente". */
  const doOperador = signal(false);
  /** O alerta que estava na tela quando o operador pediu a tentativa em curso. */
  const falhaAntesDaTentativa = signal(false);
  const registrarFalha = (): void =>
    falhas.registrarFalha(untracked(doOperador) && untracked(falhaAntesDaTentativa));
  /** Itens das páginas da tentativa em curso, até a última chegar. */
  let coletados: readonly T[] = [];
  const lookup = lookupCompleto<T>(
    (cursor) => {
      if (cursor === undefined) {
        coletados = [];
      }
      return listar(cursor).pipe(
        tap({
          next: (resultado) => {
            if (!resultado.ok) {
              ultimoProblema.set(resultado.problem);
              registrarFalha();
              return;
            }
            ultimoProblema.set(null);
            coletados = [...coletados, ...resultado.data.filter(utilizavel)];
            const ultimaPagina = extractNextCursor(resultado.headers.get('Link')) === null;
            if (!ultimaPagina) {
              return;
            }
            if (coletados.length > 0) {
              ultimaUtil.set(coletados);
              falhas.registrarSucesso();
            } else {
              registrarFalha();
            }
          },
          error: () => {
            ultimoProblema.set(null);
            registrarFalha();
          },
        }),
      );
    },
    destroyRef,
  );

  const atuais = computed(() => lookup.opcoes().filter(utilizavel));
  /** Os itens da última lista utilizável: a recusa mantém os anteriores (`lookupCompleto`
   *  não os limpa), e a resposta vazia também. */
  const opcoes = computed(() => (atuais().length > 0 ? atuais() : ultimaUtil()));
  /** `true` quando a última tentativa não trouxe itens: recusada, com erro ou vazia. */
  const comErro = computed(
    () => lookup.comErro() || (!lookup.pendente() && atuais().length === 0),
  );
  const falhou = computed(() => {
    if (lookup.pendente()) {
      return doOperador() && falhaAntesDaTentativa();
    }
    return comErro() && opcoes().length === 0;
  });

  const buscar = (pedidaPeloOperador: boolean): void => {
    iniciado = true;
    falhaAntesDaTentativa.set(pedidaPeloOperador && untracked(falhou));
    doOperador.set(pedidaPeloOperador);
    lookup.recarregar();
  };

  return {
    opcoes,
    pendente: lookup.pendente,
    comErro,
    falhou,
    ultimoProblema: ultimoProblema.asReadonly(),
    tentativasSemSucesso: falhas.valor,
    garantirCarregado: () => {
      if (iniciado && untracked(lookup.pendente)) {
        // Uma tela nova pede a lista enquanto corre o "Tentar novamente" de outra: para
        // ela, a tentativa é automática, e a falha da visita anterior não aparece.
        doOperador.set(false);
        return;
      }
      if (iniciado && !untracked(comErro)) {
        return;
      }
      buscar(false);
    },
    recarregar: () => buscar(false),
    tentarDeNovo: () => buscar(true),
  };
}

/**
 * O motivo da falha de uma lista para o alerta — o título da recusa da API (ex.: falta
 * de permissão), ou `null` quando a falha não teve resposta da API — e o aviso do erro
 * de servidor, com o traceId para o suporte. O aviso sai só para falha acontecida com a
 * tela aberta: a de uma visita anterior, guardada num catálogo raiz, já foi avisada.
 *
 * Chamar em contexto de injeção (inicializador de campo ou construtor).
 */
export function motivoDaFalha(
  lista: Pick<ListaDeReferencia<unknown>, 'ultimoProblema'>,
): Signal<string | null> {
  const problemI18n = inject(ProblemI18nService);
  const notifications = inject(NotificationService);
  const jaAvisado = untracked(lista.ultimoProblema);
  effect(() => {
    const problema = lista.ultimoProblema();
    if (problema !== null && problema !== jaAvisado && problema.status >= 500) {
      untracked(() => notifications.errorFromProblem(problema));
    }
  });
  return computed(() => {
    const problema = lista.ultimoProblema();
    return problema === null ? null : problemI18n.resolve(problema).title;
  });
}
