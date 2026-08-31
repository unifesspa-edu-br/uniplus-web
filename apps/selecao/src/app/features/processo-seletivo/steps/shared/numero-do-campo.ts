/**
 * Leitura dos campos numéricos do editor que **não** são moeda — peso, nota
 * mínima, percentual, quantidade.
 *
 * `Number` sozinho não serve: ele aceita notação científica e hexadecimal, que
 * nenhum desses campos é, lendo `1e2` como 100 e `0x10` como 16.
 *
 * A gramática aqui difere de propósito da de moeda (`analisarValorEmReais`).
 * Ali o ponto é separador de milhar, porque `1.000` reais é mil; aqui ele é
 * separador decimal, porque nenhuma dessas grandezas chega à casa do milhar e
 * `0.5` é meio, não cinco. Tratar o ponto como agrupador nestes campos faria
 * `0.5` virar 5 — peso e nota mínima dez vezes maiores, gravados sem recusa,
 * porque 5 é um peso perfeitamente válido.
 */

/**
 * Aceita só dígitos, sem sinal nem notação exótica.
 *
 * Recusa também o que estoura o alcance do número: uma sequência longa demais
 * de dígitos passa na forma e vira `Infinity`, que a serialização JSON manda no
 * corpo como `null` — o campo chegaria ao servidor apagado, e não recusado.
 */
export function inteiroDoCampo(texto: string): number | null {
  const limpo = texto.trim();
  return /^\d+$/.test(limpo) ? finitoOuNulo(Number(limpo)) : null;
}

/** Aceita vírgula ou ponto como separador decimal, sem notação exótica. */
export function decimalDoCampo(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(limpo) ? finitoOuNulo(Number(limpo)) : null;
}

function finitoOuNulo(valor: number): number | null {
  return Number.isFinite(valor) ? valor : null;
}
