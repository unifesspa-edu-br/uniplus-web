import { HttpContext, HttpContextToken } from '@angular/common/http';

/**
 * Marca da chamada que mostra na própria tela a recusa por falta de permissão (403). Sem ela, a
 * recusa leva a pessoa à página de acesso negado. A marca é da chamada, nunca do cliente da API:
 * o mesmo cliente pode sustentar a página numa tela e apenas apoiá-la em outra.
 */
export const RECUSA_DE_PERMISSAO_TRATADA_NA_CHAMADA = new HttpContextToken<boolean>(() => false);

export function comRecusaDePermissaoTratadaNaChamada(): HttpContext {
  return new HttpContext().set(RECUSA_DE_PERMISSAO_TRATADA_NA_CHAMADA, true);
}
