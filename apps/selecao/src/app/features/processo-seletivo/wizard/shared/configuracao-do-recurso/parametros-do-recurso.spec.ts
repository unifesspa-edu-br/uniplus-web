import { describe, expect, it } from 'vitest';

import { opcoesParaEscolha } from './parametros-do-recurso';

const VOCABULARIO = [
  { codigo: 'diasUteis', rotulo: 'dias úteis' },
  { codigo: 'horas', rotulo: 'horas' },
];

describe('opcoesParaEscolha', () => {
  it('oferece só as opções do vocabulário quando o valor atual é uma delas', () => {
    expect(opcoesParaEscolha(VOCABULARIO, 'horas')).toEqual([
      { codigo: 'diasUteis', rotulo: 'dias úteis', foraDoVocabulario: false },
      { codigo: 'horas', rotulo: 'horas', foraDoVocabulario: false },
    ]);
  });

  it('oferece só as opções do vocabulário quando ainda não há valor', () => {
    const opcoes = opcoesParaEscolha(VOCABULARIO, '');

    expect(opcoes.map((opcao) => opcao.codigo)).toEqual(['diasUteis', 'horas']);
    expect(opcoes.some((opcao) => opcao.foraDoVocabulario)).toBe(false);
  });

  it('acrescenta o valor atual que o vocabulário não oferece, marcado e com o código como rótulo', () => {
    const opcoes = opcoesParaEscolha(VOCABULARIO, 'dias');

    expect(opcoes.map((opcao) => opcao.codigo)).toEqual(['diasUteis', 'horas', 'dias']);
    expect(opcoes[2]).toEqual({ codigo: 'dias', rotulo: 'dias', foraDoVocabulario: true });
  });

  it('com vocabulário vazio, mostra só o valor atual', () => {
    expect(opcoesParaEscolha([], 'horas')).toEqual([
      { codigo: 'horas', rotulo: 'horas', foraDoVocabulario: true },
    ]);
  });

  it('com vocabulário vazio e sem valor, não oferece nada', () => {
    expect(opcoesParaEscolha([], '')).toEqual([]);
  });
});
