import { HttpContext } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { isApiOk, type ApiResult } from '@uniplus/shared-core/http';

import type { ChaveDeSubstituicao } from './chave-de-substituicao';

/**
 * A resposta de um comando e se a recusa deixou em aberto se ele foi executado (rede, 5xx): o
 * registro pode já existir no servidor, e a retentativa repete o mesmo comando com a mesma chave.
 */
export interface RespostaDoComando<T> {
  readonly resultado: ApiResult<T>;
  readonly inconclusiva: boolean;
}

/** Envia o comando sob a chave de idempotência e informa se a recusa deixou a execução em aberto. */
export async function comChave<T>(
  chave: ChaveDeSubstituicao,
  corpo: unknown,
  enviar: (contexto: HttpContext) => Observable<ApiResult<T>>,
): Promise<RespostaDoComando<T>> {
  const resultado = await firstValueFrom(enviar(chave.contextoPara(corpo)));
  if (isApiOk(resultado)) {
    chave.renovar();
    return { resultado, inconclusiva: false };
  }
  return { resultado, inconclusiva: chave.recusada(resultado) };
}
