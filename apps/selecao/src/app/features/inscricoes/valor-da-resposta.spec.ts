import { describe, expect, it } from 'vitest';

import { formatarDecimalExato, valorExibido } from './valor-da-resposta';

const SEM_VALOR = { valor: null };

describe('valorExibido', () => {
  it('passa o texto como está e deixa o vazio ao componente de valor', () => {
    expect(valorExibido('texto', 'Fernanda')).toEqual({ valor: 'Fernanda' });
    expect(valorExibido('texto', null)).toEqual(SEM_VALOR);
  });

  it('mostra a data em dd/mm/aaaa sem mudar o dia', () => {
    expect(valorExibido('data', '2000-03-09')).toEqual({ valor: '09/03/2000' });
  });

  it('mostra a data e hora no fuso institucional', () => {
    expect(valorExibido('data-hora', '2026-12-10T15:30:00Z')).toEqual({
      valor: '10/12/2026, 12:30',
    });
  });

  it('mostra a hora pelo formatador de hora e mantém o que não é hora', () => {
    expect(valorExibido('hora', '08:30')).toEqual({ valor: '08:30' });
    expect(valorExibido('hora', '08:30:15')).toEqual({ valor: '08:30' });
    expect(valorExibido('hora', '25:99')).toEqual({ valor: '25:99' });
    expect(valorExibido('hora', 'cedo')).toEqual({ valor: 'cedo' });
  });

  it('entrega o booleano ao componente, que o diz como Sim ou Não', () => {
    expect(valorExibido('booleano', true)).toEqual({ valor: true });
    expect(valorExibido('booleano', false)).toEqual({ valor: false });
  });

  it('formata o decimal exato com vírgula e sem milhar, sem passar por número', () => {
    expect(valorExibido('numero', '1234567.50')).toEqual({ valor: '1234567,50' });
    expect(formatarDecimalExato('12345678901234567890.123456789')).toBe(
      '12345678901234567890,123456789',
    );
    expect(formatarDecimalExato('-0.5')).toBe('-0,5');
    expect(formatarDecimalExato('7')).toBe('7');
    expect(formatarDecimalExato('1000')).toBe('1000');
    expect(formatarDecimalExato('abc')).toBe('abc');
  });

  it('mostra a opção pelo rótulo e a lista de opções pelos rótulos', () => {
    expect(valorExibido('opcao', { codigo: '1505502', rotulo: 'Marabá' })).toEqual({
      valor: 'Marabá',
    });
    expect(
      valorExibido('opcoes', [
        { codigo: 'a', rotulo: 'Escola pública' },
        { codigo: 'b', rotulo: 'Renda baixa' },
      ]),
    ).toEqual({ valor: ['Escola pública', 'Renda baixa'] });
    expect(valorExibido('opcoes', [])).toEqual({ valor: [] });
  });

  it('mostra o endereço em linhas e omite a parte que não veio', () => {
    expect(
      valorExibido('endereco', {
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
    expect(valorExibido('endereco', { municipio: 'Marabá' })).toEqual({ linhas: ['Marabá'] });
    expect(valorExibido('endereco', {})).toEqual(SEM_VALOR);
    expect(valorExibido('endereco', { logradouro: 'Folha 31' })).toEqual({
      linhas: ['Folha 31'],
    });
  });

  it('mostra o identificador mascarado qualquer que seja o tipo declarado', () => {
    for (const tipo of ['texto', 'numero', 'data', 'booleano', 'opcao', 'opcoes', 'endereco']) {
      expect(valorExibido(tipo, '***.598.363-**')).toEqual({ valor: '***.598.363-**' });
    }
    expect(valorExibido('hora', '***')).toEqual({ valor: '***' });
  });

  it('aceita o número JSON e a string decimal no tipo numero', () => {
    expect(valorExibido('numero', 1234.5)).toEqual({ valor: '1234,5' });
    expect(valorExibido('numero', '1234.50')).toEqual({ valor: '1234,50' });
    expect(valorExibido('numero', true)).toEqual({ valor: true });
  });

  it('repassa o booleano e o número de tipo inesperado ou desconhecido, sem deixá-los sumir', () => {
    expect(valorExibido('texto', true)).toEqual({ valor: true });
    expect(valorExibido('texto', 42)).toEqual({ valor: 42 });
    expect(valorExibido('booleano', 3)).toEqual({ valor: 3 });
    expect(valorExibido('tipo-novo', false)).toEqual({ valor: false });
    expect(valorExibido('tipo-novo', 7)).toEqual({ valor: 7 });
    expect(valorExibido('tipo-novo', 'texto')).toEqual({ valor: 'texto' });
  });

  it('não inventa valor para a forma que o tipo não admite e não é texto', () => {
    expect(valorExibido('opcao', { sem: 'rotulo' })).toEqual(SEM_VALOR);
    expect(valorExibido('endereco', [1, 2])).toEqual(SEM_VALOR);
  });
});
