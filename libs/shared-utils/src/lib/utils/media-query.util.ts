import { DestroyRef, inject, signal } from '@angular/core';

export function mediaQuerySignal(query: string, destroyRef: DestroyRef = inject(DestroyRef)) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return signal(false);
  }

  const mediaQuery = window.matchMedia(query);
  const resultado = signal(mediaQuery.matches);

  const aoMudar = (event: MediaQueryListEvent): void => {
    resultado.set(event.matches);
  };

  mediaQuery.addEventListener('change', aoMudar);

  destroyRef.onDestroy(() => {
    mediaQuery.removeEventListener('change', aoMudar);
  });

  return resultado;
}
