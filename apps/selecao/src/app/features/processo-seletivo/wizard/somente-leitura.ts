import { StatusProcessoCodigo } from '@uniplus/shared-data/selecao';

/**
 * Por que a configuração está apenas para consulta, ou `null` quando admite edição. O texto
 * acompanha o status: o rascunho cancelado nunca foi publicado e não se corrige por retificação,
 * então prometer esse caminho mandaria o operador a lugar nenhum.
 */
export function motivoDeSomenteLeitura(
  status: StatusProcessoCodigo | undefined,
  publicacaoNaoConfirmada: boolean,
): string | null {
  if (publicacaoNaoConfirmada) {
    return 'A publicação foi aceita, mas ainda não foi possível confirmar o novo estado do processo. A configuração fica bloqueada até a confirmação ser refeita — recarregue a página.';
  }

  if (status === undefined || status === StatusProcessoCodigo.RASCUNHO) return null;

  if (status === StatusProcessoCodigo.PUBLICADO) {
    return 'Este processo já foi publicado. A configuração fica disponível para consulta; alterá-la depende de abrir uma retificação.';
  }

  if (status === StatusProcessoCodigo.ENCERRADO || status === StatusProcessoCodigo.CANCELADO) {
    const situacao = status === StatusProcessoCodigo.ENCERRADO ? 'encerrado' : 'cancelado';
    return `Este processo está ${situacao} e não aceita alteração. A configuração fica disponível para consulta.`;
  }

  // Status que este cliente não conhece: a allowlist só estabelece que não é rascunho.
  return 'Este processo não está em rascunho e não aceita alteração. A configuração fica disponível para consulta.';
}
