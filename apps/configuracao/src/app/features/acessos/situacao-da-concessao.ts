import type { ConcessaoDto } from '@uniplus/shared-data/autorizacao';

export interface SituacaoDaConcessaoNaTela {
  readonly texto: string;
  readonly variante: 'success' | 'neutral' | 'warning';
}

/** A revogação vale mais que a vigência: revogada, ativa ou, sem revogação e fora do prazo, vencida. */
export function situacaoDaConcessao(
  concessao: Pick<ConcessaoDto, 'revogadaEm' | 'ativa'>,
): SituacaoDaConcessaoNaTela {
  if (concessao.revogadaEm !== null) return { texto: 'Revogada', variante: 'neutral' };
  return concessao.ativa
    ? { texto: 'Ativa', variante: 'success' }
    : { texto: 'Vencida', variante: 'warning' };
}
