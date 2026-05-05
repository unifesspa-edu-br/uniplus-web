import { HttpHeaders } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  ApiResult,
  apiFailure,
  apiOk,
  isApiFailure,
  isApiOk,
} from './api-result';
import { mockProblemDetails } from './api-result.testing';

describe('ApiResult — construtores e narrowing', () => {
  it('apiOk monta envelope com data tipada e flag ok=true', () => {
    const headers = new HttpHeaders({ 'X-Page-Size': '20' });
    const result = apiOk({ id: 'edt-1' }, 200, headers);

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ id: 'edt-1' });
    expect(result.status).toBe(200);
    expect(result.headers.get('X-Page-Size')).toBe('20');
  });

  it('apiFailure monta envelope com problem detalhado e flag ok=false', () => {
    const problem = mockProblemDetails({
      code: 'uniplus.selecao.edital.nao_encontrado',
      status: 404,
    });
    const result = apiFailure(problem, 404, new HttpHeaders());

    expect(result.ok).toBe(false);
    expect(result.problem.code).toBe('uniplus.selecao.edital.nao_encontrado');
    expect(result.status).toBe(404);
  });

  it('discriminator result.ok permite narrowing tipado sem cast', () => {
    const happy: ApiResult<{ id: string }> = apiOk({ id: 'x' }, 200, new HttpHeaders());
    const sad: ApiResult<{ id: string }> = apiFailure(
      mockProblemDetails({ status: 400 }),
      400,
      new HttpHeaders(),
    );

    if (happy.ok) {
      expect(happy.data.id).toBe('x');
    } else {
      throw new Error('happy deveria narrow para ApiOk');
    }

    if (!sad.ok) {
      expect(sad.problem.status).toBe(400);
    } else {
      throw new Error('sad deveria narrow para ApiFailure');
    }
  });

  it('isApiOk e isApiFailure são type guards consistentes', () => {
    const ok = apiOk('hello', 200, new HttpHeaders());
    const fail = apiFailure(mockProblemDetails(), 500, new HttpHeaders());

    expect(isApiOk(ok)).toBe(true);
    expect(isApiOk(fail)).toBe(false);
    expect(isApiFailure(ok)).toBe(false);
    expect(isApiFailure(fail)).toBe(true);
  });
});
