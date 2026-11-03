import type { ProblemDetails } from '@uniplus/shared-core/http';

import type { FaseDoCronograma, StepValidation } from '../../processo-seletivo.models';
import { ORIENTACAO_DE_PERMUTACAO, PERMUTACAO_DE_ORDEM } from '../cronograma/servicos/gravacao-do-cronograma.service';
import type { CampoDaFase } from './configuracao-da-fase';
import { traduzirRecusa } from './recusas-da-fase';

export interface RecusaDaGravacao {
  readonly porCampo: ReadonlyMap<CampoDaFase, string>;
  readonly gerais: readonly string[];
  /** O que o resumo do topo anuncia. */
  readonly validacao: StepValidation;
}

/**
 * Distribui a recusa pelos campos da fase aberta e diz o que o resumo do topo anuncia.
 *
 * O resumo repete o que aparece sob cada campo, e é deliberado: ele é a região
 * que o leitor de tela anuncia depois da gravação, e sem ele a recusa de um
 * campo fora da parte visível passaria despercebida.
 */
export function recusaDaGravacao(
  problema: ProblemDetails,
  fases: readonly FaseDoCronograma[],
  faseAberta: string,
  nomesPorFase: ReadonlyMap<string, string>,
): RecusaDaGravacao {
  // A permutação de ordem não descreve campo nenhum desta tela: ela é da
  // linha do tempo, e o que orienta é como desfazê-la lá. Traduzi-la por
  // campo apontaria um controle que não tem nada a ver com o que foi
  // recusado.
  if (problema.code === PERMUTACAO_DE_ORDEM) {
    return {
      porCampo: new Map(),
      gerais: [ORIENTACAO_DE_PERMUTACAO],
      validacao: { valid: false, messages: [ORIENTACAO_DE_PERMUTACAO] },
    };
  }

  const nomeDaFase = (indice: number): string => {
    const fase = fases[indice];
    if (fase === undefined) return `posição ${indice + 1}`;
    return nomesPorFase.get(fase.faseCanonicaId) ?? fase.codigo;
  };
  const abertaEm = fases.findIndex((fase) => fase.faseCanonicaId === faseAberta);
  const traduzida = traduzirRecusa(problema, abertaEm, nomeDaFase);

  const mensagens = [...traduzida.porCampo.values(), ...traduzida.gerais];
  return {
    porCampo: traduzida.porCampo,
    gerais: traduzida.gerais,
    validacao: { valid: false, messages: mensagens.length === 0 ? [problema.title] : mensagens },
  };
}
