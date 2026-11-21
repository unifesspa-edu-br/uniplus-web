import { describe, expect, it } from 'vitest';

import {
  fatosParaAcrescentar,
  pressupostosParaAcrescentar,
  renderizacaoDe,
} from './catalogo-de-campos';
import { conteudo, fato, item, secao } from './conteudos-de-exemplo.testing';

describe('renderizacaoDe', () => {
  it.each([
    ['BOOLEANO', 'ESCALAR', null, 'BOOLEANO'],
    ['NUMERICO', 'ESCALAR', null, 'NUMERO'],
    ['TEXTO', 'ESCALAR', null, 'TEXTO'],
    ['DATA', 'ESCALAR', null, 'DATA'],
    ['ENDERECO', 'ESCALAR', null, 'ENDERECO'],
    ['CATEGORICO', 'ESCALAR', 'GLOBAL', 'SELECAO_UNICA'],
    ['CATEGORICO', 'MULTIVALORADO', 'GLOBAL', 'SELECAO_MULTIPLA'],
    ['CATEGORICO', 'ESCALAR', 'GEO_MUNICIPIO', 'MUNICIPIO'],
    ['TEXTO', 'MULTIVALORADO', null, null],
  ])('%s %s (%s) → %s, como a API confere', (dominio, cardinalidade, fonteValores, esperado) => {
    expect(renderizacaoDe({ dominio, cardinalidade, fonteValores })).toBe(esperado);
  });
});

describe('fatosParaAcrescentar', () => {
  it('oferece só o coletável ativo do candidato que o formulário ainda não tem', () => {
    const catalogo = [
      fato('JA_NO_FORMULARIO'),
      fato('NOVO'),
      fato('DESATIVADO', { ativo: false }),
      fato('DE_MEMBRO', { escopo: 'MEMBRO_GRUPO' }),
      fato('DERIVADO', { binding: 'REGRA_DERIVACAO:DERIVADO' }),
      fato('MUNICIPIO', { dominio: 'CATEGORICO', fonteValores: 'GEO_MUNICIPIO' }),
      fato('NOMES', { dominio: 'TEXTO', cardinalidade: 'MULTIVALORADO' }),
    ];
    const atual = conteudo({
      etapas: [secao('S1', 0)],
      itens: [item('JA_NO_FORMULARIO', 0, 'S1')],
    });

    expect(fatosParaAcrescentar(atual, catalogo).map((f) => f.codigo)).toEqual([
      'MUNICIPIO',
      'NOVO',
    ]);
  });

  it('o fato pressuposto não é oferecido como campo: vem do formulário anterior ou é coletado aqui, nunca os dois', () => {
    const atual = conteudo({ etapas: [secao('S1', 0)], pressupostos: ['P'] });

    expect(fatosParaAcrescentar(atual, [fato('P'), fato('Q')]).map((f) => f.codigo)).toEqual(['Q']);
  });
});

describe('pressupostosParaAcrescentar', () => {
  it('a inscrição não tem pressuposto, e o fato já coletado pelo formulário não é oferecido', () => {
    const atual = conteudo({ etapas: [secao('S1', 0)], itens: [item('A', 0, 'S1')] });
    const catalogo = [fato('A'), fato('B')];

    expect(pressupostosParaAcrescentar(atual, catalogo, 'INSCRICAO')).toEqual([]);
    expect(
      pressupostosParaAcrescentar(atual, catalogo, 'HABILITACAO').map((f) => f.codigo),
    ).toEqual(['B']);
  });
});
