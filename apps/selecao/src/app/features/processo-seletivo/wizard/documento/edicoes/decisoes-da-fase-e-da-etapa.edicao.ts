import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoCronogramaFase,
} from '@uniplus/shared-data/selecao';

import { textoQueVale } from '../valor-que-vale';
import { naFase } from './fases-do-cronograma.edicao';
import { naEtapa } from './na-etapa';
import { comAlteracoes } from './partes-por-chave';
import {
  comParecerIndividual,
  comProdutos,
  comTiposDeDecisao,
  type ProdutoDoFormulario,
} from './produtos-e-decisoes.edicao';
import { comCampo } from './secao-do-documento';

type Fase = DocumentoDaConfiguracaoCronogramaFase;

/** O que a etapa produz e decide: os atos, o parecer individual e os tipos de decisão que declara. */
export interface DecisoesDaEtapa {
  readonly produtos: readonly ProdutoDoFormulario[];
  readonly emiteParecerIndividual: boolean | null;
  readonly tiposDeDecisao: readonly string[];
}

/** O mesmo da etapa, mais a fase em que a fase concluinte encerra o processo. */
export interface DecisoesDaFase extends DecisoesDaEtapa {
  readonly faseConcluinteChave: string;
}

function comFaseConcluinte(fase: Fase, chave: string): Fase {
  return comCampo(fase, 'faseConcluinteChave', textoQueVale(fase.faseConcluinteChave, chave));
}

export function definirDecisoesDaFase(
  documento: DocumentoDaConfiguracao,
  faseChave: string,
  valores: DecisoesDaFase,
): DocumentoDaConfiguracao {
  return naFase(documento, faseChave, (fase) =>
    comAlteracoes(
      fase,
      (atual) => comProdutos(atual, valores.produtos),
      (atual) => comFaseConcluinte(atual, valores.faseConcluinteChave),
      (atual) => comParecerIndividual(atual, valores.emiteParecerIndividual),
      (atual) => comTiposDeDecisao(atual, valores.tiposDeDecisao),
    ),
  );
}

export function definirDecisoesDaEtapa(
  documento: DocumentoDaConfiguracao,
  etapaChave: string,
  valores: DecisoesDaEtapa,
): DocumentoDaConfiguracao {
  return naEtapa(documento, etapaChave, (etapa) =>
    comAlteracoes(
      etapa,
      (atual) => comProdutos(atual, valores.produtos),
      (atual) => comParecerIndividual(atual, valores.emiteParecerIndividual),
      (atual) => comTiposDeDecisao(atual, valores.tiposDeDecisao),
    ),
  );
}
