import { describe, expect, it } from 'vitest';

import { documentoSemNada } from '../exemplos.testing';
import {
  comCampo,
  comCampoNulavel,
  comCodigo,
  comLista,
  comSecao,
  emSequencia,
} from './secao-do-documento';

interface Item {
  readonly codigo?: string;
  readonly nome?: string | null;
  readonly itens?: readonly string[];
}

describe('edição de campo', () => {
  it('define o campo sem alterar o objeto recebido', () => {
    const original: Item = { nome: 'antes' };

    expect(comCampo(original, 'nome', 'depois')).toEqual({ nome: 'depois' });
    expect(original).toEqual({ nome: 'antes' });
  });

  it('remove a chave quando o valor é undefined, em vez de gravar vazio', () => {
    expect(comCampo<Item, 'nome'>({ nome: 'x', codigo: 'A' }, 'nome', undefined)).toEqual({
      codigo: 'A',
    });
  });

  it('o vazio não troca o null explícito, mas esvazia o campo que tinha valor', () => {
    const comNulo: Item = { nome: null };

    expect(comCampoNulavel(comNulo, 'nome', undefined)).toBe(comNulo);
    expect(comCampoNulavel(comNulo, 'nome', 'Nome')).toEqual({ nome: 'Nome' });
    expect(comCampoNulavel<Item, 'nome'>({ nome: 'x' }, 'nome', undefined)).toEqual({});
    expect(comCampoNulavel<Item, 'nome'>({}, 'nome', undefined)).toEqual({});
  });

  it('só troca o descritivo quando o código muda', () => {
    const item: Item = { codigo: 'A', nome: 'Nome de A' };

    expect(comCodigo(item, 'codigo', 'A', ['nome'])).toBe(item);
    expect(comCodigo(item, 'codigo', 'B', ['nome'])).toEqual({ codigo: 'B' });
  });

  it('lista vazia só fica onde já existia', () => {
    expect(comLista<Item, 'itens'>({}, 'itens', [])).toEqual({});
    expect(comLista<Item, 'itens'>({ itens: ['a'] }, 'itens', [])).toEqual({ itens: [] });
    expect(comLista<Item, 'itens'>({}, 'itens', ['a'])).toEqual({ itens: ['a'] });
  });
});

describe('edição de seção', () => {
  it('não cria a seção quando ela continua sem campos', () => {
    const documento = documentoSemNada();

    expect(comSecao(documento, 'taxaDeInscricao', {})).toBe(documento);
  });

  it('cria a seção quando algum campo foi preenchido e mantém a existente, ainda que vazia', () => {
    const comTaxa = comSecao(documentoSemNada(), 'taxaDeInscricao', { cobra: true });

    expect(comTaxa.taxaDeInscricao).toEqual({ cobra: true });
    expect(comSecao(comTaxa, 'taxaDeInscricao', {}).taxaDeInscricao).toEqual({});
  });

  it('aplica as edições na ordem dada', () => {
    const ordem: string[] = [];
    const registrar = (nome: string) => (documento: ReturnType<typeof documentoSemNada>) => {
      ordem.push(nome);
      return documento;
    };

    emSequencia(registrar('primeira'), registrar('segunda'))(documentoSemNada());

    expect(ordem).toEqual(['primeira', 'segunda']);
  });
});
