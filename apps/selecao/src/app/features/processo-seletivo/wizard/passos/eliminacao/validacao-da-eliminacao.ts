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
  const posicao = indice + 1;
  if (!regra.regraCodigo) return [`Regra de eliminação ${posicao}: selecione uma regra.`];

  const mensagens: string[] = [];
  if (eliminacaoUsaEtapa(regra.regraCodigo)) {
    mensagens.push(...mensagensDaEtapa(entrada, regra, indice));
  } else if (eliminacaoUsaAreaEMinimo(regra.regraCodigo)) {
    mensagens.push(...mensagensDoCorte(entrada, regra, indice));
  }

  if (repetidaAntes(entrada.regras, regra, indice)) {
    mensagens.push(
      `Regra de eliminação ${posicao}: esta regra já foi declarada em outra posição; deixe uma só.`,
    );
  }
  if (eliminacaoExigeBaseadoEmEnem(regra.regraCodigo) && !entrada.baseadoEmEnem) {
    mensagens.push(
      `Regra de eliminação ${posicao}: só se aplica quando a classificação está marcada como baseada em ENEM (passo Fórmula).`,
    );
  }
  return mensagens;
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
  const posicao = indice + 1;
  const mensagens: string[] = [];
  const etapa = entrada.etapas.find((item) => item.id === regra.etapaRef);

  if (regra.etapaRef === '') {
    mensagens.push(`Regra de eliminação ${posicao}: selecione a etapa referenciada.`);
  } else if (etapa === undefined) {
    mensagens.push(
      `Regra de eliminação ${posicao}: a etapa referenciada não existe mais no cronograma.`,
    );
  }
  if (
    eliminacaoUsaEtapaENotaMinima(regra.regraCodigo) &&
    decimalNaForma(regra.notaMinima) === null
  ) {
    mensagens.push(`Regra de eliminação ${posicao}: informe a nota mínima.`);
  }
  if (eliminacaoUsaSoEtapa(regra.regraCodigo) && etapa !== undefined) {
    mensagens.push(...mensagensDaAusencia(entrada, etapa, indice));
  }
  return mensagens;
}

function mensagensDaAusencia(
  entrada: RegrasParaConferir,
  etapa: EtapaReferenciavel,
  indice: number,
): string[] {
  const posicao = indice + 1;
  const mensagens: string[] = [];
  if (etapa.doEnem) {
    mensagens.push(
      `Regra de eliminação ${posicao}: a ausência não se aplica à etapa de nota do ENEM; escolha outra etapa.`,
    );
  }
  if (citadaPorOutraAusencia(entrada.regras, etapa.id, indice)) {
    mensagens.push(
      `Regra de eliminação ${posicao}: a ausência nesta etapa já foi declarada em outra regra; deixe uma só.`,
    );
  }
  return mensagens;
}

function mensagensDoCorte(
  entrada: RegrasParaConferir,
  regra: RegraEliminacaoConfigurada,
  indice: number,
): string[] {
  const posicao = indice + 1;
  const mensagens: string[] = [];
  if (regra.areaCodigo === '') {
    mensagens.push(`Regra de eliminação ${posicao}: selecione a área do ENEM.`);
  } else {
    mensagens.push(...mensagensDaArea(entrada, regra, indice));
  }
  if (decimalNaForma(regra.minimo) === null) {
    mensagens.push(`Regra de eliminação ${posicao}: informe a nota mínima.`);
  }
  return mensagens;
}

function mensagensDaArea(
  entrada: RegrasParaConferir,
  regra: RegraEliminacaoConfigurada,
  indice: number,
): string[] {
  const posicao = indice + 1;
  const mensagens: string[] = [];
  const rotulo = rotuloDaArea(entrada.quadro, regra.areaCodigo);
  const repetida = entrada.regras.some(
    (outra, item) =>
      item < indice &&
      eliminacaoUsaAreaEMinimo(outra.regraCodigo) &&
      outra.areaCodigo === regra.areaCodigo,
  );
  if (repetida) {
    mensagens.push(`Regra de eliminação ${posicao}: ${rotulo} já tem um corte em outra regra.`);
  }
  const areas = entrada.quadro.areas;
  if (areas !== null && !areas.some((area) => area.codigo === regra.areaCodigo)) {
    mensagens.push(
      `Regra de eliminação ${posicao}: ${rotulo} não está em todos os grupos da resolução de Peso por Área escolhida.`,
    );
  }
  return mensagens;
}
