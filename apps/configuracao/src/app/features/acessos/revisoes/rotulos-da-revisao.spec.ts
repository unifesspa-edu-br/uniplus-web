import {
  QuemDecideOItem,
  SituacaoDaRevisao,
  SituacaoDoItemDaRevisao,
} from '@uniplus/shared-data/autorizacao';
import { describe, expect, it } from 'vitest';
import {
  itens,
  pendentes,
  quemDecide,
  situacaoDaRevisao,
  situacaoDoItem,
} from './rotulos-da-revisao';

describe('rótulos da revisão', () => {
  it('chama a revisão em andamento de aberta e a concluída de encerrada', () => {
    expect(situacaoDaRevisao(SituacaoDaRevisao.EM_ANDAMENTO).texto).toBe('Aberta');
    expect(situacaoDaRevisao(SituacaoDaRevisao.CONCLUIDA).texto).toBe('Encerrada');
  });

  it('traduz o resultado de cada item', () => {
    expect(situacaoDoItem(SituacaoDoItemDaRevisao.PENDENTE).texto).toBe('Aguarda decisão');
    expect(situacaoDoItem(SituacaoDoItemDaRevisao.CONFIRMADA)).toEqual({
      texto: 'Acesso mantido',
      variante: 'success',
    });
    expect(situacaoDoItem(SituacaoDoItemDaRevisao.REVOGADA)).toEqual({
      texto: 'Acesso revogado',
      variante: 'danger',
    });
    expect(situacaoDoItem(SituacaoDoItemDaRevisao.CONCESSAO_ENCERRADA).texto).toBe(
      'Concessão encerrada fora da revisão',
    );
  });

  it('nomeia quem decide pela função', () => {
    expect(quemDecide(QuemDecideOItem.REPRESENTANTE_DO_CONTROLADOR)).toBe(
      'Representante do controlador',
    );
    expect(quemDecide(QuemDecideOItem.GESTOR_DE_ACESSOS)).toBe('Gestão de acessos');
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
