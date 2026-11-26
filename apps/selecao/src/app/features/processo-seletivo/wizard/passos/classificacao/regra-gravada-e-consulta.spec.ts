import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { BonusPassoComponent } from '../bonus/bonus.component';
import { FormulaPassoComponent } from '../formula/formula.component';
import {
  CLASSIFICACAO_LOCAL,
  controlesEditaveis,
  detectar,
  leitura,
  montar,
  publicar,
  regra,
  semControles,
  valorDoSelect,
} from './regra-gravada-e-consulta.testing';

describe('regra gravada no select, passo lido como texto em consulta — fórmula e bônus', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  describe('Fórmula', () => {
    it('mostra as regras gravadas quando o catálogo chega depois do rascunho', async () => {
      const { fixture, host, store, catalogos } = await montar(FormulaPassoComponent);
      store.patchObjectSection('classificacao', CLASSIFICACAO_LOCAL);
      detectar(fixture);

      catalogos.regrasCalculo.set([
        regra('CLASSIFICACAO_IMPORTADA'),
        regra('FORMULA_MEDIA_PONDERADA'),
      ]);
      catalogos.regrasArredondamento.set([regra('ARRED-TRUNCAR')]);
      catalogos.regrasOrdemAlocacao.set([regra('ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA')]);
      detectar(fixture);

      expect(valorDoSelect(host, 'f-regra-calculo')).toBe('FORMULA_MEDIA_PONDERADA|1.0');
      expect(valorDoSelect(host, 'f-regra-arredondamento')).toBe('ARRED-TRUNCAR|1.0');
      expect(valorDoSelect(host, 'f-ordem-alocacao')).toBe(
        'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA|1.0',
      );
    });

    it('com o processo publicado, lê as regras gravadas como texto', async () => {
      const { fixture, host, store, catalogos } = await montar(FormulaPassoComponent);
      store.patchObjectSection('classificacao', CLASSIFICACAO_LOCAL);
      publicar(store);
      catalogos.regrasCalculo.set([regra('FORMULA_MEDIA_PONDERADA')]);
      catalogos.regrasArredondamento.set([regra('ARRED-TRUNCAR')]);
      detectar(fixture);

      expect(semControles(host)).toEqual([]);
      expect(leitura(host)).toEqual([
        ['Regra de cálculo', 'FORMULA_MEDIA_PONDERADA — Base de FORMULA_MEDIA_PONDERADA'],
        ['Regra de arredondamento', 'ARRED-TRUNCAR — Base de ARRED-TRUNCAR'],
        ['Casas decimais', '2'],
        ['Escala da nota final', '0 a 100'],
        ['Ordem de alocação', 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA — base legal indisponível'],
        ['Classificação baseada em provas e notas do ENEM', 'Não'],
      ]);
    });

    it('trava os controles enquanto a gravação está em curso', async () => {
      const { fixture, host, store } = await montar(FormulaPassoComponent);
      store.patchObjectSection('classificacao', CLASSIFICACAO_LOCAL);
      store.salvando.set(true);
      detectar(fixture);

      expect(controlesEditaveis(host, 'select, input')).toEqual([]);
    });
  });

  describe('FADA', () => {
    it('mostra a regra gravada quando o catálogo chega depois do rascunho', async () => {
      const { fixture, host, store, catalogos } = await montar(BonusPassoComponent);
      store.patchObjectSection('bonus', {
        aplica: true,
        regraCodigo: 'BONUS-REGIONAL',
        regraVersao: '1.0',
      });
      detectar(fixture);

      catalogos.regrasBonus.set([regra('BONUS-OUTRO'), regra('BONUS-REGIONAL')]);
      detectar(fixture);

      expect(valorDoSelect(host, 'f-bonus-regra')).toBe('BONUS-REGIONAL|1.0');
    });

    it('com o processo publicado, lê o bônus gravado como texto', async () => {
      const { fixture, host, store, catalogos } = await montar(BonusPassoComponent);
      store.patchObjectSection('bonus', {
        aplica: true,
        regraCodigo: 'BONUS-REGIONAL',
        regraVersao: '1.0',
        fator: '1.2',
        teto: '',
      });
      publicar(store);
      catalogos.regrasBonus.set([regra('BONUS-REGIONAL')]);
      detectar(fixture);

      expect(semControles(host)).toEqual([]);
      expect(leitura(host)).toEqual([
        ['FADA', 'Aplicado neste processo'],
        ['Regra do FADA', 'BONUS-REGIONAL — Base de BONUS-REGIONAL'],
        ['Fator', '1,2'],
        ['Teto', 'Sem teto'],
        ['Base Legal do FADA', 'Não informado'],
      ]);
    });

    it('com o processo publicado e sem bônus, diz que ele não se aplica', async () => {
      const { fixture, host, store } = await montar(BonusPassoComponent);
      store.patchObjectSection('bonus', { aplica: false });
      publicar(store);
      detectar(fixture);

      expect(leitura(host)).toEqual([['FADA', 'Não aplicado neste processo']]);
      expect(host.querySelector('.bonus-info')).toBeNull();
    });

    it('trava os controles enquanto a gravação está em curso', async () => {
      const { fixture, host, store } = await montar(BonusPassoComponent);
      store.patchObjectSection('bonus', {
        aplica: true,
        regraCodigo: 'BONUS-REGIONAL',
        regraVersao: '1.0',
      });
      store.salvando.set(true);
      detectar(fixture);

      expect(controlesEditaveis(host, 'select, input')).toEqual([]);
    });
  });
});
