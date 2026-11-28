import { describe, expect, it } from 'vitest';

import { pendenciasDoQuadro } from './conferencia-das-vagas';
import { AC, distribuicao } from './distribuicao-de-vagas.testing';

describe('pendenciasDoQuadro — modalidade com nome', () => {
  const semQuantidade = distribuicao({
    modalidades: [{ id: AC.id, codigo: 'ZZ_TESTE', nome: 'Modalidade de teste Alfa' }],
    quadro: [],
  });

  it('cita o código com o nome da coluna em falta', () => {
    const colunas = [{ id: AC.id, codigo: 'ZZ_TESTE', nome: 'Modalidade de teste Alfa' }];

    expect(pendenciasDoQuadro([semQuantidade], colunas)).toEqual([
      '1 oferta sem a quantidade de ZZ_TESTE — Modalidade de teste Alfa',
    ]);
  });

  it('cita só o código quando a coluna não tem nome', () => {
    const colunas = [{ id: AC.id, codigo: 'ZZ_TESTE', nome: '' }];

    expect(pendenciasDoQuadro([semQuantidade], colunas)).toEqual([
      '1 oferta sem a quantidade de ZZ_TESTE',
    ]);
  });
});
