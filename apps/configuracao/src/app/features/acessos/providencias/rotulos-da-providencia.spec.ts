import { SituacaoDaProvidenciaCodigo, TipoDaProvidencia } from '@uniplus/shared-data/autorizacao';
import { describe, expect, it } from 'vitest';
import { FILTROS_DA_FILA, TIPOS_DA_PROVIDENCIA } from './rotulos-da-providencia';

describe('rótulos da providência', () => {
  it('o filtro da fila começa pelas abertas e termina em todas', () => {
    expect(FILTROS_DA_FILA.map((f) => f.valor)).toEqual([
      SituacaoDaProvidenciaCodigo.ABERTA,
      SituacaoDaProvidenciaCodigo.RESPONDIDA,
      SituacaoDaProvidenciaCodigo.ATENDIDA,
      SituacaoDaProvidenciaCodigo.PREJUDICADA,
      'todas',
    ]);
    expect(FILTROS_DA_FILA.map((f) => f.rotulo)).toEqual([
      'Aberta',
      'Respondida',
      'Atendida',
      'Prejudicada',
      'Todas',
    ]);
  });

  it('a solicitação oferece a retirada e a revisão do acesso', () => {
    expect(TIPOS_DA_PROVIDENCIA).toEqual([
      { valor: TipoDaProvidencia.RETIRADA, rotulo: 'Retirada do acesso' },
      { valor: TipoDaProvidencia.REVISAO, rotulo: 'Revisão do acesso' },
    ]);
  });
});
