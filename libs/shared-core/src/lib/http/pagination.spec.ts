import { describe, expect, it } from 'vitest';
import { createCursor, cursorToString, extractNextCursor } from './pagination';

describe('Cursor branded type (ADR-0015)', () => {
  it('createCursor wraps string como Cursor compatível com string em runtime', () => {
    const cursor = createCursor('opaco-token-123');
    // Em runtime, Cursor é a própria string — comparação por igualdade funciona.
    expect(cursor).toBe('opaco-token-123');
    expect(typeof cursor).toBe('string');
  });

  it('cursorToString é idempotente', () => {
    const cursor = createCursor('xyz');
    expect(cursorToString(cursor)).toBe('xyz');
    expect(cursorToString(createCursor(cursorToString(cursor)))).toBe('xyz');
  });

  it('createCursor não valida conteúdo — servidor é a única autoridade', () => {
    // String vazia, base64-url-safe, payload longo — todos passam.
    expect(createCursor('')).toBe('');
    expect(createCursor('AAAA-_=')).toBe('AAAA-_=');
    expect(createCursor('a'.repeat(2048))).toBe('a'.repeat(2048));
  });
});

describe('extractNextCursor — header Link → próximo cursor opaco', () => {
  describe('caminhos felizes', () => {
    it('rel="next" com cursor= no query string retorna Cursor', () => {
      const linkHeader = '<https://api.uniplus.unifesspa.edu.br/api/editais?cursor=ABC123>; rel="next"';
      const next = extractNextCursor(linkHeader);
      expect(next).not.toBeNull();
      expect(cursorToString(next!)).toBe('ABC123');
    });

    it('extrai cursor de URI com múltiplos query params (cursor não é o primeiro)', () => {
      const linkHeader = '<https://api/x?status=open&limit=20&cursor=DEF456>; rel="next"';
      const next = extractNextCursor(linkHeader);
      expect(cursorToString(next!)).toBe('DEF456');
    });

    it('extrai cursor de URI com cursor como primeiro param', () => {
      const linkHeader = '<https://api/x?cursor=GHI789&limit=20>; rel="next"';
      const next = extractNextCursor(linkHeader);
      expect(cursorToString(next!)).toBe('GHI789');
    });

    it('decodifica percent-encoding do valor do cursor', () => {
      const linkHeader = '<https://api/x?cursor=abc%3Ddef%3D>; rel="next"';
      const next = extractNextCursor(linkHeader);
      expect(cursorToString(next!)).toBe('abc=def=');
    });

    it('preserva URI relativa quando servidor não emite host (RFC 5988 §5.4)', () => {
      const linkHeader = '</api/editais?cursor=REL>; rel="next"';
      const next = extractNextCursor(linkHeader);
      expect(cursorToString(next!)).toBe('REL');
    });

    it('rel="self" + rel="next": extrai apenas o de next', () => {
      const linkHeader =
        '<https://api/x?cursor=SELF>; rel="self", <https://api/x?cursor=NEXT>; rel="next"';
      const next = extractNextCursor(linkHeader);
      expect(cursorToString(next!)).toBe('NEXT');
    });
  });

  describe('retorna null em casos legítimos', () => {
    it('header null', () => {
      expect(extractNextCursor(null)).toBeNull();
    });

    it('header undefined', () => {
      expect(extractNextCursor(undefined)).toBeNull();
    });

    it('header vazio', () => {
      expect(extractNextCursor('')).toBeNull();
    });

    it('header só com rel="self" (última página)', () => {
      const linkHeader = '<https://api/x>; rel="self"';
      expect(extractNextCursor(linkHeader)).toBeNull();
    });

    it('header com outros rels (related, prev) mas sem next', () => {
      const linkHeader =
        '<https://api/x?cursor=P>; rel="prev", <https://api/y>; rel="related"';
      expect(extractNextCursor(linkHeader)).toBeNull();
    });
  });

  describe('retorna null em formas defensivas', () => {
    it('rel="next" mas URI sem query string', () => {
      const linkHeader = '<https://api/x>; rel="next"';
      expect(extractNextCursor(linkHeader)).toBeNull();
    });

    it('rel="next" com query string mas sem cursor=', () => {
      const linkHeader = '<https://api/x?status=open&limit=20>; rel="next"';
      expect(extractNextCursor(linkHeader)).toBeNull();
    });

    it('rel="next" com cursor= vazio', () => {
      const linkHeader = '<https://api/x?cursor=>; rel="next"';
      expect(extractNextCursor(linkHeader)).toBeNull();
    });

    it('percent-encoding malformado é tratado como ausente (não explode)', () => {
      const linkHeader = '<https://api/x?cursor=abc%2>; rel="next"';
      // % seguido de char inválido — decodeURIComponent lança URIError;
      // tratamos como ausência.
      expect(extractNextCursor(linkHeader)).toBeNull();
    });

    it('ignora hash fragment na URI (#...)', () => {
      const linkHeader = '<https://api/x?cursor=ABC#section>; rel="next"';
      const next = extractNextCursor(linkHeader);
      expect(cursorToString(next!)).toBe('ABC');
    });
  });
});
