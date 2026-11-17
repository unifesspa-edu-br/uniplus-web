import { describe, expect, it } from 'vitest';
import { IDEMPOTENCY_KEY_TOKEN } from '@uniplus/shared-core/idempotency';
import { errorResult, mockProblemDetails } from '@uniplus/shared-testing';
import { ChaveRetida } from './chave-retida';

const falha = (status: number, code: string) =>
  errorResult(mockProblemDetails({ type: 'about:blank', title: 'Recusado.', status, code }));

describe('ChaveRetida', () => {
  it('preserva a chave e deixa pendente em 5xx inconclusivo', () => {
    const chave = new ChaveRetida();
    const usada = chave.contexto().get(IDEMPOTENCY_KEY_TOKEN);

    chave.concluir(falha(500, 'uniplus.internal'));

    expect(chave.pendente).toBe(true);
    expect(chave.contexto().get(IDEMPOTENCY_KEY_TOKEN)).toBe(usada);
  });

  it('gira a chave e não fica pendente no 503 de processo ocupado: a recusa fica guardada na chave', () => {
    const chave = new ChaveRetida();
    const usada = chave.contexto().get(IDEMPOTENCY_KEY_TOKEN);

    chave.concluir(falha(503, 'uniplus.concorrencia.espera_esgotada'));

    expect(chave.pendente).toBe(false);
    expect(chave.contexto().get(IDEMPOTENCY_KEY_TOKEN)).not.toBe(usada);
  });
});
