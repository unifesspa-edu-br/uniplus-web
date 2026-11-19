import { describe, expect, it } from 'vitest';

import { opcoesDeCursoExibidas } from './opcoes-de-curso-do-comprovante';

const AC = { codigo: 'AC', nome: 'Ampla concorrência', ordem: 0 };

const DUAS_OPCOES_FORA_DE_ORDEM = {
  numeroDeOpcoesDeCurso: 2,
  opcoesDeCurso: [
    { ordem: 2, nome: 'Medicina', modalidades: null },
    {
      ordem: 1,
      nome: 'Direito',
      modalidades: [{ codigo: 'LI_EP', nome: 'Escola pública', ordem: 1 }, AC],
    },
  ],
};

describe('opcoesDeCursoExibidas', () => {
  it('com uma só opção admitida, o rótulo é "Curso"', () => {
    const [opcao] = opcoesDeCursoExibidas({
      numeroDeOpcoesDeCurso: 1,
      opcoesDeCurso: [{ ordem: 1, nome: 'Direito', modalidades: [AC] }],
    });

    expect(opcao).toEqual({
      rotulo: 'Curso',
      curso: 'Direito',
      exibicao: 'Direito',
      modalidades: ['Ampla concorrência'],
    });
  });

  it('o curso que a versão não nomeia aparece sem inventar nome', () => {
    const [opcao] = opcoesDeCursoExibidas({
      numeroDeOpcoesDeCurso: 1,
      opcoesDeCurso: [{ ordem: 1, nome: null, modalidades: null }],
    });

    expect(opcao.curso).toBeNull();
    expect(opcao.exibicao).toBe('Curso não identificado');
    expect(opcao.modalidades).toBeNull();
  });

  it('com 2 opções admitidas e só a 1ª declarada, a 2ª aparece como não declarada', () => {
    const opcoes = opcoesDeCursoExibidas({
      numeroDeOpcoesDeCurso: 2,
      opcoesDeCurso: [{ ordem: 1, nome: 'Direito', modalidades: [AC] }],
    });

    expect(opcoes.map((o) => [o.rotulo, o.exibicao])).toEqual([
      ['1ª opção', 'Direito'],
      ['2ª opção', 'Não declarada'],
    ]);
  });

  it('as opções saem pela ordem delas e as modalidades, pela ordem da oferta', () => {
    const opcoes = opcoesDeCursoExibidas(DUAS_OPCOES_FORA_DE_ORDEM);

    expect(opcoes.map((o) => o.rotulo)).toEqual(['1ª opção', '2ª opção']);
    expect(opcoes[0].modalidades).toEqual(['Ampla concorrência', 'Escola pública']);
  });
});
