/**
 * Clica num link que existe só durante o clique. Ele entra na página para o clique valer em todo
 * navegador e sai logo em seguida.
 */
export function clicarEmLinkTransitorio(
  href: string,
  ajustar: (link: HTMLAnchorElement) => void,
): void {
  const link = document.createElement('a');
  link.href = href;
  link.hidden = true;
  ajustar(link);
  document.body.appendChild(link);
  link.click();
  link.remove();
}
