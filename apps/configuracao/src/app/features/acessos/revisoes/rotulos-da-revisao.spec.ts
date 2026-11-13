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
    expect(situacaoDaRevisao('em_andamento').texto).toBe('Aberta');
    expect(situacaoDaRevisao('concluida').texto).toBe('Encerrada');
  });

  it('traduz o resultado de cada item', () => {
    expect(situacaoDoItem('pendente').texto).toBe('Aguarda decisão');
    expect(situacaoDoItem('confirmada')).toEqual({ texto: 'Acesso mantido', variante: 'success' });
    expect(situacaoDoItem('revogada')).toEqual({ texto: 'Acesso revogado', variante: 'danger' });
    expect(situacaoDoItem('concessao_encerrada').texto).toBe('Concessão encerrada fora da revisão');
  });

  it('nomeia quem decide pela função', () => {
    expect(quemDecide('representante-do-controlador')).toBe('Representante do controlador');
    expect(quemDecide('gestor-de-acessos')).toBe('Gestão de acessos');
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
