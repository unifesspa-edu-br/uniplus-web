export const CODIGO_DA_RECUSA_DE_TESTE = 'uniplus.selecao.recusa_de_teste';
export const IDENTIFICADOR_DO_PEDIDO_DE_TESTE = '0af7651916cd43dd8448eb211c80319c';

/** A referência que a tela leva ao suporte quando a recusa traz o código e o identificador acima. */
export const REFERENCIA_DA_RECUSA_DE_TESTE = {
  origem: 'servidor',
  codigoDoErro: CODIGO_DA_RECUSA_DE_TESTE,
  identificadorDoPedido: IDENTIFICADOR_DO_PEDIDO_DE_TESTE,
} as const;

/** O problema que a API emite, com código e identificador do pedido no formato dela. */
export function problemaComReferencia(status: number, title: string) {
  return {
    type: 'about:blank',
    title,
    status,
    code: CODIGO_DA_RECUSA_DE_TESTE,
    traceId: IDENTIFICADOR_DO_PEDIDO_DE_TESTE,
  };
}

/** A resposta HTTP dessa recusa, para o teste que a entrega à API. */
export function recusaComReferencia(status: number, title: string) {
  const headers = { 'Content-Type': 'application/problem+json' };
  return {
    corpo: problemaComReferencia(status, title),
    opcoes: { status, statusText: title, headers },
  };
}
