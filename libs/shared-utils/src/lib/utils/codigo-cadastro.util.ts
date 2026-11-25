export const CODIGO_CADASTRO_FORMATO = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/u;
export const CODIGO_TAMANHO_MAXIMO = 80;

export function textoDoFormatoDoCodigo(limite: number): string {
  return `Use letras maiúsculas e algarismos, com as palavras separadas por um sublinhado, começando por letra, até ${Math.min(limite, CODIGO_TAMANHO_MAXIMO)} caracteres.`;
}

/**
 * Sugere um código sem impor a alteração ao operador. Devolve vazio quando o
 * resultado não serve ao formato. Mantém o tamanho para o campo avisar quando exceder o limite.
 * @example sugerirCodigoDeCadastro('Laudo médico') // 'LAUDO_MEDICO'
 * @example sugerirCodigoDeCadastro('21 de abril') // ''
 */
export function sugerirCodigoDeCadastro(nome: string): string {
  const candidato = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-zA-Z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .toLocaleUpperCase('pt-BR');
  return CODIGO_CADASTRO_FORMATO.test(candidato) ? candidato : '';
}
