import { describe, expect, it } from 'vitest';

import { OFERTA_NAO_IDENTIFICADA, ofertasEmOrdem } from './ofertas-escolhidas';

describe('ofertasEmOrdem', () => {
  it('ordena pela ordem da escolha, também quando ela chega como texto', () => {
    const ofertas = ofertasEmOrdem([
      { id: 'b', nome: 'Enfermagem', ordem: '2' },
      { id: 'a', nome: 'Medicina', ordem: 1 },
    ]);

    expect(ofertas.map((o) => [o.ordem, o.nome])).toEqual([
      [1, 'Medicina'],
      [2, 'Enfermagem'],
    ]);
  });

  it('ordena numericamente ordens de dois dígitos que chegam como texto', () => {
    const ofertas = ofertasEmOrdem([
      { id: 'a', nome: 'Décima', ordem: '10' },
      { id: 'b', nome: 'Segunda', ordem: '2' },
      { id: 'c', nome: 'Primeira', ordem: 1 },
    ]);

    expect(ofertas.map((o) => o.ordem)).toEqual([1, 2, 10]);
  });

  it('mantém a oferta sem nome como não identificada', () => {
    expect(ofertasEmOrdem([{ id: 'a', nome: null, ordem: 1 }])).toEqual([
      { id: 'a', nome: OFERTA_NAO_IDENTIFICADA, ordem: 1 },
    ]);
  });

  it('sem ofertas devolve lista vazia', () => {
    expect(ofertasEmOrdem(undefined)).toEqual([]);
    expect(ofertasEmOrdem(null)).toEqual([]);
  });
});
