import { TIPOS_DE_DECISAO } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { comTipoDeclarado, semTipoDeclarado, tiposOferecidos } from './tipos-de-decisao-declarados';

describe('tipos oferecidos', () => {
  it('oferece o vocabulário inteiro quando nada foi declarado', () => {
    expect(tiposOferecidos([])).toEqual(TIPOS_DE_DECISAO);
  });

  it('não repete o tipo declarado que o vocabulário conhece', () => {
    expect(tiposOferecidos(['CLASSIFICACAO'])).toHaveLength(TIPOS_DE_DECISAO.length);
  });

  it('acrescenta o código declarado que o vocabulário não conhece, com o código como rótulo', () => {
    const oferecidos = tiposOferecidos(['TIPO_DO_FUTURO', 'TIPO_DO_FUTURO']);

    expect(oferecidos.slice(TIPOS_DE_DECISAO.length)).toEqual([
      { codigo: 'TIPO_DO_FUTURO', rotulo: 'TIPO_DO_FUTURO' },
    ]);
  });
});

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
