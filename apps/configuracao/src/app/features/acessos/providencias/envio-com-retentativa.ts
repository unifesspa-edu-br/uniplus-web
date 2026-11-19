import type { HttpContext } from '@angular/common/http';
import { firstValueFrom, type Observable } from 'rxjs';
import type { ApiResult, ChaveDeSubstituicao, ProblemDetails } from '@uniplus/shared-core/http';

const CONFLITO_DE_CONCORRENCIA = 'uniplus.concorrencia.conflito';

/**
 * O conflito de concorrência que a API marca como retentável: a mesma requisição pode passar agora.
 * Só esse código se repete; outro 409 marcado retentável não.
 */
export function conflitoRetentavel(problema: ProblemDetails): boolean {
  return (
    problema.status === 409 &&
    problema.code === CONFLITO_DE_CONCORRENCIA &&
    problema.retryable === true
  );
}

/**
 * Envia o comando sob a chave do corpo e o repete uma vez, com a mesma chave, se a API responde o
 * conflito retentável. Os demais 409 e 422 voltam para a tela, que os mostra.
 */
export async function enviarComRetentativa<T>(
  chave: ChaveDeSubstituicao,
  corpo: unknown,
  enviar: (contexto: HttpContext) => Observable<ApiResult<T>>,
): Promise<ApiResult<T>> {
  const contexto = chave.contextoPara(corpo);
  let resultado = await firstValueFrom(enviar(contexto));
  if (!resultado.ok && conflitoRetentavel(resultado.problem)) {
    resultado = await firstValueFrom(enviar(contexto));
  }
  if (resultado.ok) chave.renovar();
  else chave.recusada(resultado);
  return resultado;
}
