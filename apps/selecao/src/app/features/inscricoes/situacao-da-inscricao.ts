import { SituacaoInscricao } from '@uniplus/shared-data/selecao';
import type { UiTagVariant } from '@uniplus/shared-ui/components';

/** `Map` e não objeto literal: a chave vem do servidor e não pode resolver membro herdado de `Object`. */
const ROTULO = new Map<string, string>([
  [SituacaoInscricao.rascunho, 'Rascunho'],
  [SituacaoInscricao.submetida, 'Enviada'],
  [SituacaoInscricao.cancelada, 'Cancelada'],
]);

const VARIANTE = new Map<string, UiTagVariant>([
  [SituacaoInscricao.rascunho, 'warning'],
  [SituacaoInscricao.submetida, 'success'],
  [SituacaoInscricao.cancelada, 'danger'],
]);

/** O rótulo da situação; uma situação que a tela não conhece aparece como a API a devolveu. */
export function rotuloDaSituacao(situacao: string): string {
  return ROTULO.get(situacao) ?? situacao;
}

export function varianteDaSituacao(situacao: string): UiTagVariant {
  return VARIANTE.get(situacao) ?? 'neutral';
}
