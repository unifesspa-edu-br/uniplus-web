import { VENDOR_MIME_TOKEN } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';

import { inscricoesDoProcessoRequest } from './inscricoes-do-processo.request';

const BASE = 'http://localhost:5000';

describe('inscricoesDoProcessoRequest', () => {
  it('pede a primeira página pelo limite, no recurso da inscrição do processo', () => {
    const req = inscricoesDoProcessoRequest(BASE, 'p 1', { limit: 50 });

    expect(req.url).toBe(`${BASE}/api/selecao/processos-seletivos/p%201/inscricoes`);
    expect(String(req.params)).toBe('limit=50');
    expect(req.context?.get(VENDOR_MIME_TOKEN)).toEqual({
      resource: 'inscricao-do-processo',
      version: 1,
    });
  });

  it('segue o cursor com a direção e sem reenviar o limite', () => {
    const req = inscricoesDoProcessoRequest(BASE, 'p-1', {
      cursor: 'abc',
      direction: 'prev',
      limit: 50,
    });

    expect(String(req.params)).toBe('cursor=abc&direction=prev');
  });

  it('assume a direção seguinte quando o cursor vem sem direção', () => {
    expect(String(inscricoesDoProcessoRequest(BASE, 'p-1', { cursor: 'abc' }).params)).toBe(
      'cursor=abc&direction=next',
    );
  });
});
