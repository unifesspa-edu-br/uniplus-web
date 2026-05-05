import { HttpContext } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  buildVendorMimeAccept,
  VENDOR_MIME_TOKEN,
  withVendorMime,
} from './vendor-mime';

describe('vendor MIME — declaração via HttpContext (ADR-0028)', () => {
  it('buildVendorMimeAccept formata segundo o padrão application/vnd.uniplus.<resource>.v<N>+json', () => {
    expect(buildVendorMimeAccept('edital', 1)).toBe('application/vnd.uniplus.edital.v1+json');
    expect(buildVendorMimeAccept('inscricao', 2)).toBe('application/vnd.uniplus.inscricao.v2+json');
  });

  it('withVendorMime devolve HttpContext com token populado', () => {
    const context = withVendorMime('edital', 1);
    expect(context.get(VENDOR_MIME_TOKEN)).toEqual({ resource: 'edital', version: 1 });
  });

  it('VENDOR_MIME_TOKEN tem default null para HttpContext sem declaração', () => {
    const empty = new HttpContext();
    expect(empty.get(VENDOR_MIME_TOKEN)).toBeNull();
  });

  it.each([
    ['', 1],
    ['edital', 0],
    ['edital', -1],
    ['edital', 1.5],
  ])('rejeita resource/version inválidos (resource="%s", version=%s)', (resource, version) => {
    expect(() => withVendorMime(resource as string, version as number)).toThrow();
  });
});
