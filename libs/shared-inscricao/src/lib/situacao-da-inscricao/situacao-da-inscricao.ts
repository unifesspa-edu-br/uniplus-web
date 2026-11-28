import type { SituacaoInscricaoCodigo } from '@uniplus/shared-data/selecao';
import type { UiTagVariant, VariantesDosCodigos } from '@uniplus/shared-ui/components';

/**
 * A situação da inscrição pelo vocabulário que a API escreve no fio. As consultas usam `Map`
 * porque a chave vem do servidor e não pode resolver membro herdado de `Object`.
 */
const ROTULO = new Map<string, string>([
  ['RASCUNHO', 'Rascunho'],
  ['ENVIADA', 'Enviada'],
  ['CANCELADA', 'Cancelada'],
]);

const VARIANTES: VariantesDosCodigos<`${SituacaoInscricaoCodigo}`> = {
  RASCUNHO: 'warning',
  ENVIADA: 'success',
  CANCELADA: 'neutral',
};
const VARIANTE = new Map<string, UiTagVariant>(Object.entries(VARIANTES));

/** Se a tela conhece a situação; a que não conhece não vira etiqueta com o código cru. */
export function ehSituacaoConhecida(situacao: string): boolean {
  return ROTULO.has(situacao);
}

/** O rótulo da situação; uma situação que a tela não conhece aparece como a API a devolveu. */
export function rotuloDaSituacaoDaInscricao(situacao: string): string {
  return ROTULO.get(situacao) ?? situacao;
}

export function varianteDaSituacaoDaInscricao(situacao: string): UiTagVariant {
  return VARIANTE.get(situacao) ?? 'neutral';
}
