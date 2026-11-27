import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { FadaPassoComponent } from '../fada/fada.component';
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

describe('regra gravada no select, passo lido como texto em consulta — fórmula e Fator de Atenuação', () => {
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

  describe('Fator de Atenuação', () => {
    it('mostra a regra gravada quando o catálogo chega depois do rascunho', async () => {
      const { fixture, host, store, catalogos } = await montar(FadaPassoComponent);
      store.patchObjectSection('fada', {
        aplica: true,
        regraCodigo: 'BONUS-REGIONAL',
        regraVersao: '1.0',
      });
      detectar(fixture);

      catalogos.regrasFada.set([regra('BONUS-OUTRO'), regra('BONUS-REGIONAL')]);
      detectar(fixture);

      expect(valorDoSelect(host, 'f-fada-regra')).toBe('BONUS-REGIONAL|1.0');
    });

    it('com o processo publicado, lê o Fator de Atenuação gravado como texto', async () => {
      const { fixture, host, store, catalogos } = await montar(FadaPassoComponent);
      store.patchObjectSection('fada', {
        aplica: true,
        regraCodigo: 'BONUS-REGIONAL',
        regraVersao: '1.0',
        fator: '1.2',
        teto: '',
      });
      publicar(store);
      catalogos.regrasFada.set([regra('BONUS-REGIONAL')]);
      detectar(fixture);

      expect(semControles(host)).toEqual([]);
      expect(leitura(host)).toEqual([
        ['Fator de Atenuação', 'Aplicado neste processo'],
        ['Regra do Fator de Atenuação', 'BONUS-REGIONAL — Base de BONUS-REGIONAL'],
        ['Multiplicador da nota', '1,2'],
        ['Teto', 'Sem teto'],
        ['Base legal do Fator de Atenuação', 'Não informado'],
      ]);
    });

    it('com o processo publicado e sem Fator de Atenuação, diz que ele não se aplica', async () => {
      const { fixture, host, store } = await montar(FadaPassoComponent);
      store.patchObjectSection('fada', { aplica: false });
      publicar(store);
      detectar(fixture);

      expect(leitura(host)).toEqual([['Fator de Atenuação', 'Não aplicado neste processo']]);
      expect(host.querySelector('.fada-info')).toBeNull();
    });

    it('trava os controles enquanto a gravação está em curso', async () => {
      const { fixture, host, store } = await montar(FadaPassoComponent);
      store.patchObjectSection('fada', {
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
