import type {
  EtapaPontuada,
  ItemDeAvaliacaoDaEtapa,
  NivelDeAtendimentoDaEtapa,
} from '../processo-seletivo.models';
import { FORMA_HUMANA } from './forma-de-avaliacao';
import { decimalDoCampo } from './numero-do-campo';

/** A escala do edital de referência (PSR 2027): o que o botão "Usar a escala sugerida" preenche. */
export const ESCALA_SUGERIDA: readonly NivelDeAtendimentoDaEtapa[] = [
  { rotulo: 'Atendeu', percentual: '100' },
  { rotulo: 'Atendeu parcialmente', percentual: '50' },
  { rotulo: 'Não atendeu', percentual: '0' },
];

const CASAS_DA_SOMA = 1e4;

/**
 * A pontuação mostrada com as quatro casas que o servidor guarda: com o arredondamento padrão de
 * três casas, uma soma de 10,0004 apareceria como "10 de 10" ao lado do aviso de divergência.
 */
const FORMATADOR_DA_PONTUACAO = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });

/**
 * A soma das pontuações máximas dos itens, arredondada às quatro casas que o servidor guarda:
 * sem isso, 0,1 + 0,2 não bateria com 0,3 e a soma correta seria apontada como divergente.
 * Pontuação que não é número não entra na soma.
 */
export function somaDosItens(itens: readonly ItemDeAvaliacaoDaEtapa[]): number {
  const bruta = itens.reduce(
    (total, item) => total + (decimalDoCampo(item.pontuacaoMaxima) ?? 0),
    0,
  );
  return Math.round(bruta * CASAS_DA_SOMA) / CASAS_DA_SOMA;
}

/** A soma dos itens difere da nota máxima da etapa; sem item ou sem nota máxima numérica não há o que comparar. */
export function somaForaDaNotaMaxima(
  itens: readonly ItemDeAvaliacaoDaEtapa[],
  notaMaxima: string,
): boolean {
  const maxima = decimalDoCampo(notaMaxima);
  return itens.length > 0 && maxima !== null && somaDosItens(itens) !== maxima;
}

/** O percentual digitado como a fração que o comando envia, ou `null` quando não é número. */
export function fracaoDoPercentual(percentual: string): number | null {
  const valor = decimalDoCampo(percentual);
  return valor === null ? null : Math.round(valor * 100) / 10_000;
}

/** A fração gravada como o percentual que o operador lê e edita. */
export function percentualDaFracao(fracao: number | string): string {
  return String(Math.round(Number(fracao) * 1e6) / 1e4);
}

/**
 * A escala só existe onde cada item é atendido por uma banca: na forma humana e com itens. Fora
 * disso o servidor a recusa, então ela não é conferida nem enviada.
 */
export function escalaVale(
  etapa: Pick<EtapaPontuada, 'formaDeAvaliacao' | 'itensDeAvaliacao' | 'escalaDeAtendimento'>,
): boolean {
  return (
    etapa.formaDeAvaliacao === FORMA_HUMANA &&
    (etapa.itensDeAvaliacao ?? []).length > 0 &&
    (etapa.escalaDeAtendimento ?? []).length > 0
  );
}

/** "Soma dos itens: 8 de 10": a soma contra a nota máxima, que some quando ela ainda não é número. */
export function textoDaSoma(itens: readonly ItemDeAvaliacaoDaEtapa[], notaMaxima: string): string {
  const soma = FORMATADOR_DA_PONTUACAO.format(somaDosItens(itens));
  const maxima = decimalDoCampo(notaMaxima);
  return maxima === null
    ? `Soma dos itens: ${soma}`
    : `Soma dos itens: ${soma} de ${FORMATADOR_DA_PONTUACAO.format(maxima)}`;
}

/** O número decimal como a consulta o lê, com vírgula; o texto que não é número aparece como foi gravado. */
export function decimalLido(texto: string): string {
  const valor = decimalDoCampo(texto);
  return valor === null ? texto : FORMATADOR_DA_PONTUACAO.format(valor);
}
