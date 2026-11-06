import { mensagemDeRemovidos } from './referencias-removidas';

describe('mensagemDeRemovidos', () => {
  it('não diz nada sem itens removidos', () => {
    expect(mensagemDeRemovidos('a condição', 'as condições', [], 'feminino')).toBeUndefined();
  });

  it('concorda com o gênero no singular', () => {
    const itens = [{ nome: 'Sala térrea' }];
    expect(mensagemDeRemovidos('a condição', 'as condições', itens, 'feminino')).toBe(
      'Remova a condição "Sala térrea", que já foi removida do cadastro, antes de gravar.',
    );
    expect(mensagemDeRemovidos('o recurso', 'os recursos', itens, 'masculino')).toBe(
      'Remova o recurso "Sala térrea", que já foi removido do cadastro, antes de gravar.',
    );
  });

  it('concorda com o gênero no plural e nomeia todos', () => {
    const itens = [{ nome: 'A' }, { nome: 'B' }];
    expect(mensagemDeRemovidos('a condição', 'as condições', itens, 'feminino')).toBe(
      'Remova as condições que já foram removidas do cadastro antes de gravar: A, B.',
    );
    expect(mensagemDeRemovidos('o recurso', 'os recursos', itens, 'masculino')).toBe(
      'Remova os recursos que já foram removidos do cadastro antes de gravar: A, B.',
    );
  });
});
