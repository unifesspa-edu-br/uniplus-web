import { HttpContext } from '@angular/common/http';
import { ApiResult, isApiOk, proximaChave } from '@uniplus/shared-core/http';
import { idempotencyKey, withIdempotencyKey } from '@uniplus/shared-core/idempotency';

/**
 * Chave de uma operação que não pode ser substituída por outro corpo: criar o processo e
 * confirmar o edital. Resposta inconclusiva preserva a chave e deixa a operação pendente, porque
 * o servidor pode tê-la executado e a única saída correta é repetir o mesmo envio.
 */
export class ChaveRetida {
  private chave = idempotencyKey.create();
  private retida = false;

  get pendente(): boolean {
    return this.retida;
  }

  contexto(): HttpContext {
    return withIdempotencyKey(this.chave);
  }

  concluir(result: ApiResult<unknown>): void {
    if (isApiOk(result)) {
      this.chave = idempotencyKey.create();
      this.retida = false;
      return;
    }
    const anterior = this.chave;
    this.chave = proximaChave(anterior, result);
    this.retida = this.chave === anterior;
  }

  descartar({ esquecerPendente }: { readonly esquecerPendente: boolean }): void {
    this.chave = idempotencyKey.create();
    if (esquecerPendente) this.retida = false;
  }
}
