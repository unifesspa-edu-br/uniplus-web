import { Signal, computed, effect, untracked } from '@angular/core';
import { Cursor, PaginationDirection, ehCursorDePaginacaoObsoleto } from './pagination';
import { ProblemDetails } from './problem-details';

/** Estado de uma página de navegação por cursor bidirecional (ADR-0026 item 2). */
export interface CursorPagina {
  readonly cursor: Cursor;
  readonly direction: PaginationDirection;
}

/**
 * Entradas de {@link useCursorObsoletoRecovery}: a listagem paginada por
 * cursor que o caller monitora, e os dois pontos de extensão que variam por
 * tela — como voltar para a primeira página e como avisar o operador.
 */
export interface UseCursorObsoletoRecoveryOptions {
  /** `ProblemDetails` da última resposta da listagem (ex.: `lista.problem`). */
  readonly problem: Signal<ProblemDetails | null>;
  /** Página de navegação atual — `undefined` identifica a primeira página. */
  readonly pagina: Signal<CursorPagina | undefined>;
  /** Volta `pagina` para `undefined`, disparando a request sem cursor. */
  readonly reiniciarPagina: () => void;
  /** Avisa o operador; recebe o `ProblemDetails` para distinguir 400 de 410. */
  readonly aoRecuperar: (problem: ProblemDetails | null) => void;
}

/**
 * Trata cursor de paginação obsoleto (400 `uniplus.cursor.invalido` / 410
 * `uniplus.cursor.expirado`, CA-14c): ao navegar para uma página cujo cursor
 * não continua mais a consulta, reinicia a paginação do começo e avisa o
 * operador — em vez de deixar a tela vazia ou presa numa página que não
 * existe mais.
 *
 * Deve ser chamado em contexto de injeção (constructor de componente,
 * factory, ou `runInInjectionContext`) — mesma exigência de `useApiResource`.
 *
 * O `Signal<boolean>` retornado é a mesma decisão consultada tanto pelo
 * `effect` interno quanto pelo `errorMessage` do caller: na primeira página
 * (`pagina() === undefined`) é sempre `false` — não há cursor a descartar nem
 * para onde "voltar", então um 400/410 ali cai na mensagem genérica de erro,
 * não numa tela muda.
 *
 * **Por que um `effect` que escreve em `pagina` (via `reiniciarPagina`), e não
 * um `linkedSignal`** (a ADR-0026 recomenda `linkedSignal` para estado
 * derivado e desaconselha "effect para atualizar outro signal"): o reset não
 * é uma derivação pura de `pagina` — depende de `problem`, que só existe
 * *depois* da resposta HTTP que a própria mudança de `pagina` disparou. Um
 * `linkedSignal` cuja `computation` lesse `problem()` para decidir o valor de
 * `pagina` criaria um ciclo (a página decidiria a página, via uma resposta
 * que só a página anterior causou). O reset aqui é reação a um evento
 * assíncrono externo — a resposta 400/410 — não recomputação de estado
 * derivado de outros signals; é exatamente o caso que `effect` existe para
 * cobrir. `reiniciarPagina` e `aoRecuperar` rodam dentro do mesmo
 * `untracked`, na mesma ordem (reset antes do aviso), então o próprio efeito
 * não relê `recuperando()` depois de mudar `pagina` — sem risco de
 * reentrância.
 */
export function useCursorObsoletoRecovery(
  options: UseCursorObsoletoRecoveryOptions,
): Signal<boolean> {
  const { problem, pagina, reiniciarPagina, aoRecuperar } = options;

  const recuperando = computed(() => {
    const atual = problem();
    return atual != null && ehCursorDePaginacaoObsoleto(atual) && pagina() !== undefined;
  });

  effect(() => {
    if (!recuperando()) {
      return;
    }
    const atual = untracked(problem);
    untracked(() => {
      reiniciarPagina();
      aoRecuperar(atual);
    });
  });

  return recuperando;
}
