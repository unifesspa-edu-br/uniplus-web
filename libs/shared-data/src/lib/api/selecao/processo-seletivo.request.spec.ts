import { VENDOR_MIME_TOKEN } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';
import { processoSeletivoRequest } from './processo-seletivo.request';

describe('processoSeletivoRequest', () => {
  it('usa a rota codificada e o tipo de conteúdo do processo', () => {
    const pedido = processoSeletivoRequest('http://localhost:5000', 'p /1');
    expect(pedido.url).toBe('http://localhost:5000/api/selecao/processos-seletivos/p%20%2F1');
    expect(pedido.context?.get(VENDOR_MIME_TOKEN)).toEqual({
      resource: 'processo-seletivo',
      version: 1,
    });
  });
});
