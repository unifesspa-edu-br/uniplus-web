import type { HttpContext } from '@angular/common/http';
import { of, switchMap, type Observable } from 'rxjs';
import type { ApiResult, ProblemDetails } from '@uniplus/shared-core/http';
import {
  deveRotacionarIdempotencyKey,
  idempotencyKey,
  withIdempotencyKey,
} from '@uniplus/shared-core/idempotency';

/** O conflito que a API declara retentável: a corrida passou, e a mesma requisição pode ser aceita. */
export function conflitoRetentavel(problema: ProblemDetails): boolean {
  return problema.status === 409 && problema.retryable === true;
}

/**
 * A chave de idempotência acompanha a intenção: repetir o mesmo corpo (rede, 5xx, conflito
 * retentável) reusa a chave; outro corpo, ou a recusa definitiva, ganha chave nova.
 */
export class ChaveDaIntencao {
  private chave = idempotencyKey.create();
  private intencao: string | null = null;

  para(corpo: unknown): string {
    const intencao = JSON.stringify(corpo);
    if (intencao !== this.intencao) {
      this.chave = idempotencyKey.create();
      this.intencao = intencao;
    }
    return this.chave;
  }

  /** A operação terminou, ou a recusa foi definitiva: a próxima tentativa é outra intenção. */
  aposResposta(resultado: ApiResult<unknown>): void {
    const definitiva =
      resultado.ok ||
      (deveRotacionarIdempotencyKey(resultado.problem) && !conflitoRetentavel(resultado.problem));
    if (definitiva) this.intencao = null;
  }
}

/** Envia sob a chave; o conflito retentável se repete uma vez, com a mesma chave. */
export function enviarComRetentativa<T>(
  chamada: (contexto: HttpContext) => Observable<ApiResult<T>>,
  chave: string,
): Observable<ApiResult<T>> {
  return chamada(withIdempotencyKey(chave)).pipe(
    switchMap((primeira) =>
      !primeira.ok && conflitoRetentavel(primeira.problem)
        ? chamada(withIdempotencyKey(chave))
        : of(primeira),
    ),
  );
}
