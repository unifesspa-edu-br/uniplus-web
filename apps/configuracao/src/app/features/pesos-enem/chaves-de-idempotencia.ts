import { ApiResult } from '@uniplus/shared-core/http';
import { deveRotacionarIdempotencyKey, idempotencyKey } from '@uniplus/shared-core/idempotency';

/**
 * A `Idempotency-Key` de cada alvo (grupo ou linha) de um envio em lote. Reaproveita a chave
 * SOMENTE num reenvio idêntico depois de falha em que o servidor pode ter processado sem a
 * resposta chegar (rede, 5xx): repetir a chave é o que evita gravar duas vezes. Corpo alterado
 * ou recusa definitiva anterior (que a API guarda, e reenviada sob a mesma chave devolveria a
 * mesma resposta) saem com chave nova.
 */
export class ChavesDeIdempotencia<K> {
  private readonly chaves = new Map<K, string>();
  private readonly corpos = new Map<K, string>();

  /** Chaves novas para os alvos de uma nova sessão. */
  reiniciar(alvos: readonly K[]): void {
    this.corpos.clear();
    this.chaves.clear();
    for (const alvo of alvos) {
      this.chaves.set(alvo, idempotencyKey.create());
    }
  }

  /** A chave do próximo envio do alvo com este corpo. */
  paraEnviar(alvo: K, corpo: object): { chave: string; corpoSerializado: string } {
    const corpoSerializado = JSON.stringify(corpo);
    const reaproveitavel = this.corpos.get(alvo) === corpoSerializado;
    const chave = (reaproveitavel ? this.chaves.get(alvo) : undefined) ?? idempotencyKey.create();
    return { chave, corpoSerializado };
  }

  /** Guarda a chave e o corpo enviados, exceto depois de recusa definitiva. */
  lembrar(
    alvo: K,
    envio: { chave: string; corpoSerializado: string },
    result: ApiResult<unknown>,
  ): void {
    if (!result.ok && deveRotacionarIdempotencyKey(result.problem)) {
      this.chaves.delete(alvo);
      this.corpos.delete(alvo);
      return;
    }
    this.chaves.set(alvo, envio.chave);
    this.corpos.set(alvo, envio.corpoSerializado);
  }
}
