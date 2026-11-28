import type { CausaDeCampo } from '@uniplus/shared-core/http';

import { recusaDaClassificacaoPeloDesempate } from '../desempate/recusas-do-desempate';
import { ehCampoDaEscala, ehCampoDaResolucao } from './classificacao-para-comando';
import { mensagemDaRecusaDaEscala, mensagemDaRecusaDaResolucao } from './recusas-da-classificacao';

/** A resposta que não traz causa no campo da resolução não a julgou: a recusa anterior fica. */
export type RecusaDaResolucaoNaResposta =
  | { readonly julgada: false }
  | { readonly julgada: true; readonly recusa: string | null };

/** O que cada recusa guardada para o passo Fórmula e precisão passa a ser com uma resposta. */
export interface RecusasDaFormula {
  readonly daResolucao: RecusaDaResolucaoNaResposta;
  /** `null`: a resposta não traz recusa pelo desempate, e a anterior fica. */
  readonly peloDesempate: string | null;
  readonly daEscala: string | null;
}

/**
 * As recusas da resposta que o passo Fórmula e precisão guarda. A da resolução é a primeira causa
 * do campo que não seja de desempate, ou `null` quando todas são. A de desempate junta as
 * mensagens distintas das causas com o código do desempate, em qualquer campo. Causa de desempate
 * nunca é recusa da resolução nem da escala, qualquer que seja o campo apontado.
 */
export function recusasDaFormula(erros: readonly CausaDeCampo[]): RecusasDaFormula {
  const peloDesempate = [...new Set(erros.map(recusaDaClassificacaoPeloDesempate))].filter(
    (recusa) => recusa !== null,
  );
  const daEscala = erros.find(
    (erro) => ehCampoDaEscala(erro.field) && recusaDaClassificacaoPeloDesempate(erro) === null,
  );
  return {
    daResolucao: recusaDaResolucaoNaResposta(
      erros.filter((erro) => ehCampoDaResolucao(erro.field)),
    ),
    peloDesempate: peloDesempate.length === 0 ? null : peloDesempate.join(' '),
    daEscala: daEscala === undefined ? null : mensagemDaRecusaDaEscala(daEscala),
  };
}

function recusaDaResolucaoNaResposta(
  sobOCampo: readonly CausaDeCampo[],
): RecusaDaResolucaoNaResposta {
  if (sobOCampo.length === 0) return { julgada: false };
  const causa = sobOCampo.find((erro) => recusaDaClassificacaoPeloDesempate(erro) === null);
  return { julgada: true, recusa: causa === undefined ? null : mensagemDaRecusaDaResolucao(causa) };
}
