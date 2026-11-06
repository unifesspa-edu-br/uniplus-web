/**
 * Ninguém tem o foco: ele está no `body`, ou num botão de sobreposição já fechada, que ainda
 * consta como ativo até o navegador retirá-lo.
 */
export function focoEstaLivre(): boolean {
  const ativo = document.activeElement;
  return ativo === null || ativo === document.body || ativo.closest('dialog:not([open])') !== null;
}
