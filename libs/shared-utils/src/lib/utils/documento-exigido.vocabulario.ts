/*
 * Vocabulário do documento exigido (base legal e consequência do indeferimento), compartilhado entre
 * o modelo de formulário e o passo Fase do processo.
 */

/** Alcance da norma que sustenta a exigência. O rótulo virá da API quando ela publicar este vocabulário. */
export const ABRANGENCIA_PADRAO = 'INTERNA_EDITAL';
export const SITUACAO_BASE_LEGAL_RESOLVIDO = 'RESOLVIDO';

export const ABRANGENCIAS_ESCOLHIVEIS = [
  { valor: 'FEDERAL', rotulo: 'Lei federal' },
  { valor: 'ESTADUAL', rotulo: 'Lei estadual' },
  { valor: 'MUNICIPAL', rotulo: 'Lei municipal' },
  { valor: 'INTERNA_NORMA', rotulo: 'Norma interna da universidade' },
  { valor: ABRANGENCIA_PADRAO, rotulo: 'O próprio edital' },
] as const;

/** Se a norma já foi identificada ou se a identificação segue pendente. O rótulo virá da API quando ela publicar este vocabulário. */
export const SITUACAO_BASE_LEGAL_ESCOLHIVEIS = [
  { valor: SITUACAO_BASE_LEGAL_RESOLVIDO, rotulo: 'Resolvida' },
  { valor: 'PENDENTE', rotulo: 'Pendente' },
] as const;

/**
 * A consequência que só vale em fase que admite complementação — o servidor a recusa nas
 * demais.
 */
export const CONSEQUENCIA_REENVIO = 'ABRE_PRAZO_PARA_REENVIO';

/** A consequência com que um documento exigido novo nasce, até a pessoa escolher outra. */
export const CONSEQUENCIA_PADRAO = 'ELIMINA';

/**
 * As consequências que a fase admite: o reenvio só vale em fase que admite complementação. A fase
 * desconhecida — vocabulário ainda não carregado, ou que falhou — conta como a que não admite, e o
 * reenvio só aparece com a fase resolvida; oferecê-lo errado levaria a uma recusa na gravação.
 */
export function consequenciasDaFase<T extends { readonly valor: string }>(
  consequencias: readonly T[],
  admiteComplementacao: boolean | undefined,
): readonly T[] {
  return admiteComplementacao === true
    ? consequencias
    : consequencias.filter((consequencia) => consequencia.valor !== CONSEQUENCIA_REENVIO);
}
