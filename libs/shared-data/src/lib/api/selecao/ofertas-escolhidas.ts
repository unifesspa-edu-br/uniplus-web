import type { OfertaEscolhidaDto } from './notas-do-enem.api';

/** Texto da oferta que a inscrição escolheu e a versão do formulário não nomeia. */
export const OFERTA_NAO_IDENTIFICADA = 'Oferta não identificada';

/** A oferta como a tela a mostra: o nome sempre presente. */
export interface OfertaExibida {
  readonly id: string;
  readonly nome: string;
  readonly ordem: number;
}

/**
 * As ofertas escolhidas na ordem de preferência. A oferta sem nome, que a API devolve quando a
 * versão do formulário não a conhece, aparece como "Oferta não identificada": a escolha nunca
 * é escondida.
 */
export function ofertasEmOrdem(
  ofertas: readonly OfertaEscolhidaDto[] | null | undefined,
): OfertaExibida[] {
  return (ofertas ?? [])
    .map((oferta) => ({
      id: oferta.id,
      nome: oferta.nome ?? OFERTA_NAO_IDENTIFICADA,
      ordem: oferta.ordem,
    }))
    .sort((a, b) => a.ordem - b.ordem);
}
