import { HttpParams } from '@angular/common/http';
import { VENDOR_MIME_TOKEN, createCursor } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';
import { certamesPublicosRequest } from './certames-publicos.request';
import { SituacaoDoCertame } from './schema';

const BASE = 'http://localhost:5000';

function params(request: { params?: unknown }): HttpParams {
  return request.params as HttpParams;
}

describe('certamesPublicosRequest', () => {
  it('pede a primeira página com o limite padrão e o vendor MIME do recurso', () => {
    const request = certamesPublicosRequest(BASE);

    expect(request.url).toBe(`${BASE}/api/selecao/certames`);
    expect(params(request).get('limit')).toBe('10');
    expect(params(request).has('cursor')).toBe(false);
    expect(request.context?.get(VENDOR_MIME_TOKEN)).toEqual({ resource: 'certame', version: 1 });
  });

  it('troca o limite pelo cursor ao navegar — os dois juntos renderiam 422', () => {
    const request = certamesPublicosRequest(BASE, {
      pagina: { cursor: createCursor('opaco-p2'), direction: 'next' },
    });

    expect(params(request).get('cursor')).toBe('opaco-p2');
    expect(params(request).get('direction')).toBe('next');
    expect(params(request).has('limit')).toBe(false);
  });

  it('declara situação, busca e contadores quando pedidos', () => {
    const request = certamesPublicosRequest(BASE, {
      situacao: SituacaoDoCertame.ultimosDias,
      q: '  técnico  ',
      incluirContadores: true,
    });

    expect(params(request).get('situacao')).toBe('ultimosDias');
    expect(params(request).get('q')).toBe('técnico');
    expect(params(request).get('incluir_contadores')).toBe('true');
  });

  it('omite a busca em branco e a situação nula, que não recortam nada', () => {
    const request = certamesPublicosRequest(BASE, { q: '   ', situacao: null });

    expect(params(request).has('q')).toBe(false);
    expect(params(request).has('situacao')).toBe(false);
  });
});
