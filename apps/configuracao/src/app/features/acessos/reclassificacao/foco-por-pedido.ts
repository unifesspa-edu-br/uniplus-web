import {
  ElementRef,
  Injector,
  Signal,
  afterNextRender,
  effect,
  inject,
  untracked,
} from '@angular/core';

/**
 * Leva o foco ao elemento do próprio componente cada vez que o pedido cresce; o zero é o estado
 * inicial e não pede nada. Chamar em contexto de injeção.
 */
export function focarQuandoPedir(
  pedido: Signal<number>,
  alvo: Signal<ElementRef<HTMLElement> | undefined>,
): void {
  const injector = inject(Injector);
  effect(() => {
    if (pedido() === 0) return;
    untracked(() => afterNextRender(() => alvo()?.nativeElement.focus(), { injector }));
  });
}
