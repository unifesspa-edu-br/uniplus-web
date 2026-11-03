import { StatusProcesso } from '@uniplus/shared-data/selecao';

/**
 * Por que a configuração está apenas para consulta, ou `null` quando admite edição. O texto
 * acompanha o status: o rascunho cancelado nunca foi publicado e não se corrige por retificação,
 * então prometer esse caminho mandaria o operador a lugar nenhum.
 */
export function motivoDeSomenteLeitura(
  status: StatusProcesso | undefined,
  publicacaoNaoConfirmada: boolean,
): string | null {
  if (publicacaoNaoConfirmada) {
    return 'A publicação foi aceita, mas ainda não foi possível confirmar o novo estado do processo. A configuração fica bloqueada até a confirmação ser refeita — recarregue a página.';
  }

  if (status === undefined || status === StatusProcesso.rascunho) return null;

  if (status === StatusProcesso.publicado) {
    return 'Este processo já foi publicado. A configuração fica disponível para consulta; alterá-la depende de abrir uma retificação.';
  }

  if (status === StatusProcesso.encerrado || status === StatusProcesso.cancelado) {
    const situacao = status === StatusProcesso.encerrado ? 'encerrado' : 'cancelado';
    return `Este processo está ${situacao} e não aceita alteração. A configuração fica disponível para consulta.`;
  }

  // Status que este cliente não conhece: a allowlist só estabelece que não é rascunho.
  return 'Este processo não está em rascunho e não aceita alteração. A configuração fica disponível para consulta.';
}
