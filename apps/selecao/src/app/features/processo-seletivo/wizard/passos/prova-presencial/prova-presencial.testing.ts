import { SituacaoDoProcessoSeletivoCodigo } from '@uniplus/shared-data/selecao';

/** A situação de um processo ainda em rascunho, como a API a devolve. */
export const SITUACAO_RASCUNHO = {
  codigo: SituacaoDoProcessoSeletivoCodigo.RASCUNHO,
  rotulo: 'Rascunho',
};

/** A situação de um processo publicado, que só se consulta. */
export const SITUACAO_PUBLICADO = {
  codigo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
  rotulo: 'Publicado',
};
