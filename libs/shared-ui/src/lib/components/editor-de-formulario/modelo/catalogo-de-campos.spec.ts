import { describe, expect, it } from 'vitest';

import {
  fatosParaAcrescentar,
  pressupostosParaAcrescentar,
  renderizacaoDe,
} from './catalogo-de-campos';
import { conteudo, fato, item, secao } from './conteudos-de-exemplo.testing';

describe('renderizacaoDe', () => {
  it.each([
    ['SIM_OU_NAO', 'VALOR_UNICO', null, 'SIM_OU_NAO'],
    ['NUMERICO', 'VALOR_UNICO', null, 'NUMERO'],
    ['TEXTO', 'VALOR_UNICO', null, 'TEXTO'],
    ['DATA', 'VALOR_UNICO', null, 'DATA'],
    ['ENDERECO', 'VALOR_UNICO', null, 'ENDERECO'],
    ['OPCAO', 'VALOR_UNICO', 'GLOBAL', 'ESCOLHA_UNICA'],
    ['OPCAO', 'VARIOS_VALORES', 'GLOBAL', 'ESCOLHA_MULTIPLA'],
    ['OPCAO', 'VALOR_UNICO', 'MUNICIPIOS', 'MUNICIPIO'],
    ['TEXTO', 'VARIOS_VALORES', null, null],
  ])('%s %s (%s) → %s, como a API confere', (dominio, cardinalidade, fonteValores, esperado) => {
    expect(
      renderizacaoDe({
        dominio: { codigo: dominio, rotulo: dominio },
        cardinalidade: { codigo: cardinalidade, rotulo: cardinalidade },
        fonteValores: fonteValores === null ? null : { codigo: fonteValores, rotulo: fonteValores },
      }),
    ).toBe(esperado);
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
      fato('MUNICIPIO', {
        dominio: { codigo: 'OPCAO', rotulo: 'OPCAO' },
        fonteValores: { codigo: 'MUNICIPIOS', rotulo: 'MUNICIPIOS' },
      }),
      fato('NOMES', {
        dominio: { codigo: 'TEXTO', rotulo: 'TEXTO' },
        cardinalidade: { codigo: 'VARIOS_VALORES', rotulo: 'VARIOS_VALORES' },
      }),
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
