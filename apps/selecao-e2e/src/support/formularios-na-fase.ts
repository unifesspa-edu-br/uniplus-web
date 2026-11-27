import { PROCESSO_PUBLICADO_COMPLETO } from '../fixtures/processo-publicado-completo';

/**
 * Os formulários do processo completo, postos na fase indicada. O servidor só aceita o documento
 * exigido de uma fase que já tem formulário; sem ele, o cronograma adia os documentos e a revisão
 * bloqueia a publicação.
 */
export function formulariosNaFase(faseId: string) {
  return PROCESSO_PUBLICADO_COMPLETO.formularios.map((formulario) => ({ ...formulario, faseId }));
}
