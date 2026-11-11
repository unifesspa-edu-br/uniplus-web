import { Injector, Signal, afterNextRender, effect, inject, untracked } from '@angular/core';
import { focoEstaLivre } from '../../../shared/foco';

/**
 * Quando uma escrita termina, o botão que a acionou pode ter saído da tela. Se ninguém tomou o foco
 * (a sobreposição fechada o devolve ao acionador que ainda existe), ele vai ao título da página.
 *
 * Chamar em contexto de injeção.
 */
export function devolverFocoAoTitulo(gravando: Signal<boolean>, idDoTitulo: string): void {
  const injector = inject(Injector);
  let estavaGravando = false;
  effect(() => {
    const agora = gravando();
    const terminou = estavaGravando && !agora;
    estavaGravando = agora;
    if (!terminou) return;
    untracked(() =>
      afterNextRender(
        () => {
          if (focoEstaLivre()) document.getElementById(idDoTitulo)?.focus();
        },
        { injector },
      ),
    );
  });
}
