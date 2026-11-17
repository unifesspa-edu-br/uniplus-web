import { rotuloDoSentido } from '@uniplus/shared-data/selecao';

import type { MotivoOferecido } from './grupos-de-motivos';

/** O que a tela diz do motivo além da descrição: o sentido, a subclassificação e se está desativado. */
export function detalheDoMotivo(motivo: MotivoOferecido): string {
  return [
    motivo.sentido === null ? null : rotuloDoSentido(motivo.sentido),
    motivo.subclassificacao,
    motivo.desativado ? 'desativado no cadastro' : null,
  ]
    .filter((parte) => parte !== null)
    .join(' · ');
}

/** O motivo como a consulta o lê: a descrição e, entre parênteses, o detalhe. */
export function textoDoMotivoLido(motivo: MotivoOferecido): string {
  const detalhe = detalheDoMotivo(motivo);
  return detalhe === '' ? motivo.descricao : `${motivo.descricao} (${detalhe})`;
}
