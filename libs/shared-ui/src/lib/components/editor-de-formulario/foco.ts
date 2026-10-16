import { Injector, afterNextRender } from '@angular/core';

/**
 * Leva o foco, depois da próxima renderização, ao primeiro dos elementos que existir e não estiver
 * desabilitado. Mover, acrescentar e remover trocam o nó de lugar e levam o foco com ele: os ids
 * seguintes são o destino quando o primeiro sumiu ou ficou desabilitado. O id de um `ui-combobox`
 * é o do hospedeiro, que não recebe foco: o destino é o campo de texto dele.
 */
export function focarDepois(injector: Injector, ...ids: readonly string[]): void {
  afterNextRender(
    () => {
      const alvo = ids
        .map((id) => document.getElementById(id))
        .map((elemento) => (elemento?.tagName === 'UI-COMBOBOX' ? elemento.querySelector<HTMLElement>('[role="combobox"]') : elemento))
        .find((elemento): elemento is HTMLElement => elemento !== null && !(elemento as HTMLButtonElement).disabled);
      alvo?.focus();
    },
    { injector },
  );
}
