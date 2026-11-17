import { describe, expect, it } from 'vitest';

import { referenciaDaRegra, referenciaQueVale, regraEscolhida } from './regra-escolhida';

describe('regra escolhida', () => {
  it('lê regra ausente como nenhuma regra escolhida', () => {
    expect(regraEscolhida(undefined)).toBeNull();
    expect(regraEscolhida(null)).toBeNull();
  });

  it('lê o que falta na referência como campo vazio', () => {
    expect(regraEscolhida({ codigo: 'REGRA-X' })).toEqual({ codigo: 'REGRA-X', versao: '' });
  });

  it('não leva ao documento regra sem código nem versão', () => {
    expect(referenciaDaRegra(null)).toBeUndefined();
    expect(referenciaDaRegra({ codigo: ' ', versao: '' })).toBeUndefined();
  });

  it('leva só o que foi preenchido', () => {
    expect(referenciaDaRegra({ codigo: 'REGRA-X', versao: 'v2' })).toEqual({
      codigo: 'REGRA-X',
      versao: 'v2',
    });
    expect(referenciaDaRegra({ codigo: 'REGRA-X', versao: '' })).toEqual({ codigo: 'REGRA-X' });
  });
});

describe('referência que vale depois da edição', () => {
  it('devolve a mesma referência, mesmo vazia, enquanto a escolha não muda', () => {
    const vazia = {};
    const completa = { codigo: 'REGRA-X', versao: 'v1' };

    expect(referenciaQueVale(vazia, regraEscolhida(vazia))).toBe(vazia);
    expect(referenciaQueVale(completa, regraEscolhida(completa))).toBe(completa);
  });

  it('troca a referência quando a escolha muda e a remove quando ela é limpa', () => {
    const atual = { codigo: 'REGRA-X', versao: 'v1' };

    expect(referenciaQueVale(atual, { codigo: 'REGRA-Y', versao: 'v2' })).toEqual({
      codigo: 'REGRA-Y',
      versao: 'v2',
    });
    expect(referenciaQueVale(atual, null)).toBeUndefined();
    expect(referenciaQueVale({}, null)).toBeUndefined();
  });

  it('não cria referência quando nada estava escolhido', () => {
    expect(referenciaQueVale(undefined, null)).toBeUndefined();
    expect(referenciaQueVale(null, null)).toBeUndefined();
  });
});
