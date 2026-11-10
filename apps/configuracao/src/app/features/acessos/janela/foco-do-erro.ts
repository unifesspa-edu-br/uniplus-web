import { Injector, Signal, afterNextRender, effect, inject, untracked } from '@angular/core';

/**
 * Quando a recusa aparece, o foco vai ao bloco que a mostra, depois de renderizar. Chamar em
 * contexto de injeção, no componente que hospeda o bloco com `tabindex="-1"`.
 */
export function focarQuandoAparecer(mensagem: Signal<string | null>, idDoBloco: string): void {
  const injector = inject(Injector);
  effect(() => {
    if (mensagem() === null) return;
    untracked(() =>
      afterNextRender(() => document.getElementById(idDoBloco)?.focus(), { injector }),
    );
  });
}
