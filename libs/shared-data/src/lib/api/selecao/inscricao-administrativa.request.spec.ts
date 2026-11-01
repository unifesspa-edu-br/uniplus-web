import { VENDOR_MIME_TOKEN } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';

import { inscricaoAdministrativaRequest } from './inscricao-administrativa.request';

describe('inscricaoAdministrativaRequest', () => {
  it('pede a inscrição pela rota do processo, no media type administrativo', () => {
    const req = inscricaoAdministrativaRequest('http://localhost:5000', 'p 1', 'i/1');

    expect(req.url).toBe(
      'http://localhost:5000/api/selecao/processos-seletivos/p%201/inscricoes/i%2F1',
    );
    expect(req.context?.get(VENDOR_MIME_TOKEN)).toEqual({
      resource: 'inscricao-administrativa',
      version: 1,
    });
  });
});
