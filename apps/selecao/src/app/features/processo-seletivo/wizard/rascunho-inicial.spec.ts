import { describe, expect, it } from 'vitest';
import {
  calculoInicial,
  classificacaoInicial,
  rascunhoInicial,
  regrasDaClassificacaoIniciais,
} from './rascunho-inicial';

describe('regras iniciais da classificação', () => {
  it('reúne classificação, bônus e desempate independentes', () => {
    const regras = regrasDaClassificacaoIniciais();
    expect(regras).toEqual({
      classificacao: classificacaoInicial(),
      bonus: rascunhoInicial().bonus,
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
