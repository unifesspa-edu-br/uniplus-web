/** O texto aparado, terminado em pontuação de fim de frase, para outra frase vir depois. */
export function comPontoFinal(texto: string): string {
  const frase = texto.trim();
  return /[.!?]$/u.test(frase) ? frase : `${frase}.`;
}
