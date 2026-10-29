/** O rótulo que o operador reconhece: a sigla e o nome da unidade. */
export function rotuloDaUnidade(unidade: {
  readonly sigla: string;
  readonly nome: string;
}): string {
  return `${unidade.sigla} — ${unidade.nome}`;
}
