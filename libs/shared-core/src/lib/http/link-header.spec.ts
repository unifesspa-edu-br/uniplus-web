import { describe, expect, it } from 'vitest';
import { parseLink } from './link-header';

describe('parseLink — RFC 5988/8288 (ADR-0015)', () => {
  describe('header ausente ou vazio', () => {
    it('retorna Map vazio quando header é null', () => {
      expect(parseLink(null).size).toBe(0);
    });

    it('retorna Map vazio quando header é undefined', () => {
      expect(parseLink(undefined).size).toBe(0);
    });

    it('retorna Map vazio quando header é string vazia', () => {
      expect(parseLink('').size).toBe(0);
    });

    it('retorna Map vazio quando header é só whitespace', () => {
      expect(parseLink('   \t\n  ').size).toBe(0);
    });
  });

  describe('header com 1 link-value', () => {
    it('parseia rel="next" único e expõe URI completa', () => {
      const links = parseLink(
        '<https://api.uniplus.unifesspa.edu.br/api/editais?cursor=ABC123>; rel="next"',
      );
      expect(links.size).toBe(1);
      const next = links.get('next');
      expect(next?.uri).toBe('https://api.uniplus.unifesspa.edu.br/api/editais?cursor=ABC123');
      expect(next?.params['rel']).toBe('next');
    });

    it('parseia URI com query string complexa preservando ordem dos params', () => {
      const links = parseLink(
        '<https://api.example.com/x?status=open&limit=20&cursor=abc%3Ddef>; rel="next"',
      );
      const next = links.get('next');
      expect(next?.uri).toBe('https://api.example.com/x?status=open&limit=20&cursor=abc%3Ddef');
    });

    it('aceita link-value sem aspas no rel (token simples)', () => {
      const links = parseLink('<https://api/x>; rel=next');
      expect(links.get('next')?.uri).toBe('https://api/x');
    });
  });

  describe('header com múltiplos link-values', () => {
    it('parseia rel="self" + rel="next" em entradas separadas', () => {
      const links = parseLink(
        '<https://api/x?cursor=A>; rel="self", <https://api/x?cursor=B>; rel="next"',
      );
      expect(links.size).toBe(2);
      expect(links.get('self')?.uri).toBe('https://api/x?cursor=A');
      expect(links.get('next')?.uri).toBe('https://api/x?cursor=B');
    });

    it('parseia self + next + prev em três entradas', () => {
      const links = parseLink(
        '<https://api/x>; rel="self", <https://api/x?cursor=N>; rel="next", <https://api/x?cursor=P>; rel="prev"',
      );
      expect(links.size).toBe(3);
      expect(links.get('self')).toBeDefined();
      expect(links.get('next')).toBeDefined();
      expect(links.get('prev')).toBeDefined();
    });

    it('quando dois link-values declaram o mesmo rel, o primeiro vence', () => {
      const links = parseLink(
        '<https://api/x?cursor=PRIMEIRO>; rel="next", <https://api/x?cursor=SEGUNDO>; rel="next"',
      );
      expect(links.size).toBe(1);
      expect(links.get('next')?.uri).toBe('https://api/x?cursor=PRIMEIRO');
    });
  });

  describe('rel com múltiplos valores (RFC 5988 §5.3.1)', () => {
    it('rel="self next" registra entradas separadas para self e next apontando para o mesmo link', () => {
      const links = parseLink('<https://api/x>; rel="self next"');
      expect(links.size).toBe(2);
      expect(links.get('self')?.uri).toBe('https://api/x');
      expect(links.get('next')?.uri).toBe('https://api/x');
    });
  });

  describe('params com aspas escapadas', () => {
    it('preserva aspas internas escapadas no valor de title', () => {
      const links = parseLink(
        '<https://api/x>; rel="next"; title="Página \\"importante\\""',
      );
      expect(links.get('next')?.params['title']).toBe('Página "importante"');
    });

    it('vírgula dentro de quoted-string não quebra a separação de link-values', () => {
      const links = parseLink(
        '<https://api/x>; rel="next"; title="primeiro, depois", <https://api/y>; rel="prev"',
      );
      expect(links.size).toBe(2);
      expect(links.get('next')?.params['title']).toBe('primeiro, depois');
      expect(links.get('prev')?.uri).toBe('https://api/y');
    });

    it('ponto-e-vírgula dentro de quoted-string não quebra params', () => {
      const links = parseLink('<https://api/x>; rel="next"; title="a; b"');
      expect(links.get('next')?.params['title']).toBe('a; b');
    });
  });

  describe('formas defensivas', () => {
    it('ignora link-value sem rel (RFC permite mas não tem uso prático)', () => {
      const links = parseLink('<https://api/x>; title="sem rel"');
      expect(links.size).toBe(0);
    });

    it('ignora link-value malformado (sem <>)', () => {
      const links = parseLink('https://api/x; rel="next", <https://api/y>; rel="prev"');
      expect(links.size).toBe(1);
      expect(links.get('prev')?.uri).toBe('https://api/y');
    });

    it('aceita param sem valor (flag) — armazena string vazia', () => {
      const links = parseLink('<https://api/x>; rel="next"; deprecated');
      expect(links.get('next')?.params['deprecated']).toBe('');
    });

    it('keys de params são case-insensitive (lowercased)', () => {
      const links = parseLink('<https://api/x>; REL="next"; Title="X"');
      const next = links.get('next');
      expect(next?.params['rel']).toBe('next');
      expect(next?.params['title']).toBe('X');
    });

    it('whitespace extra entre params é tolerado', () => {
      const links = parseLink('  <https://api/x>  ;  rel="next"  ;  title="hello"  ');
      const next = links.get('next');
      expect(next?.uri).toBe('https://api/x');
      expect(next?.params['title']).toBe('hello');
    });

    it('quoted-string mal formada (closing quote escapada) preserva valor cru', () => {
      // `"a\"` — abriu aspa, escapou a única aspa que poderia fechá-la.
      // Sem detecção, o unescape produziria `a"` silentemente; o helper
      // detecta e devolve o token cru para o consumer perceber o erro.
      const links = parseLink('<https://api/x>; rel="next"; title="a\\"');
      expect(links.get('next')?.params['title']).toBe('"a\\"');
    });

    it('quoted-string com par de escapes consecutivos termina corretamente', () => {
      // `"a\\\\"` — dois backslashes literais (par); o `"` final É
      // closing legítimo. Resultado: `a\\` (um backslash desescapado).
      const links = parseLink('<https://api/x>; rel="next"; title="a\\\\"');
      expect(links.get('next')?.params['title']).toBe('a\\');
    });
  });
});
