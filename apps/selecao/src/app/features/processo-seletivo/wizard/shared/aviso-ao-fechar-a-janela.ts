import { type Signal, effect } from '@angular/core';

/**
 * Pede ao navegador a confirmação de recarregar ou fechar a aba enquanto `pendente` for verdadeiro.
 * O ouvinte só existe nesse intervalo e sai com o contexto de quem chamou. O navegador ignora o
 * texto que se ponha e mostra o aviso dele: basta o `preventDefault`.
 *
 * Só chama em contexto de injeção, porque o ciclo de vida é o do `effect`.
 */
export function avisarAoFecharAJanelaEnquanto(pendente: Signal<boolean>): void {
  effect((aoLimpar) => {
    if (!pendente()) return;

    const pedirConfirmacao = (evento: BeforeUnloadEvent): void => evento.preventDefault();
    globalThis.addEventListener('beforeunload', pedirConfirmacao);
    aoLimpar(() => globalThis.removeEventListener('beforeunload', pedirConfirmacao));
  });
}
