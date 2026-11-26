import { describe, expect, it } from 'vitest';

import { ROTULOS_DOS_PASSOS } from '../../processo-seletivo.data';
import {
  componente,
  fixture,
  montarEliminacao,
  prepararClassificacaoLocal,
  store,
} from './eliminacao.testing';
import { REGRA_ELIMINACAO_VAZIA } from './regras-de-eliminacao';

describe('EliminacaoPassoComponent', () => {
  montarEliminacao();

  it('recusa sem a regra de cálculo escolhida no passo Fórmula', () => {
    expect(componente.validar().valid).toBe(false);
  });

  it('sob classificação importada, ainda exige a ordem de alocação', () => {
    store.patchObjectSection('classificacao', {
      regraCalculoCodigo: 'CLASSIFICACAO_IMPORTADA',
      regraCalculoVersao: '1.0',
    });

    // Regra de cálculo escolhida, mas o restante do passo Fórmula não — o
    // wizard navega livremente, e a Eliminação grava o comando inteiro.
    expect(componente.validar().valid).toBe(false);
  });

  it('sob classificação importada com Fórmula completa, ignora regras de eliminação e valida', () => {
    store.patchObjectSection('classificacao', {
      regraCalculoCodigo: 'CLASSIFICACAO_IMPORTADA',
      regraCalculoVersao: '1.0',
      regraOrdemAlocacaoCodigo: 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA',
      regraOrdemAlocacaoVersao: '1.0',
      regrasEliminacao: [REGRA_ELIMINACAO_VAZIA],
    });

    expect(componente.validar().valid).toBe(true);
  });

  it('recusa quando a Fórmula não declarou a ordem de alocação, mesmo com o restante completo', () => {
    prepararClassificacaoLocal();
    store.patchObjectSection('classificacao', {
      regraOrdemAlocacaoCodigo: '',
      regraOrdemAlocacaoVersao: '',
    });

    const resultado = componente.validar();
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.join(' ')).toContain('ordem de alocação');
  });

  it('recusa sob fórmula local sem nenhuma etapa que componha a nota', () => {
    prepararClassificacaoLocal();
    store.patchObjectSection('cronograma', { etapas: [] });

    const resultado = componente.validar();
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.join(' ')).toContain('compõe a nota');
  });

  describe('abertura do passo', () => {
    const abertura = (): string =>
      (fixture.nativeElement as HTMLElement).querySelector('.step-subtitle')?.textContent ?? '';

    it('diz em linguagem clara o que é gravado de uma só vez junto com as regras', () => {
      fixture.detectChanges();

      expect(abertura().replace(/\s+/g, ' ')).toContain(
        'o sistema grava de uma só vez as regras de eliminação e o que foi escolhido no passo',
      );
      expect(abertura()).not.toMatch(/comando|os quatro/i);
    });

    it('cita o passo da fórmula pelo nome que o menu lateral mostra', () => {
      fixture.detectChanges();

      expect(ROTULOS_DOS_PASSOS).toContain('Fórmula e precisão');
      expect(abertura()).toContain('passo Fórmula e precisão:');
    });
  });
});
