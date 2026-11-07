import type { UiTagVariant } from '../tag/tag';

/**
 * A situação da inscrição pelo vocabulário que a API escreve no fio: a biblioteca de interface não
 * depende dos tipos do contrato. `Map` e não objeto literal: a chave vem do servidor e não pode
 * resolver membro herdado de `Object`.
 */
const ROTULO = new Map<string, string>([
  ['rascunho', 'Rascunho'],
  ['submetida', 'Enviada'],
  ['cancelada', 'Cancelada'],
]);

const VARIANTE = new Map<string, UiTagVariant>([
  ['rascunho', 'warning'],
  ['submetida', 'success'],
  ['cancelada', 'danger'],
]);

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
