/**
 * Gramática de moeda em reais aceita pelos campos de valor do editor: dígitos,
 * ponto como separador de milhar e vírgula com até duas casas decimais.
 *
 * Existe porque `Number` não serve para ler o que o operador digita. Em pt-BR
 * `1.000` é mil, e `Number('1.000')` é 1 — o valor passava na validação e era
 * gravado como outro número, com a tela continuando a exibir o que foi
 * digitado. `Number` também aceita notação científica e hexadecimal, que não
 * são moeda, e recusa `1.000,50`, que é.
 *
 * Cada ponto exige exatamente três dígitos à frente, de modo que `1.00` e
 * `1.0000` são recusados em vez de adivinhados: são justamente as formas em
 * que separador de milhar e separador decimal se confundem.
 */
const VALOR_EM_REAIS = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;

/**
 * Dígitos antes da vírgula, limitados pelo que o servidor grava: a coluna é
 * `numeric(12,2)`, logo dez inteiros e dois centavos. O teto também mantém a
 * conversão dentro da faixa que o `Number` representa exatamente — sem ele, a
 * gramática aceitaria dígitos sem fim e devolveria um valor arredondado, que é
 * o mesmo defeito por outro caminho.
 */
const MAXIMO_DIGITOS_INTEIROS = 10;

/** Como o campo espera o valor, para hint e mensagem de recusa. */
export const FORMATO_VALOR_EM_REAIS =
  'Use apenas números, com vírgula antes dos centavos — por exemplo, 1.000,50. ' +
  'O maior valor aceito é 9.999.999.999,99.';

/**
 * Valor que o texto representa, ou `null` quando ele não é um valor em reais.
 * Nunca devolve um número diferente do que está escrito.
 */
export function analisarValorEmReais(texto: string): number | null {
  const partes = VALOR_EM_REAIS.exec(texto.trim());
  if (partes === null) return null;

  const inteiro = partes[1].replaceAll('.', '');
  if (inteiro.length > MAXIMO_DIGITOS_INTEIROS) return null;

  // `,5` são cinquenta centavos, não cinco.
  const centavos = (partes[2] ?? '').padEnd(2, '0');
  return Number(`${inteiro}.${centavos}`);
}

/** Texto do valor na mesma gramática que o campo aceita. */
export function formatarValorEmReais(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
