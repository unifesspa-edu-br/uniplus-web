import { describe, expect, it } from 'vitest';
import { CODIGO_CADASTRO_FORMATO, codigoComNome } from './codigo-cadastro.util';

describe('formato do código de cadastro', () => {
  it.each(['A', 'LEI_12711', 'ANALISE_DOCUMENTAL'])('aceita %s', (codigo) => {
    expect(CODIGO_CADASTRO_FORMATO.test(codigo)).toBe(true);
  });

  it.each([' A', 'A ', 'abc', 'Á', 'COR__RACA', 'COR_', '_AC', '1AC'])('recusa %s', (codigo) => {
    expect(CODIGO_CADASTRO_FORMATO.test(codigo)).toBe(false);
  });
});

describe('código com nome', () => {
  it('junta o código e o nome com travessão', () => {
    expect(codigoComNome('AC', 'Ampla concorrência')).toBe('AC — Ampla concorrência');
  });

  it.each([undefined, null, ''])('devolve só o código quando o nome é %s', (nome) => {
    expect(codigoComNome('AC', nome)).toBe('AC');
  });

  it('devolve só o código quando o nome tem apenas espaços', () => {
    expect(codigoComNome('AC', '   ')).toBe('AC');
  });

  it('retira os espaços das pontas do nome', () => {
    expect(codigoComNome('AC', '  Ampla concorrência  ')).toBe('AC — Ampla concorrência');
  });
});
