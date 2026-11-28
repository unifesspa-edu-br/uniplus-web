const ONDE_CORRIGIR: Readonly<Record<string, string>> = {
  documentoEditalId: 'Corrija no passo Identificação, no documento do edital.',
  'ato.tipoAtoCodigo': 'Corrija nesta tela, no campo Tipo de ato.',
};

/** Onde a pessoa corrige a recusa de um campo do pedido de publicação; `null` quando o campo não é desses. */
export function ondeCorrigirARecusaDoPedido(campo: string): string | null {
  return ONDE_CORRIGIR[campo] ?? null;
}
