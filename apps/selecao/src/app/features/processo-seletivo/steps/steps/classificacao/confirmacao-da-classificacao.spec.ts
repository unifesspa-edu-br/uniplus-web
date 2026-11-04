import {} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import {} from '../../processo-seletivo.models';

import {
  RESOLUCAO,
  componente,
  montarEliminacao,
  prepararClassificacaoLocal,
  store,
} from '../eliminacao/eliminacao.testing';

describe('confirmação da classificação', () => {
  montarEliminacao();

  describe('confirmacaoDeGravacao()', () => {
    const MAIOR_IDADE = {
      regraCodigo: 'DESEMPATE-MAIOR-IDADE',
      regraVersao: '1',
      etapaRef: '',
      idadeMinima: '',
      fato: '',
      operador: '',
      valor: '',
      areas: [],
    };

    it('devolve null quando a configuração ainda é inválida', () => {
      expect(componente.confirmacaoDeGravacao()).toBeNull();
    });

    it('resume o que será gravado quando válida', () => {
      prepararClassificacaoLocal();

      const confirmacao = componente.confirmacaoDeGravacao();

      expect(confirmacao).not.toBeNull();
      expect(confirmacao?.itens.map((item) => item.rotulo)).toContain('Regra de cálculo');
    });

    it('mostra a resolução de Peso por Área que será gravada', () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });

      const item = componente
        .confirmacaoDeGravacao()
        ?.itens.find((linha) => linha.rotulo === 'Resolução de Peso por Área');

      expect(item?.valor).toBe(RESOLUCAO);
    });

    it('mostra a escala da nota final que vai na gravação', () => {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', { escalaNotaFinal: '1000' });

      expect(componente.confirmacaoDeGravacao()?.itens).toContainEqual({
        rotulo: 'Escala da nota final',
        valor: '0 a 1000',
      });
    });

    it('lista os critérios de desempate que a classificação grava junto', () => {
      prepararClassificacaoLocal();
      store.classificacao.desempatePendenteDeGravacao.set(true);
      store.patchSection('desempate', [MAIOR_IDADE]);

      const confirmacao = componente.confirmacaoDeGravacao();

      expect(confirmacao?.aviso).toContain('critérios de desempate');
      expect(confirmacao?.itens).toContainEqual({
        rotulo: '1º critério de desempate',
        valor: 'DESEMPATE-MAIOR-IDADE',
      });
    });

    it('não lista o desempate quando ele não espera a classificação', () => {
      prepararClassificacaoLocal();
      store.patchSection('desempate', [MAIOR_IDADE]);

      const confirmacao = componente.confirmacaoDeGravacao();

      expect(confirmacao?.aviso).not.toContain('desempate');
      expect(confirmacao?.itens.map((item) => item.rotulo)).not.toContain(
        '1º critério de desempate',
      );
    });
  });
});
