import { Signal, computed, effect, untracked } from '@angular/core';
import { ehCursorDePaginacaoObsoleto } from './pagination';
import { ProblemDetails } from './problem-details';

/**
 * Entradas de {@link useCursorObsoletoRecovery}: a listagem paginada por
 * cursor que o caller monitora, e os dois pontos de extensão que variam por
 * tela — como voltar para a primeira página e como avisar o operador.
 */
export interface UseCursorObsoletoRecoveryOptions<TPagina> {
  /** `ProblemDetails` da última resposta da listagem (ex.: `lista.problem`). */
  readonly problem: Signal<ProblemDetails | null>;
  /** Página de navegação atual — `undefined` identifica a primeira página. */
  readonly pagina: Signal<TPagina | undefined>;
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
 */
export function useCursorObsoletoRecovery<TPagina>(
  options: UseCursorObsoletoRecoveryOptions<TPagina>,
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
