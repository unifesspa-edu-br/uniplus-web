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
