import { describe, expect, it } from 'vitest';

import { COM_LISTA, SO_IGUALDADE } from './operadores-de-exemplo.testing';
import { type CondicaoEmClausula } from './condicoes/condicoes-em-clausulas';
import { fatoEscolhivel, type FatoEscolhivel } from './condicoes/fatos-escolhiveis';
import {
  QUEM_ATENDE_AS_CONDICOES,
  TODOS_OS_CANDIDATOS,
  descreverAlternativas,
  descreverCondicao,
  fatosParaLeitura,
  resumoDaRegra,
} from './leitura-de-condicoes';

const COR_RACA = fatoEscolhivel({
  codigo: 'COR_RACA',
  nome: 'Cor/raça',
  dominio: { codigo: 'OPCAO', rotulo: 'OPCAO' },
  valoresDominio: ['PRETA', 'PARDA', 'INDIGENA', 'NAO_DECLARADA'],
  valoresDominioDeclarados: [
    { codigo: 'PRETA', descricao: 'Preta' },
    { codigo: 'PARDA', descricao: 'Parda' },
    { codigo: 'INDIGENA', descricao: 'Indígena' },
    { codigo: 'NAO_DECLARADA', descricao: null },
  ],
  binding: 'CAMPO_INSCRICAO:corRaca',
  operadoresAdmitidos: COM_LISTA,
}) as FatoEscolhivel;
const ESCOLA_PUBLICA = fatoEscolhivel({
  codigo: 'ESCOLA_PUBLICA',
  nome: 'Cursou o ensino médio em escola pública',
  dominio: { codigo: 'SIM_OU_NAO', rotulo: 'SIM_OU_NAO' },
  binding: 'CAMPO_INSCRICAO:escolaPublica',
  operadoresAdmitidos: SO_IGUALDADE,
}) as FatoEscolhivel;
const FATOS = new Map([COR_RACA, ESCOLA_PUBLICA].map((fato) => [fato.codigo, fato]));

describe('leitura das condições', () => {
  it('nomeia o fato que saiu do catálogo e a condição ainda sem valor', () => {
    expect(descreverCondicao({ fato: 'RENDA', operador: 'IGUAL', valor: '1' }, undefined)).toBe(
      'RENDA — fora do catálogo',
    );
    expect(descreverCondicao({ fato: 'COR_RACA', operador: 'IGUAL', valor: '' }, COR_RACA)).toBe(
      'Cor/raça é (valor não escolhido)',
    );
  });

  it('mostra o valor pela descrição do cadastro, e pelo código só quando ele não tem descrição', () => {
    expect(
      descreverCondicao(
        { fato: 'COR_RACA', operador: 'ALGUM_DE', valor: '["PRETA","INDIGENA","NAO_DECLARADA"]' },
        COR_RACA,
      ),
    ).toBe('Cor/raça é um de Preta, Indígena, NAO_DECLARADA');
  });

  it('lê cada alternativa com as condições ligadas por "e", na ordem das cláusulas', () => {
    const condicoes: CondicaoEmClausula[] = [
      { clausula: 2, fato: 'COR_RACA', operador: 'IGUAL', valor: '"INDIGENA"' },
      { clausula: 1, fato: 'ESCOLA_PUBLICA', operador: 'IGUAL', valor: 'true' },
      { clausula: 1, fato: 'COR_RACA', operador: 'DIFERENTE', valor: '"PARDA"' },
    ];

    expect(descreverAlternativas(condicoes, FATOS)).toEqual([
      'Cursou o ensino médio em escola pública é sim e Cor/raça não é Parda',
      'Cor/raça é Indígena',
    ]);
  });

  it('resume a regra numa linha: sem condição vale para todos, e sem o catálogo a com condição só se anuncia', () => {
    const condicoes: CondicaoEmClausula[] = [
      { clausula: 1, fato: 'ESCOLA_PUBLICA', operador: 'IGUAL', valor: 'true' },
      { clausula: 2, fato: 'COR_RACA', operador: 'IGUAL', valor: '"INDIGENA"' },
    ];

    expect(resumoDaRegra([], null)).toBe(TODOS_OS_CANDIDATOS);
    expect(resumoDaRegra(condicoes, null)).toBe(QUEM_ATENDE_AS_CONDICOES);
    expect(resumoDaRegra(condicoes, FATOS)).toBe(
      'Cursou o ensino médio em escola pública é sim; ou Cor/raça é Indígena',
    );
  });
});

it('mostra que falta escolha quando a condição de lista está vazia', () => {
  expect(descreverCondicao({ fato: 'COR_RACA', operador: 'ALGUM_DE', valor: '' }, COR_RACA)).toBe(
    'Cor/raça é um de (valor não escolhido)',
  );
});

it('lê o valor booleano falso como não', () => {
  expect(
    descreverCondicao(
      { fato: 'ESCOLA_PUBLICA', operador: 'IGUAL', valor: 'false' },
      ESCOLA_PUBLICA,
    ),
  ).toBe('Cursou o ensino médio em escola pública é não');
});

it('omite da leitura os fatos com domínio desconhecido', () => {
  const catalogo = [
    {
      codigo: 'A',
      nome: 'Alternativa',
      dominio: { codigo: 'OUTRO', rotulo: 'Outro' },
      binding: '',
      operadoresAdmitidos: [],
    },
  ];
  expect(fatosParaLeitura(catalogo).size).toBe(0);
});
