import { describe, expect, it } from 'vitest';
import type { ProblemDetails } from '@uniplus/shared-core/http';
import { CODIGO_GEO_INDISPONIVEL, ehGeoIndisponivel } from './geo-indisponivel';

const problema: ProblemDetails = {
  type: 'about:blank',
  title: 'Serviço indisponível',
  status: 503,
  code: CODIGO_GEO_INDISPONIVEL,
  traceId: 'teste',
};

describe('ehGeoIndisponivel', () => {
  it('reconhece o código do Geo com status 503', () => {
    expect(ehGeoIndisponivel(problema)).toBe(true);
  });

  it('não reconhece outro 503 nem o código do Geo com outro status', () => {
    expect(ehGeoIndisponivel({ ...problema, code: 'outro' })).toBe(false);
    expect(ehGeoIndisponivel({ ...problema, status: 422 })).toBe(false);
  });
});
