import { decimalDoCampo } from './numero-do-campo';

/**
 * Fração de dia útil não tem leitura unívoca — meio expediente, doze horas dentro do dia, ou
 * metade de um dia civil que numa transição de fuso nem sempre tem vinte e quatro horas. As
 * três fecham a janela em instantes diferentes, e o servidor recusa em vez de eleger uma.
 * Prazo menor que um dia se declara em horas.
 */
export function fracaoDeDiaUtil(prazo: string, unidade: string): boolean {
  if (unidade !== 'diasUteis') return false;
  const valor = decimalDoCampo(prazo);
  return valor !== null && !Number.isInteger(valor);
}
