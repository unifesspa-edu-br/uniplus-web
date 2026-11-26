export const CODIGO_CADASTRO_FORMATO = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/u;
export const CODIGO_TAMANHO_MAXIMO = 80;

export function textoDoFormatoDoCodigo(limite: number): string {
  return `Use letras maiúsculas e algarismos, com as palavras separadas por um sublinhado, começando por letra, até ${Math.min(limite, CODIGO_TAMANHO_MAXIMO)} caracteres.`;
}
