import { describe, expect, it } from 'vitest';
import {
  booleano,
  codigo,
  ehObjeto,
  garantirUnicos,
  lista,
  numero,
  textos,
} from './leitura-dos-valores';

describe('leitura dos valores das regras', () => {
  it('trata lista ausente como vazia e informa o caminho de elemento nulo', () => {
    expect(lista(null, 'itens', (valor) => valor)).toEqual([]);
    expect(() => lista([null], 'itens', (valor) => valor)).toThrow(
      "O elemento 'itens[0]' das regras é nulo.",
    );
  });
  it('recusa lista de textos vazia ou com texto em branco', () => {
    expect(() => textos([], 'valores', 'Informe valores.')).toThrow('Informe valores.');
    expect(() => textos([' '], 'valores', 'Informe valores.')).toThrow('Informe valores.');
    expect(textos(['A'], 'valores', 'Informe valores.')).toEqual(['A']);
  });
  it('lê booleano ausente como falso e mantém o verdadeiro', () => {
    expect(booleano(undefined, 'ativo')).toBe(false);
    expect(booleano(true, 'ativo')).toBe(true);
  });
  it('aceita número em notação exponencial e recusa texto numérico malformado', () => {
    expect(numero('-1.5e2', 'valor')).toBe(-150);
    expect(numero(null, 'valor')).toBeNull();
    expect(() => numero('01', 'valor')).toThrow('O valor é um número.');
  });
  it('recusa código em branco e códigos repetidos', () => {
    expect(() => codigo(' ', 'codigo')).toThrow('O código é obrigatório.');
    expect(() => garantirUnicos(['A', 'A'], 'campo')).toThrow(
      "O código 'A' aparece mais de uma vez como campo.",
    );
  });
  it('distingue objeto de lista e nulo', () => {
    expect(ehObjeto({})).toBe(true);
    expect(ehObjeto([])).toBe(false);
    expect(ehObjeto(null)).toBe(false);
  });
});
