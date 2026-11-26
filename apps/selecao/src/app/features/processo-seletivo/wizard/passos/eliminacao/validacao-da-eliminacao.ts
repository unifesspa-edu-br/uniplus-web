import { NOME_DO_PASSO_DA_FORMULA } from '../../processo-seletivo.data';
import type { RegraEliminacaoConfigurada } from '../../processo-seletivo.models';
import { decimalNaForma } from '../../shared/numero-do-campo';
import {
  eliminacaoAceitaUmaSoVez,
  eliminacaoExigeBaseadoEmEnem,
  eliminacaoUsaAreaEMinimo,
  eliminacaoUsaEtapa,
  eliminacaoUsaEtapaENotaMinima,
  eliminacaoUsaSoEtapa,
} from '../classificacao/classificacao-para-comando';
import {
  citadaPorOutraAusencia,
  rotuloDaArea,
  type EtapaReferenciavel,
  type QuadroDoCorte,
} from './regras-de-eliminacao';

const INFORME_A_NOTA_MINIMA = 'informe a nota mínima.';
const SO_UMA_REGRA_IGUAL = 'esta regra já foi declarada em outra posição; deixe uma só.';
const SO_COM_ENEM = `só se aplica quando a classificação está marcada como baseada em ENEM (passo ${NOME_DO_PASSO_DA_FORMULA}).`;
const AUSENCIA_FORA_DA_ETAPA_DO_ENEM =
  'a ausência não se aplica à etapa de nota do ENEM; escolha outra etapa.';
const AUSENCIA_JA_DECLARADA =
  'a ausência nesta etapa já foi declarada em outra regra; deixe uma só.';

/** O que a Eliminação julga das regras: elas, as etapas que podem citar e o quadro dos cortes. */
export interface RegrasParaConferir {
  readonly regras: readonly RegraEliminacaoConfigurada[];
  readonly etapas: readonly EtapaReferenciavel[];
  readonly quadro: QuadroDoCorte;
  readonly baseadoEmEnem: boolean;
}

/** As mensagens de recusa das regras de eliminação, na ordem da lista. */
export function mensagensDasRegras(entrada: RegrasParaConferir): string[] {
  return entrada.regras.flatMap((regra, indice) => mensagensDaRegra(entrada, regra, indice));
}

function mensagensDaRegra(
  entrada: RegrasParaConferir,
  regra: RegraEliminacaoConfigurada,
  indice: number,
): string[] {
  if (!regra.regraCodigo) return recusasDaRegra(indice, ['selecione uma regra.']);
  return [
    ...mensagensDoPreenchimento(entrada, regra, indice),
    ...mensagensDaRegraNoConjunto(entrada, regra, indice),
  ];
}

function recusasDaRegra(indice: number, recusas: readonly (string | false)[]): string[] {
  return recusas
    .filter((recusa) => recusa !== false)
    .map((recusa) => `Regra de eliminação ${indice + 1}: ${recusa}`);
}

function mensagensDoPreenchimento(
  entrada: RegrasParaConferir,
  regra: RegraEliminacaoConfigurada,
  indice: number,
): string[] {
  if (eliminacaoUsaEtapa(regra.regraCodigo)) return mensagensDaEtapa(entrada, regra, indice);
  if (eliminacaoUsaAreaEMinimo(regra.regraCodigo)) return mensagensDoCorte(entrada, regra, indice);
  return [];
}

function mensagensDaRegraNoConjunto(
  entrada: RegrasParaConferir,
  regra: RegraEliminacaoConfigurada,
  indice: number,
): string[] {
  return recusasDaRegra(indice, [
    repetidaAntes(entrada.regras, regra, indice) && SO_UMA_REGRA_IGUAL,
    eliminacaoExigeBaseadoEmEnem(regra.regraCodigo) && !entrada.baseadoEmEnem && SO_COM_ENEM,
  ]);
}

function repetidaAntes(
  regras: readonly RegraEliminacaoConfigurada[],
  regra: RegraEliminacaoConfigurada,
  indice: number,
): boolean {
  return (
    eliminacaoAceitaUmaSoVez(regra.regraCodigo) &&
    regras.some((outra, item) => item < indice && outra.regraCodigo === regra.regraCodigo)
  );
}

function mensagensDaEtapa(
  entrada: RegrasParaConferir,
  regra: RegraEliminacaoConfigurada,
  indice: number,
): string[] {
  const etapa = entrada.etapas.find((item) => item.id === regra.etapaRef);
  const eliminaPorAusencia = eliminacaoUsaSoEtapa(regra.regraCodigo) && etapa !== undefined;
  return [
    ...mensagensDaReferencia(regra.etapaRef, etapa, indice),
    ...mensagensDaNotaMinimaDaEtapa(regra, indice),
    ...(eliminaPorAusencia ? mensagensDaAusencia(entrada, etapa, indice) : []),
  ];
}

function mensagensDaReferencia(
  etapaRef: string,
  etapa: EtapaReferenciavel | undefined,
  indice: number,
): string[] {
  return recusasDaRegra(indice, [
    etapaRef === '' && 'selecione a etapa referenciada.',
    etapaRef !== '' && etapa === undefined && 'a etapa referenciada não existe mais no cronograma.',
  ]);
}

function mensagensDaNotaMinimaDaEtapa(regra: RegraEliminacaoConfigurada, indice: number): string[] {
  return recusasDaRegra(indice, [
    eliminacaoUsaEtapaENotaMinima(regra.regraCodigo) &&
      decimalNaForma(regra.notaMinima) === null &&
      INFORME_A_NOTA_MINIMA,
  ]);
}

function mensagensDaAusencia(
  entrada: RegrasParaConferir,
  etapa: EtapaReferenciavel,
  indice: number,
): string[] {
  return recusasDaRegra(indice, [
    etapa.doEnem && AUSENCIA_FORA_DA_ETAPA_DO_ENEM,
    citadaPorOutraAusencia(entrada.regras, etapa.id, indice) && AUSENCIA_JA_DECLARADA,
  ]);
}

function mensagensDoCorte(
  entrada: RegrasParaConferir,
  regra: RegraEliminacaoConfigurada,
  indice: number,
): string[] {
  return [
    ...(regra.areaCodigo === ''
      ? recusasDaRegra(indice, ['selecione a área do ENEM.'])
      : mensagensDaArea(entrada, regra, indice)),
    ...recusasDaRegra(indice, [decimalNaForma(regra.minimo) === null && INFORME_A_NOTA_MINIMA]),
  ];
}

function mensagensDaArea(
  entrada: RegrasParaConferir,
  regra: RegraEliminacaoConfigurada,
  indice: number,
): string[] {
  const rotulo = rotuloDaArea(entrada.quadro, regra.areaCodigo);
  return recusasDaRegra(indice, [
    corteRepetido(entrada.regras, regra, indice) && `${rotulo} já tem um corte em outra regra.`,
    foraDoQuadro(entrada.quadro, regra.areaCodigo) &&
      `${rotulo} não está em todos os grupos da resolução de Peso por Área escolhida.`,
  ]);
}

function corteRepetido(
  regras: readonly RegraEliminacaoConfigurada[],
  regra: RegraEliminacaoConfigurada,
  indice: number,
): boolean {
  return regras.some(
    (outra, item) =>
      item < indice &&
      eliminacaoUsaAreaEMinimo(outra.regraCodigo) &&
      outra.areaCodigo === regra.areaCodigo,
  );
}

function foraDoQuadro(quadro: QuadroDoCorte, areaCodigo: string): boolean {
  return quadro.areas !== null && !quadro.areas.some((area) => area.codigo === areaCodigo);
}
