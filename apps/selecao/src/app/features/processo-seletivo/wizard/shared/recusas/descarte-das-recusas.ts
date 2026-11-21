import { effect, untracked } from '@angular/core';

import type { ProcessoSeletivoStore } from '../../processo-seletivo.store';

/**
 * Descarta as recusas da gravação quando o processo muda e quando o passo Cronograma deixa de ser
 * o corrente. A página mantém o passo montado e só o esconde, então sair do passo não destrói o
 * serviço: é este descarte que faz a próxima gravação devolver as recusas. Precisa de contexto de
 * injeção.
 */
export function descartarAsRecusasAoSairDoPasso(
  store: ProcessoSeletivoStore,
  descartar: () => void,
): void {
  effect(() => {
    store.geracao();
    untracked(descartar);
  });
  effect(() => {
    if (!store.cronogramaVisivel()) untracked(descartar);
  });
}
