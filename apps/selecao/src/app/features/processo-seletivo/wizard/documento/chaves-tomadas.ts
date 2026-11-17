import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';

export interface ReservasDeChaves {
  readonly original: DocumentoDaConfiguracao;
  readonly criadas: readonly string[];
}

const REFERENCIA_A_CHAVE = /Chave$/;

/**
 * Toda chave que uma parte nova não pode repetir: as das partes do mesmo tipo e escopo, que o
 * chamador conhece, e toda referência a chave que o documento ainda carrega. A referência a uma
 * parte que já saiu continua no documento até o diagnóstico da API apontá-la, e a chave dessa parte
 * segue tomada para que a nova não passe a ser lida como ela.
 */
export function chavesTomadas(
  documento: DocumentoDaConfiguracao,
  doMesmoTipo: readonly string[],
  reservas?: ReservasDeChaves,
): ReadonlySet<string> {
  return new Set([
    ...doMesmoTipo,
    ...referenciasAChave(documento),
    ...chavesDoOriginal(reservas?.original),
    ...(reservas?.criadas ?? []),
  ]);
}

function referenciasAChave(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.flatMap(referenciasAChave);
  if (typeof valor !== 'object' || valor === null) return [];
  return Object.entries(valor).flatMap(([nome, filho]) =>
    REFERENCIA_A_CHAVE.test(nome) && typeof filho === 'string' ? [filho] : referenciasAChave(filho),
  );
}

function chavesDoOriginal(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.flatMap(chavesDoOriginal);
  if (typeof valor !== 'object' || valor === null) return [];
  return Object.entries(valor).flatMap(([nome, filho]) =>
    nome === 'chave' && typeof filho === 'string' ? [filho] : chavesDoOriginal(filho),
  );
}
