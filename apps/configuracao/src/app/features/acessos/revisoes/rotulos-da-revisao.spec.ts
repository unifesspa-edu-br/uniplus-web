import { SituacaoDaRevisaoCodigo } from '@uniplus/shared-data/autorizacao';
import { describe, expect, it } from 'vitest';
import { OPCOES_DO_FILTRO, itens, pendentes } from './rotulos-da-revisao';

describe('rótulos da revisão', () => {
  it('o filtro oferece todas, em andamento e concluída, no texto que a API dá à situação', () => {
    expect(OPCOES_DO_FILTRO).toEqual([
      { valor: 'todas', texto: 'Todas' },
      { valor: SituacaoDaRevisaoCodigo.EM_ANDAMENTO, texto: 'Em andamento' },
      { valor: SituacaoDaRevisaoCodigo.CONCLUIDA, texto: 'Concluída' },
    ]);
  });

  it('conta itens e pendentes no singular e no plural', () => {
    expect([itens(1), itens(0), pendentes(1), pendentes(3)]).toEqual([
      '1 item',
      '0 itens',
      '1 pendente',
      '3 pendentes',
    ]);
  });
});
