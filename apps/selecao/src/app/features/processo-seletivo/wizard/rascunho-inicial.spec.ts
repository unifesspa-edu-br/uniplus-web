import { describe, expect, it } from 'vitest';
import {
  calculoInicial,
  classificacaoInicial,
  rascunhoInicial,
  regrasDaClassificacaoIniciais,
} from './rascunho-inicial';

describe('regras iniciais da classificação', () => {
  it('reúne classificação, Fator de Atenuação e desempate independentes', () => {
    const regras = regrasDaClassificacaoIniciais();
    expect(regras).toEqual({
      classificacao: classificacaoInicial(),
      fada: rascunhoInicial().fada,
      desempate: [],
    });
    expect(regrasDaClassificacaoIniciais().classificacao).not.toBe(regras.classificacao);
  });

  it('inicia todos os campos do cálculo vazios', () => {
    expect(calculoInicial()).toEqual({
      regraCalculoCodigo: '',
      regraCalculoVersao: '',
      regraArredondamentoCodigo: '',
      regraArredondamentoVersao: '',
      casasArredondamento: '',
    });
    expect(classificacaoInicial()).toMatchObject(calculoInicial());
  });
});
