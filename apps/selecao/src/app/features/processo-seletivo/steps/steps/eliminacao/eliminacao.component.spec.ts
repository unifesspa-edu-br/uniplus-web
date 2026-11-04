import { describe, expect, it } from 'vitest';

import {
  componente,
  montarEliminacao,
  prepararClassificacaoLocal,
  store,
} from './eliminacao.testing';

describe('EliminacaoStepComponent', () => {
  montarEliminacao();

  it('recusa sem a regra de cálculo escolhida no passo Fórmula', () => {
    expect(componente.validate().valid).toBe(false);
  });

  it('sob classificação importada, ainda exige a ordem de alocação', () => {
    store.patchObjectSection('classificacao', {
      regraCalculoCodigo: 'CLASSIFICACAO-IMPORTADA',
      regraCalculoVersao: '1.0',
    });

    // Regra de cálculo escolhida, mas o restante do passo Fórmula não — o
    // wizard navega livremente, e a Eliminação grava o comando inteiro.
    expect(componente.validate().valid).toBe(false);
  });

  it('sob classificação importada com Fórmula completa, ignora regras de eliminação e valida', () => {
    store.patchObjectSection('classificacao', {
      regraCalculoCodigo: 'CLASSIFICACAO-IMPORTADA',
      regraCalculoVersao: '1.0',
      regraOrdemAlocacaoCodigo: 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA',
      regraOrdemAlocacaoVersao: '1.0',
    });

    expect(componente.validate().valid).toBe(true);
  });

  it('recusa quando a Fórmula não declarou a ordem de alocação, mesmo com o restante completo', () => {
    prepararClassificacaoLocal();
    store.patchObjectSection('classificacao', {
      regraOrdemAlocacaoCodigo: '',
      regraOrdemAlocacaoVersao: '',
    });

    const resultado = componente.validate();
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.join(' ')).toContain('ordem de alocação');
  });

  it('recusa sob fórmula local sem nenhuma etapa que componha a nota', () => {
    prepararClassificacaoLocal();
    store.patchObjectSection('cronograma', { etapas: [] });

    const resultado = componente.validate();
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.join(' ')).toContain('compõe a nota');
  });
});
