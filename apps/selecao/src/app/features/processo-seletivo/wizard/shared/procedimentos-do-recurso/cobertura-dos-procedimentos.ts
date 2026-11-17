import type { TipoDeDecisaoDoDocumento } from '@uniplus/shared-data/selecao';

/** Orientação local por tipo: não verifica se todos os alvos estão cobertos nem valida a regra. */
export function tiposSemProcedimento(
  temJanela: boolean,
  tiposDeclarados: readonly TipoDeDecisaoDoDocumento[],
  procedimentos: readonly { readonly tipoDeDecisao: string }[],
): readonly TipoDeDecisaoDoDocumento[] {
  if (!temJanela) return [];
  const cobertos = new Set(procedimentos.map((procedimento) => procedimento.tipoDeDecisao));
  return [...new Set(tiposDeclarados)].filter((tipo) => !cobertos.has(tipo));
}
