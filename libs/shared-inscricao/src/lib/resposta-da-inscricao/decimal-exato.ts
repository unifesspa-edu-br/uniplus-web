const DECIMAL_EXATO = /^(-?)(\d+)(?:\.(\d+))?$/;
const MILHAR = /\B(?=(\d{3})+(?!\d))/g;

/**
 * O decimal exato da API com vírgula decimal e sem separador de milhar, como o formulário do
 * candidato escreve o número, por manipulação do texto: passar por `Number` perderia a precisão
 * que o contrato preserva. Texto que não é decimal volta como veio.
 */
export function formatarDecimalExato(decimal: string): string {
  const partes = DECIMAL_EXATO.exec(decimal.trim());
  if (partes === null) return decimal;
  const [, sinal, inteiro, fracao] = partes;
  return `${sinal}${inteiro}${fracao === undefined ? '' : `,${fracao}`}`;
}

/**
 * O decimal exato da API como valor em reais, "R$ 1.234,56", por manipulação do texto: sem `Number`,
 * a precisão do contrato se mantém. Ao menos duas casas decimais; texto que não é decimal volta como veio.
 */
export function formatarMoeda(decimal: string): string {
  const partes = DECIMAL_EXATO.exec(decimal.trim());
  if (partes === null) return decimal;
  const [, sinal, inteiro, fracao = ''] = partes;
  return `${sinal}R$ ${inteiro.replace(MILHAR, '.')},${fracao.padEnd(2, '0')}`;
}
