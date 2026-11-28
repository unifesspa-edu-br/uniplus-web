import { referenciaDaRecusa, type ProblemDetails } from '@uniplus/shared-core/http';

import type { ValidacaoDoPasso } from '../../processo-seletivo.models';

/** A recusa de um passo pelo servidor: as mensagens da tela e a referência que a pessoa leva ao suporte. */
export function recusaDoServidor(
  problema: ProblemDetails,
  mensagens: readonly string[],
): ValidacaoDoPasso {
  const referencia = referenciaDaRecusa(problema);
  const recusa = { valid: false, messages: [...mensagens] };
  return referencia === null ? recusa : { ...recusa, referenciaAoSuporte: referencia };
}
