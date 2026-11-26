import { describe, expect, it } from 'vitest';

import { formatarDecimalExato, formatarMoeda, valorExibido } from './valor-da-resposta';

const SEM_VALOR = { valor: null };

describe('valorExibido: formas descritas no contrato do comprovante', () => {
  it('lê o endereço pelas chaves do contrato, sem exibir o código IBGE nem o nome da UF por extenso', () => {
    expect(
      valorExibido('ENDERECO', {
        cep: '68500-000',
        logradouro: 'Folha 31',
        numero: '10',
        complemento: 'Casa',
        bairro: 'Nova Marabá',
        municipio: 'Marabá',
        municipioCodigoIbge: '1504208',
        uf: 'PA',
        ufNome: 'Pará',
      }),
    ).toEqual({
      linhas: ['Folha 31, 10 — Casa', 'Nova Marabá', 'Marabá/PA', 'CEP 68500-000'],
    });
  });

  it('lê a opção e a lista de opções pelo rótulo, não pelo código', () => {
    expect(valorExibido('OPCAO', { codigo: 'PARDA', rotulo: 'Parda' })).toEqual({ valor: 'Parda' });
    expect(
      valorExibido('OPCOES', [
        { codigo: 'LI_EP', rotulo: 'Escola pública' },
        { codigo: 'AC', rotulo: 'Ampla concorrência' },
      ]),
    ).toEqual({ valor: ['Escola pública', 'Ampla concorrência'] });
  });
});

describe('valorExibido', () => {
  it('passa o texto como está e deixa o vazio ao componente de valor', () => {
    expect(valorExibido('TEXTO', 'Fernanda')).toEqual({ valor: 'Fernanda' });
    expect(valorExibido('TEXTO', null)).toEqual(SEM_VALOR);
  });

  it('mostra a data em dd/mm/aaaa sem mudar o dia', () => {
    expect(valorExibido('DATA', '2000-03-09')).toEqual({ valor: '09/03/2000' });
  });

  it('entrega o booleano ao componente, que o diz como Sim ou Não', () => {
    expect(valorExibido('SIM_OU_NAO', true)).toEqual({ valor: true });
    expect(valorExibido('SIM_OU_NAO', false)).toEqual({ valor: false });
  });

  it('formata o decimal exato com vírgula e sem milhar, sem passar por número', () => {
    expect(valorExibido('NUMERO', '1234567.50')).toEqual({ valor: '1234567,50' });
    expect(formatarDecimalExato('12345678901234567890.123456789')).toBe(
      '12345678901234567890,123456789',
    );
    expect(formatarDecimalExato('-0.5')).toBe('-0,5');
    expect(formatarDecimalExato('7')).toBe('7');
    expect(formatarDecimalExato('1000')).toBe('1000');
    expect(formatarDecimalExato('abc')).toBe('abc');
  });

  it('mostra a opção pelo rótulo e a lista de opções pelos rótulos', () => {
    expect(valorExibido('OPCAO', { codigo: '1505502', rotulo: 'Marabá' })).toEqual({
      valor: 'Marabá',
    });
    expect(
      valorExibido('OPCOES', [
        { codigo: 'a', rotulo: 'Escola pública' },
        { codigo: 'b', rotulo: 'Renda baixa' },
      ]),
    ).toEqual({ valor: ['Escola pública', 'Renda baixa'] });
    expect(valorExibido('OPCOES', [])).toEqual({ valor: [] });
  });

  it('mostra o endereço em linhas e omite a parte que não veio', () => {
    expect(
      valorExibido('ENDERECO', {
        cep: '68500-000',
        logradouro: 'Folha 31',
        numero: '12',
        complemento: 'Quadra 7',
        bairro: 'Nova Marabá',
        municipio: 'Marabá',
        uf: 'PA',
      }),
    ).toEqual({
      linhas: ['Folha 31, 12 — Quadra 7', 'Nova Marabá', 'Marabá/PA', 'CEP 68500-000'],
    });
    expect(valorExibido('ENDERECO', { municipio: 'Marabá' })).toEqual({ linhas: ['Marabá'] });
    expect(valorExibido('ENDERECO', {})).toEqual(SEM_VALOR);
    expect(valorExibido('ENDERECO', { logradouro: 'Folha 31' })).toEqual({
      linhas: ['Folha 31'],
    });
  });

  it('mostra o identificador mascarado qualquer que seja o tipo declarado', () => {
    for (const tipo of ['TEXTO', 'NUMERO', 'DATA', 'SIM_OU_NAO', 'OPCAO', 'OPCOES', 'ENDERECO']) {
      expect(valorExibido(tipo, '***.598.363-**')).toEqual({ valor: '***.598.363-**' });
    }
  });

  it('aceita o número JSON e a string decimal no tipo numero', () => {
    expect(valorExibido('NUMERO', 1234.5)).toEqual({ valor: '1234,5' });
    expect(valorExibido('NUMERO', '1234.50')).toEqual({ valor: '1234,50' });
    expect(valorExibido('NUMERO', true)).toEqual({ valor: true });
  });

  it('repassa o booleano e o número de tipo inesperado ou desconhecido, sem deixá-los sumir', () => {
    expect(valorExibido('TEXTO', true)).toEqual({ valor: true });
    expect(valorExibido('TEXTO', 42)).toEqual({ valor: 42 });
    expect(valorExibido('SIM_OU_NAO', 3)).toEqual({ valor: 3 });
    expect(valorExibido('tipo-novo', false)).toEqual({ valor: false });
    expect(valorExibido('tipo-novo', 7)).toEqual({ valor: 7 });
    expect(valorExibido('tipo-novo', 'texto')).toEqual({ valor: 'texto' });
  });

  it('não inventa valor para a forma que o tipo não admite e não é texto', () => {
    expect(valorExibido('OPCAO', { sem: 'rotulo' })).toEqual(SEM_VALOR);
    expect(valorExibido('ENDERECO', [1, 2])).toEqual(SEM_VALOR);
  });

  it('mostra o componente moeda em reais a partir do decimal exato, string ou número JSON', () => {
    expect(valorExibido('NUMERO', '1234.56', 'MOEDA')).toEqual({ valor: 'R$ 1.234,56' });
    expect(valorExibido('NUMERO', 1234.5, 'MOEDA')).toEqual({ valor: 'R$ 1.234,50' });
    expect(valorExibido('NUMERO', '7', 'MOEDA')).toEqual({ valor: 'R$ 7,00' });
    expect(formatarMoeda('12345678901234567890.123')).toBe('R$ 12.345.678.901.234.567.890,123');
    expect(formatarMoeda('-1000.5')).toBe('-R$ 1.000,50');
    expect(formatarMoeda('abc')).toBe('abc');
  });

  it('mostra o CPF e o identificador como a API os devolve, qualquer que seja o tipo', () => {
    expect(valorExibido('TEXTO', '***.598.363-**', 'CPF')).toEqual({ valor: '***.598.363-**' });
    expect(valorExibido('NUMERO', '*********', 'IDENTIFICADOR')).toEqual({ valor: '*********' });
  });

  it('entrega o componente situacao para a etiqueta de situação', () => {
    expect(valorExibido('TEXTO', 'enviada', 'SITUACAO')).toEqual({ situacao: 'enviada' });
    expect(valorExibido('TEXTO', 'deferida', 'SITUACAO')).toEqual({ valor: 'deferida' });
  });

  it('volta à exibição pelo tipo no componente padrão, desconhecido ou sem a forma dele', () => {
    expect(valorExibido('NUMERO', '1234.56', 'PADRAO')).toEqual({ valor: '1234,56' });
    expect(valorExibido('NUMERO', '1234.56', 'novo-componente')).toEqual({ valor: '1234,56' });
    expect(valorExibido('NUMERO', true, 'MOEDA')).toEqual({ valor: true });
  });
});
