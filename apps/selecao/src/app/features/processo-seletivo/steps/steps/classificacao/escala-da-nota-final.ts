import { numeroOuNuloDaApi } from '@uniplus/shared-utils';

import { decimalDoCampo } from '../../shared/numero-do-campo';

/** O item da conferência que aponta a classificação por fórmula local sem a escala da nota final. */
export const CODIGO_ESCALA_DA_NOTA_FINAL_NAO_DECLARADA =
  'classificacao_escala_nota_final_nao_declarada';

/** O servidor aceita a escala com até quatro casas decimais. */
const MAXIMO_DE_CASAS = 4;

/** No pt-BR o ponto separa milhar: `1.000` é mil, não um, e o campo recusa em vez de adivinhar. */
const ESCRITA_COM_PONTO_DE_MILHAR = /^\d{1,3}(\.\d{3})+$/;

/** Como o campo espera a escala, para a ajuda e para a recusa de texto que não é número. */
export const FORMATO_DA_ESCALA_DA_NOTA_FINAL = `Use apenas números, com vírgula antes das casas decimais, até ${MAXIMO_DE_CASAS} — por exemplo, 10, 100 ou 1000. Não use separador de milhar.`;

/**
 * O número que o texto escreve, na mesma gramática dos demais campos decimais do assistente, ou
 * `null` quando está vazio, não é número ou passa do limite de casas. Se o número é maior que zero
 * é regra do servidor.
 */
export function escalaDaNotaFinal(texto: string): number | null {
  const limpo = texto.trim();
  if (ESCRITA_COM_PONTO_DE_MILHAR.test(limpo)) return null;
  const casas = limpo.replace(',', '.').split('.')[1]?.length ?? 0;
  return casas > MAXIMO_DE_CASAS ? null : decimalDoCampo(limpo);
}

/** Texto preenchido que não é número: o que o mapeador descartaria, e a tela recusa. */
export function escalaDaNotaFinalIlegivel(texto: string): boolean {
  return texto.trim() !== '' && escalaDaNotaFinal(texto) === null;
}

/** A escala que o servidor devolve, escrita como o campo a lê. */
export function escalaDaNotaFinalComoTexto(valor: number | string | null | undefined): string {
  const numero = numeroOuNuloDaApi(valor);
  return numero === null ? '' : String(numero).replace('.', ',');
}

/** A faixa da nota final, escrita como o campo a lê (sem separador de milhar): de zero até a escala declarada, ou `null` sem escala legível e maior que zero. */
export function faixaDaNotaFinal(texto: string): string | null {
  const escala = escalaDaNotaFinal(texto);
  return escala === null || escala <= 0 ? null : `0 a ${escalaDaNotaFinalComoTexto(escala)}`;
}

/** A escala como a consulta e a confirmação a leem: a faixa, ou o que impede de lê-la. */
export function leituraDaEscalaDaNotaFinal(texto: string): string {
  return faixaDaNotaFinal(texto) ?? (texto.trim() === '' ? 'não declarada' : texto);
}
