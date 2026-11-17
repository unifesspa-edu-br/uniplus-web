import { decimalDoCampo } from '../shared/numero-do-campo';
import { textoDoNumero } from './texto-do-campo';

const CASAS_DA_CONTA = 10;

/** Tira o ruído de ponto flutuante de uma conta entre fração e percentual (0,3 × 100). */
function semRuido(numero: number): number {
  return Number(numero.toFixed(CASAS_DA_CONTA));
}

/** A fração do documento como o campo a escreve: percentual, com vírgula decimal. */
export function percentualDaFracao(fracao: number | null | undefined): string {
  return textoDoNumero(fracao == null ? undefined : semRuido(fracao * 100));
}

/** O percentual digitado como a fração do documento; o que não é número não vira fração. */
export function fracaoDoPercentual(texto: string): number | undefined {
  const percentual = decimalDoCampo(texto);
  return percentual === null ? undefined : semRuido(percentual / 100);
}
