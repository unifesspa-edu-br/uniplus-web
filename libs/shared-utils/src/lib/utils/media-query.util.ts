import { DOCUMENT, DestroyRef, type Signal, inject, signal } from '@angular/core';

/**
 * Expõe o resultado de uma media query como signal somente leitura, atualizado a cada `change`.
 *
 * Exige contexto de injeção (construtor ou inicializador de campo): lê `DOCUMENT` e `DestroyRef`
 * via `inject()`, e o listener é removido quando o contexto é destruído. Sem `matchMedia`
 * (SSR, ambiente sem janela) o valor permanece `false`.
 */
export function mediaQuerySignal(query: string): Signal<boolean> {
  const janela = inject(DOCUMENT).defaultView;
  const destroyRef = inject(DestroyRef);

  if (typeof janela?.matchMedia !== 'function') {
    return signal(false).asReadonly();
  }

  const mediaQuery = janela.matchMedia(query);
  const resultado = signal(mediaQuery.matches);

  const aoMudar = (event: MediaQueryListEvent): void => {
    resultado.set(event.matches);
  };

  mediaQuery.addEventListener('change', aoMudar);

  destroyRef.onDestroy(() => {
    mediaQuery.removeEventListener('change', aoMudar);
  });

  return resultado.asReadonly();
}
