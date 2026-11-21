import { describe, expect, it } from 'vitest';

import { comTipoDeclarado, semTipoDeclarado } from './tipos-de-decisao-declarados';

describe('tipos declarados', () => {
  it('guarda o tipo acrescentado em ordem alfabética do código', () => {
    expect(comTipoDeclarado(['NOTA_DA_ETAPA'], 'CLASSIFICACAO')).toEqual([
      'CLASSIFICACAO',
      'NOTA_DA_ETAPA',
    ]);
  });

  it('não repete o tipo que já estava declarado', () => {
    expect(comTipoDeclarado(['CLASSIFICACAO'], 'CLASSIFICACAO')).toEqual(['CLASSIFICACAO']);
  });

  it('ordena também a lista que chegou fora de ordem', () => {
    expect(comTipoDeclarado(['NOTA_DA_ETAPA', 'ANALISE_DOCUMENTAL'], 'CLASSIFICACAO')).toEqual([
      'ANALISE_DOCUMENTAL',
      'CLASSIFICACAO',
      'NOTA_DA_ETAPA',
    ]);
  });

  it('tira só o tipo desmarcado', () => {
    expect(semTipoDeclarado(['CLASSIFICACAO', 'NOTA_DA_ETAPA'], 'CLASSIFICACAO')).toEqual([
      'NOTA_DA_ETAPA',
    ]);
  });

  it('devolve lista vazia quando o último tipo é tirado', () => {
    expect(semTipoDeclarado(['CLASSIFICACAO'], 'CLASSIFICACAO')).toEqual([]);
  });

  it('não altera a lista recebida', () => {
    const declarados = ['NOTA_DA_ETAPA'];

    comTipoDeclarado(declarados, 'CLASSIFICACAO');

    expect(declarados).toEqual(['NOTA_DA_ETAPA']);
  });
});
