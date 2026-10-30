import type { PedidoResumoDto } from '@uniplus/shared-data/autorizacao';

/**
 * O beneficiário é reconhecido pela identidade do provedor quando o pedido já a registrou; antes
 * disso (pedido feito por e-mail) vale o e-mail, sem diferenciar maiúsculas.
 */
export function ehOBeneficiario(
  beneficiario: PedidoResumoDto['beneficiario'],
  eu: { readonly id: string; readonly email: string },
): boolean {
  return beneficiario.identidade !== null
    ? beneficiario.identidade.sub === eu.id
    : beneficiario.email.toLowerCase() === eu.email.toLowerCase();
}
