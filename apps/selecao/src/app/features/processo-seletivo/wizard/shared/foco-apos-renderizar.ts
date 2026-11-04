import { afterNextRender, Injector } from '@angular/core';

/**
 * Leva o foco ao primeiro destino que existir e estiver habilitado, depois que a tela renderizar.
 *
 * A espera é por renderização, não por microtask: o ciclo de detecção do Angular roda depois que a
 * fila de microtasks drena, e consultar o DOM antes disso acharia o elemento que está prestes a
 * sair, ou não acharia o que está prestes a entrar. Os destinos vêm do preferido ao de reserva.
 */
export function focarAposRenderizar(injector: Injector, ...ids: readonly string[]): void {
  afterNextRender(() => primeiroDestinoDisponivel(ids)?.focus(), { injector });
}

/**
 * Como `focarAposRenderizar`, mas só recupera o foco que se perdeu: quem já levou o foco para
 * outro campo não é arrastado de volta.
 */
export function focarAposRenderizarSeSemFoco(injector: Injector, ...ids: readonly string[]): void {
  afterNextRender(
    () => {
      const ativo = document.activeElement;
      if (ativo !== null && ativo !== document.body) return;
      primeiroDestinoDisponivel(ids)?.focus();
    },
    { injector },
  );
}

function primeiroDestinoDisponivel(ids: readonly string[]): HTMLElement | undefined {
  return ids
    .map((id) => document.getElementById(id))
    .find(
      (elemento): elemento is HTMLElement =>
        elemento !== null && !(elemento as HTMLButtonElement).disabled,
    );
}
