import { HttpContext } from '@angular/common/http';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import type { ApiResult } from './api-result';
import { errorResult, mockProblemDetails, okResult } from './api-result.testing';
import { ChaveDeSubstituicao } from './chave-de-substituicao';
import { comChave } from './comando-com-chave';
import { IDEMPOTENCY_KEY_TOKEN } from './idempotency';

const CORPO = { cobra: true, valor: 80 };

interface DoisEnvios {
  readonly chaves: string[];
  readonly respostas: { readonly inconclusiva: boolean }[];
}

async function doisEnvios(resultado: ApiResult<unknown>): Promise<DoisEnvios> {
  const chave = new ChaveDeSubstituicao();
  const chaves: string[] = [];
  const enviar = (contexto: HttpContext) => {
    chaves.push(contexto.get(IDEMPOTENCY_KEY_TOKEN) as string);
    return of(resultado);
  };
  const primeira = await comChave(chave, CORPO, enviar);
  const segunda = await comChave(chave, CORPO, enviar);
  return { chaves, respostas: [primeira, segunda] };
}

describe('comChave', () => {
  it('renova a chave no sucesso: o comando seguinte é novo', async () => {
    const { chaves, respostas } = await doisEnvios(okResult({}));
    expect(chaves[1]).not.toBe(chaves[0]);
    expect(respostas.map((r) => r.inconclusiva)).toEqual([false, false]);
  });

  it('mantém a chave e informa inconclusiva quando a resposta de um 2xx é ilegível', async () => {
    const ilegivel = errorResult(
      mockProblemDetails({ status: 200, code: 'uniplus.client.unexpected_response' }),
    );
    const { chaves, respostas } = await doisEnvios(ilegivel);
    expect(chaves[1]).toBe(chaves[0]);
    expect(respostas.map((r) => r.inconclusiva)).toEqual([true, true]);
  });

  it('troca a chave na recusa definitiva e não é inconclusiva', async () => {
    const recusa = errorResult(mockProblemDetails({ status: 422 }));
    const { chaves, respostas } = await doisEnvios(recusa);
    expect(chaves[1]).not.toBe(chaves[0]);
    expect(respostas.map((r) => r.inconclusiva)).toEqual([false, false]);
  });
});
