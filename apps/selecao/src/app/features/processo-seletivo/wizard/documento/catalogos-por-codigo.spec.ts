import { describe, expect, it } from 'vitest';

import { catalogoPorCodigo, codigoComNomeDoCatalogo, rotuloDoCodigo } from './catalogos-por-codigo';

describe('rótulo do código', () => {
  const catalogo = catalogoPorCodigo([{ codigo: 'CEPS', rotulo: 'Rótulo do catálogo vivo' }]);

  it('prefere o rótulo que o processo gravou ao do catálogo vivo', () => {
    expect(rotuloDoCodigo(catalogo, 'CEPS', 'Rótulo congelado')).toBe('Rótulo congelado');
  });

  it('usa o catálogo quando o item ainda não tem rótulo gravado', () => {
    expect(rotuloDoCodigo(catalogo, 'CEPS', undefined)).toBe('Rótulo do catálogo vivo');
  });

  it('identifica o item pelo código quando nenhum dos dois sabe o rótulo', () => {
    expect(rotuloDoCodigo(catalogo, 'EXTINTA', undefined)).toBe('EXTINTA');
  });
});

describe('código com nome do catálogo', () => {
  const catalogo = catalogoPorCodigo([{ codigo: 'ZZ_TESTE', rotulo: 'Nome do catálogo vivo' }]);

  it('prefere o nome gravado ao do catálogo vivo', () => {
    expect(codigoComNomeDoCatalogo(catalogo, 'ZZ_TESTE', 'Modalidade de teste Alfa')).toBe(
      'ZZ_TESTE — Modalidade de teste Alfa',
    );
  });

  it('usa o catálogo quando não há nome gravado', () => {
    expect(codigoComNomeDoCatalogo(catalogo, 'ZZ_TESTE', undefined)).toBe(
      'ZZ_TESTE — Nome do catálogo vivo',
    );
  });

  it('mostra só o código quando nenhum dos dois traz o nome', () => {
    expect(codigoComNomeDoCatalogo(catalogo, 'ZZ_OUTRA', undefined)).toBe('ZZ_OUTRA');
  });
});
