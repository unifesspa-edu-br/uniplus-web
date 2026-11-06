import { ApiResult } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';
import { ChavesDeIdempotencia } from './chaves-de-idempotencia';

const ok: ApiResult<unknown> = {
  ok: true,
  data: null,
  status: 200,
  headers: new Headers(),
} as never;
const recusada = (status: number, code = 'uniplus.x'): ApiResult<unknown> =>
  ({ ok: false, problem: { status, code } }) as never;

describe('chaves de idempotência', () => {
  it('reaproveita a chave só no reenvio de corpo idêntico depois de falha transitória', () => {
    const chaves = new ChavesDeIdempotencia<number>();
    chaves.reiniciar([1]);
    const primeiro = chaves.paraEnviar(1, { a: 1 });
    chaves.lembrar(1, primeiro, recusada(503));

    expect(chaves.paraEnviar(1, { a: 1 }).chave).toBe(primeiro.chave);
    expect(chaves.paraEnviar(1, { a: 2 }).chave).not.toBe(primeiro.chave);
  });

  it('depois de recusa definitiva a chave sai, mesmo com o corpo igual', () => {
    const chaves = new ChavesDeIdempotencia<string>();
    const primeiro = chaves.paraEnviar('x', { a: 1 });
    chaves.lembrar('x', primeiro, recusada(422, 'uniplus.idempotency.body_mismatch'));

    expect(chaves.paraEnviar('x', { a: 1 }).chave).not.toBe(primeiro.chave);
  });

  it('o sucesso guarda a chave e uma nova sessão renova todas', () => {
    const chaves = new ChavesDeIdempotencia<number>();
    chaves.reiniciar([1, 2]);
    const envio = chaves.paraEnviar(1, { a: 1 });
    chaves.lembrar(1, envio, ok);
    expect(chaves.paraEnviar(1, { a: 1 }).chave).toBe(envio.chave);

    chaves.reiniciar([1, 2]);
    expect(chaves.paraEnviar(1, { a: 1 }).chave).not.toBe(envio.chave);
  });
});
