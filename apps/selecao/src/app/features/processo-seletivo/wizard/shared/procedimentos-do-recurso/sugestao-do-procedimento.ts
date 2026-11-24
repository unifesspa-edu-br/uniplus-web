import {
  FormaDeAvaliacaoDaEtapa,
  type RegraCatalogoDto,
} from '@uniplus/shared-data/selecao';

import type { RegraEscolhida } from '../../documento/regra-escolhida';

// UNI-REQ-0383: códigos do rol de procedimentos de recurso da API.
const RECORRECAO = 'PROCEDIMENTO-RECURSO-RECORRECAO';
const RECALCULO = 'PROCEDIMENTO-RECURSO-RECALCULO';

function codigoPelaForma(
  forma: FormaDeAvaliacaoDaEtapa | null,
  origemNoEnem: boolean | null,
): string | null {
  if (origemNoEnem === true) return RECALCULO;
  if (origemNoEnem !== false) return null;
  if (forma === FormaDeAvaliacaoDaEtapa.HUMANA) return RECORRECAO;
  return forma === FormaDeAvaliacaoDaEtapa.OBJETIVA ? RECALCULO : null;
}

/** Só orienta a declaração inicial. O recálculo do ENEM usa os insumos congelados e o boletim. */
export function sugerirProcedimentoDeRecurso(
  forma: FormaDeAvaliacaoDaEtapa | null,
  origemNoEnem: boolean | null,
  catalogo: readonly RegraCatalogoDto[],
): RegraEscolhida | null {
  const codigo = codigoPelaForma(forma, origemNoEnem);
  const regras = catalogo.filter(
    (candidata) =>
      candidata.tipo.codigo === 'regra_procedimento_recurso' && candidata.codigo === codigo,
  );
  const versoes = new Set(regras.map((regra) => regra.versao));
  return codigo !== null && versoes.size === 1 ? { codigo, versao: regras[0].versao } : null;
}
