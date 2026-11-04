/**
 * O id de um elemento da fase, único por instância: o Cronograma embute um passo destes por fase
 * aberta, e com id fixo o rótulo, o `aria-describedby` e o `aria-controls` da segunda fase
 * apontariam para os da primeira.
 */
export function idDaFase(faseCodigo: string, sufixo: string): string {
  return `fase-${faseCodigo}-${sufixo}`;
}
