import { separarCausas, type ProblemValidationError } from '@uniplus/shared-core/http';
import { campoDoServidor, type CampoDoFormulario } from './campos-da-publicacao';

export const MENSAGEM_DA_PUBLICACAO_INCONCLUSIVA =
  'Não foi possível saber se o documento foi publicado. Confira a lista de documentos; se ele não aparecer, publique de novo: o pedido é o mesmo e não se repete.';

/** Para onde vai cada causa da recusa: a mensagem do campo da tela ou o resumo da recusa. */
export interface RecusaDaPublicacao {
  /** O resumo: o motivo da recusa, as causas gerais e as de campo que a tela não tem. */
  readonly mensagens: readonly string[];
  /** A mensagem do servidor para cada campo do formulário que ele recusou. */
  readonly dosCampos: ReadonlyMap<CampoDoFormulario, string>;
}

/**
 * Separa as causas da recusa entre os campos do formulário e o resumo. A causa geral e a de campo
 * sem controle na tela vão ao resumo, depois do motivo da recusa.
 */
export function distribuirRecusaDaPublicacao(
  motivo: string,
  causas: ReadonlyArray<ProblemValidationError> | undefined,
): RecusaDaPublicacao {
  const { deCampo, gerais } = separarCausas(causas);
  const mensagens = [motivo, ...gerais.map((causa) => causa.message)];
  const dosCampos = new Map<CampoDoFormulario, string>();
  for (const causa of deCampo) {
    const campo = campoDoServidor(causa.field);
    if (campo === null) mensagens.push(causa.message);
    else dosCampos.set(campo, causa.message);
  }
  return { mensagens, dosCampos };
}
