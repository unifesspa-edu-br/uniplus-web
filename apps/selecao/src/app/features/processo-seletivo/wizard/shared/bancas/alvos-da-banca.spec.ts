import { describe, expect, it } from 'vitest';

import { alvosDaBanca, type IdsDaBanca } from './alvos-da-banca';

const IDS: IdsDaBanca = {
  grupo: (banca) => `grupo-${banca}`,
  controle: (banca, controle) => `${banca}-${controle}`,
  categorias: (banca) => `${banca}-categorias`,
  secao: 'secao',
};

describe('alvosDaBanca', () => {
  it('prefere o controle, depois o modo, o grupo da banca e por fim a seção', () => {
    expect(alvosDaBanca({ identificador: 'b1', controle: 'quorum' }, IDS)).toEqual([
      'b1-quorum',
      'b1-modo',
      'grupo-b1',
      'secao',
    ]);
  });

  it.each(['regra', 'modo'])(
    'leva a recusa de %s ao seletor do modo, sem repeti-lo',
    (controle) => {
      expect(alvosDaBanca({ identificador: 'b1', controle }, IDS)).toEqual([
        'b1-modo',
        'grupo-b1',
        'secao',
      ]);
    },
  );

  it('leva a recusa das categorias ao conjunto de categorias da banca', () => {
    expect(alvosDaBanca({ identificador: 'b1', controle: 'categoriasDocumentoIds' }, IDS)).toEqual([
      'b1-categorias',
      'grupo-b1',
      'secao',
    ]);
  });

  it('leva a recusa das categorias ao grupo quando a lista não tem categorias', () => {
    const semCategorias: IdsDaBanca = { ...IDS, categorias: undefined };

    expect(
      alvosDaBanca({ identificador: 'b1', controle: 'categoriasDocumentoIds' }, semCategorias),
    ).toEqual(['grupo-b1', 'secao']);
  });

  it('leva ao grupo da banca a recusa sem controle', () => {
    expect(alvosDaBanca({ identificador: 'b1', controle: null }, IDS)).toEqual([
      'grupo-b1',
      'secao',
    ]);
  });
});
