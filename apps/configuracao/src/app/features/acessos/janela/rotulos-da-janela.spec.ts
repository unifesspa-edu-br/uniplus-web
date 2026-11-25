import {
  SituacaoDaConcessaoNaRevisaoCodigo,
  SituacaoDaRevisaoDasConcessoesCodigo,
} from '@uniplus/shared-data/autorizacao';
import { describe, expect, it } from 'vitest';
import { situacaoDaJanela, situacaoDoItem } from './rotulos-da-janela';

describe('situações da revisão das concessões', () => {
  it('mostra o rótulo recebido e escolhe a cor pelo código', () => {
    expect(
      situacaoDoItem({
        codigo: SituacaoDaConcessaoNaRevisaoCodigo.RECUSADA,
        rotulo: 'Rótulo da API',
      }),
    ).toEqual({
      texto: 'Rótulo da API',
      variante: 'danger',
    });
    expect(
      situacaoDaJanela({ codigo: SituacaoDaRevisaoDasConcessoesCodigo.ABERTA, rotulo: 'Em curso' }),
    ).toEqual({
      texto: 'Em curso',
      variante: 'warning',
    });
  });
});
