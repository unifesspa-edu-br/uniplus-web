/** O número como o campo o escreve, com vírgula decimal; ausente é campo vazio, nunca zero. */
export function textoDoNumero(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '' : String(valor).replace('.', ',');
}

/** O texto sem as bordas em branco, ou `undefined` quando nada foi preenchido. */
export function textoPreenchido(texto: string): string | undefined {
  const limpo = texto.trim();
  return limpo === '' ? undefined : limpo;
}
