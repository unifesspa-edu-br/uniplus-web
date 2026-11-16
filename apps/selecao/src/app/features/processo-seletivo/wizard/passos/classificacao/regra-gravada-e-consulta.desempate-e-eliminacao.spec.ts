import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { DesempatePassoComponent } from '../desempate/desempate.component';
import { EdicaoDosCriterios } from '../desempate/edicao-dos-criterios.service';
import { EliminacaoPassoComponent } from '../eliminacao/eliminacao.component';
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

describe('regra gravada no select, passo lido como texto em consulta — desempate e eliminação', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  describe('Desempate', () => {
    const criterio = {
      regraCodigo: 'DESEMPATE-MAIOR-IDADE',
      regraVersao: '1.0',
      etapaRef: '',
      idadeMinima: '',
      fato: '',
      operador: '',
      valor: '',
      valores: [],
      areas: [],
    };

    it('mostra a regra gravada quando o catálogo chega depois do rascunho', async () => {
      const { fixture, host, store, catalogos } = await montar(DesempatePassoComponent);
      store.patchSection('desempate', [criterio]);
      detectar(fixture);

      catalogos.criteriosDesempate.set([regra('DESEMPATE-IDOSO'), regra('DESEMPATE-MAIOR-IDADE')]);
      detectar(fixture);

      expect(valorDoSelect(host, 'desemp-regra-0')).toBe('DESEMPATE-MAIOR-IDADE|1.0');
    });

    it('com o processo publicado, lê cada critério como texto, na ordem, sem ações', async () => {
      const { fixture, host, store, catalogos } = await montar(DesempatePassoComponent);
      const idoso = { ...criterio, regraCodigo: 'DESEMPATE-IDOSO', idadeMinima: '60' };
      store.patchSection('desempate', [criterio, idoso]);
      publicar(store);
      catalogos.criteriosDesempate.set([regra('DESEMPATE-MAIOR-IDADE'), regra('DESEMPATE-IDOSO')]);
      detectar(fixture);

      expect(semControles(host)).toEqual([]);
      expect(leitura(host)).toEqual([
        ['Regra do critério', 'DESEMPATE-MAIOR-IDADE — Base de DESEMPATE-MAIOR-IDADE'],
        ['Regra do critério', 'DESEMPATE-IDOSO — Base de DESEMPATE-IDOSO'],
        ['Idade mínima', '60'],
      ]);
      expect(Array.from(host.querySelectorAll('.desempate-num'), (num) => num.textContent)).toEqual(
        ['1º', '2º'],
      );
    });

    it('trava os controles enquanto a gravação está em curso', async () => {
      const { fixture, host, store } = await montar(DesempatePassoComponent);
      store.patchSection('desempate', [criterio, criterio]);
      store.salvando.set(true);
      detectar(fixture);

      expect(controlesEditaveis(host, 'select, input')).toEqual([]);
      expect(controlesEditaveis(host, '.desempate-btn, #desempate-acrescentar')).toEqual([]);
    });

    it('com o processo publicado, acrescentar, mover e remover pelo código não mudam o rascunho', async () => {
      const { fixture, store } = await montar(DesempatePassoComponent);
      const segundo = { ...criterio, regraCodigo: 'DESEMPATE-IDOSO' };
      store.patchSection('desempate', [criterio, segundo]);
      publicar(store);
      detectar(fixture);
      const edicao = fixture.debugElement.injector.get(EdicaoDosCriterios);

      edicao.acrescentar();
      edicao.mover(0, 1);
      edicao.remover(0);

      expect(store.draft().desempate).toEqual([criterio, segundo]);
    });
  });

  describe('Eliminação', () => {
    const regraGravada = {
      regraCodigo: 'ELIM-NOTA-MINIMA-ETAPA',
      regraVersao: '1.0',
      etapaRef: '',
      notaMinima: '400',
      minimo: '',
      areaCodigo: '',
    };

    it('mostra a regra gravada quando o catálogo chega depois do rascunho', async () => {
      const { fixture, host, store, catalogos } = await montar(EliminacaoPassoComponent);
      store.patchObjectSection('classificacao', {
        ...CLASSIFICACAO_LOCAL,
        regrasEliminacao: [regraGravada],
      });
      detectar(fixture);

      catalogos.regrasEliminacao.set([regra('ELIM-ZERO-EM-AREA'), regra('ELIM-NOTA-MINIMA-ETAPA')]);
      detectar(fixture);

      expect(valorDoSelect(host, 'elim-regra-0')).toBe('ELIM-NOTA-MINIMA-ETAPA|1.0');
    });

    it('com o processo publicado, lê cada regra como texto, sem ações', async () => {
      const { fixture, host, store, catalogos } = await montar(EliminacaoPassoComponent);
      store.patchObjectSection('classificacao', {
        ...CLASSIFICACAO_LOCAL,
        regrasEliminacao: [regraGravada],
      });
      publicar(store);
      catalogos.regrasEliminacao.set([regra('ELIM-NOTA-MINIMA-ETAPA')]);
      detectar(fixture);

      expect(semControles(host)).toEqual([]);
      expect(leitura(host)).toEqual([
        ['Regra de eliminação 1', 'ELIM-NOTA-MINIMA-ETAPA — Base de ELIM-NOTA-MINIMA-ETAPA'],
        ['Etapa', 'Não informado'],
        ['Nota mínima', '400'],
      ]);
    });

    it('com o processo publicado e nenhuma regra, diz que não há regra declarada', async () => {
      const { fixture, host, store } = await montar(EliminacaoPassoComponent);
      store.patchObjectSection('classificacao', { ...CLASSIFICACAO_LOCAL, regrasEliminacao: [] });
      publicar(store);
      detectar(fixture);

      expect(semControles(host)).toEqual([]);
      expect(host.textContent).toContain('Nenhuma regra de eliminação declarada.');
    });

    it('com o processo publicado e sem regra de cálculo, não diz que a classificação é importada', async () => {
      const { fixture, host, store } = await montar(EliminacaoPassoComponent);
      store.patchObjectSection('classificacao', {
        ...CLASSIFICACAO_LOCAL,
        regraCalculoCodigo: '',
        regrasEliminacao: [],
      });
      publicar(store);
      detectar(fixture);

      expect(semControles(host)).toEqual([]);
      expect(host.textContent).toContain('Nenhuma regra de cálculo declarada no passo Fórmula.');
      expect(host.textContent).not.toContain('importada');
    });

    it('trava os controles enquanto a gravação está em curso', async () => {
      const { fixture, host, store } = await montar(EliminacaoPassoComponent);
      store.patchObjectSection('classificacao', {
        ...CLASSIFICACAO_LOCAL,
        regrasEliminacao: [regraGravada],
      });
      store.salvando.set(true);
      detectar(fixture);

      expect(controlesEditaveis(host, 'select, input')).toEqual([]);
      expect(controlesEditaveis(host, '#elim-remover-0, #eliminacao-acrescentar')).toEqual([]);
    });

    it('com o processo publicado, acrescentar, alterar e remover pelo código não mudam o rascunho', async () => {
      const { fixture, store } = await montar(EliminacaoPassoComponent);
      store.patchObjectSection('classificacao', {
        ...CLASSIFICACAO_LOCAL,
        regrasEliminacao: [regraGravada],
      });
      publicar(store);
      detectar(fixture);
      const componente = fixture.componentInstance;

      componente.acrescentarRegra();
      store.patchObjectSection('classificacao', {
        regrasEliminacao: [{ ...regraGravada, regraCodigo: 'ELIM-ZERO-EM-AREA' }],
      });
      componente.removerRegra(0);

      expect(store.draft().classificacao.regrasEliminacao).toEqual([regraGravada]);
    });
  });
});
