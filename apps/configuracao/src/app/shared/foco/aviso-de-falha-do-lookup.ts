import { Signal, computed, effect, signal } from '@angular/core';

/** O que o aviso precisa saber de um catálogo carregado por inteiro (`lookupCompleto`). */
export interface LeituraDeCatalogo {
  readonly comErro: Signal<boolean>;
  readonly pendente: Signal<boolean>;
}

/**
 * Quando o aviso de falha de um catálogo está na tela: enquanto o catálogo falha e durante a
 * nova tentativa que segue a falha. O catálogo zera `comErro` ao começar a tentativa, e o aviso
 * sairia da tela com o botão "Tentar novamente", que ainda tem o foco: ele só sai quando a
 * tentativa dá certo (ver `focarAposNovaTentativa`).
 *
 * Chamar em contexto de injeção (inicializador de campo ou construtor).
 */
export function avisoDeFalhaDoLookup(catalogo: LeituraDeCatalogo): Signal<boolean> {
  const houveFalha = signal(false);
  effect(() => {
    if (catalogo.comErro()) houveFalha.set(true);
    else if (!catalogo.pendente()) houveFalha.set(false);
  });
  return computed(() => catalogo.comErro() || (catalogo.pendente() && houveFalha()));
}
