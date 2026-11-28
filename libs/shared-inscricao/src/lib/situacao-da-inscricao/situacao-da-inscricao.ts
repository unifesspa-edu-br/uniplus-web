import type { SituacaoInscricaoCodigo } from '@uniplus/shared-data/selecao';
import type { UiTagVariant, VariantesDosCodigos } from '@uniplus/shared-ui/components';

/**
 * A cor da etiqueta pelo código da situação que a API escreve no fio; o texto da etiqueta é o
 * rótulo que a API devolve. A consulta usa `Map` porque a chave vem do servidor e não pode
 * resolver membro herdado de `Object`.
 */
const VARIANTES: VariantesDosCodigos<`${SituacaoInscricaoCodigo}`> = {
  RASCUNHO: 'warning',
  ENVIADA: 'success',
  CANCELADA: 'neutral',
};
const VARIANTE = new Map<string, UiTagVariant>(Object.entries(VARIANTES));

export function varianteDaSituacaoDaInscricao(situacao: string): UiTagVariant {
  return VARIANTE.get(situacao) ?? 'neutral';
}
