import { HttpTestingController } from '@angular/common/http/testing';
import { ProcessoSeletivoDto, StatusProcesso } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CascataRemanejamentoComponent } from './cascata-remanejamento.component';
import {
  BASE,
  LB_PPI,
  LB_Q,
  distribuicaoFederal,
  montarCascata,
} from './cascata-remanejamento.testing';

describe('CascataRemanejamentoComponent — em consulta', () => {
  let componente: CascataRemanejamentoComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let elemento: HTMLElement;
  let detectar: () => void;

  beforeEach(async () => {
    ({ componente, store, controller, elemento, detectar } = await montarCascata());
  });

  afterEach(() => controller.verify());

  describe('em consulta, com a regra gravada que o catálogo não confirma', () => {
    const URL_DA_REGRA = `${BASE}/api/selecao/regras-catalogo/REMANEJ-CASCATA-LEI-12711/versoes/v0`;

    /** O store não aceita mutação em consulta: grava como rascunho e volta a publicado. */
    beforeEach(() => {
      store.patchObjectSection('vagas', {
        ofertas: [distribuicaoFederal([{ id: LB_PPI, codigo: 'LB_PPI' }])],
        cascata: { regraCodigo: 'REMANEJ-CASCATA-LEI-12711', regraVersao: 'v0' },
      });
      store.remoteSnapshot.set({
        status: StatusProcesso.publicado,
      } as unknown as ProcessoSeletivoDto);
      detectar();
    });

    const leitura = () => (elemento.textContent ?? '').replace(/\s+/g, ' ');

    it('sem o catálogo de modalidades, a seção aparece pela regra gravada', () => {
      componente.catalogos.modalidades.set([]);
      componente.catalogos.erro.set('Falha');
      detectar();

      expect(componente.precisaExibir()).toBe(false);
      expect(leitura()).toContain('Cascata de remanejamento');
      // A busca da versão gravada não é o assunto deste teste.
      controller.match(URL_DA_REGRA);
    });

    it('quando a seção aparece só porque o catálogo falhou, não afirma que a cascata se aplica', () => {
      componente.catalogos.modalidades.set([]);
      componente.catalogos.erro.set('Falha');
      detectar();

      expect(leitura()).toContain('não foi possível confirmar se a cascata se aplica');
      expect(leitura()).not.toContain('Ao menos uma oferta desta distribuição');
      controller.match(URL_DA_REGRA);
    });

    /** O snapshot já responde: o catálogo fora do ar não torna a pergunta aberta. */
    it('com a regra de remanejamento gravada, o catálogo fora do ar não cria a seção', () => {
      store.remoteSnapshot.set({
        status: StatusProcesso.rascunho,
      } as unknown as ProcessoSeletivoDto);
      store.patchObjectSection('vagas', {
        ofertas: [
          distribuicaoFederal([
            {
              id: LB_Q,
              codigo: 'LB_Q',
              gravada: {
                descricao: null,
                composicaoVagas: 'RETIRADA_DE_OUTRA_MODALIDADE',
                composicaoOrigemCodigo: null,
                regraRemanejamento: 'DESTINO_UNICO',
                remanejamentoDestino: 'AC',
                remanejamentoPar: null,
                remanejamentoFallback: null,
              },
            },
          ]),
        ],
      });
      store.remoteSnapshot.set({
        status: StatusProcesso.publicado,
      } as unknown as ProcessoSeletivoDto);
      componente.catalogos.modalidades.set([]);
      componente.catalogos.erro.set('Falha');
      detectar();

      expect(componente.precisaExibir()).toBe(false);
      expect(componente.exibirSecao()).toBe(false);
      expect(leitura()).not.toContain('não foi possível confirmar');
      controller.match(URL_DA_REGRA);
    });

    it('durante o carregamento do catálogo, a seção não aparece pela exceção', () => {
      componente.catalogos.modalidades.set([]);
      componente.catalogos.carregando.set(true);
      detectar();

      expect(leitura()).not.toContain('Cascata de remanejamento');
      controller.match(URL_DA_REGRA);
    });

    it('com o catálogo lido dizendo que a cascata não se aplica, a seção não aparece', () => {
      store.remoteSnapshot.set({
        status: StatusProcesso.rascunho,
      } as unknown as ProcessoSeletivoDto);
      store.patchObjectSection('vagas', {
        ofertas: [distribuicaoFederal([{ id: LB_Q, codigo: 'LB_Q' }])],
      });
      store.remoteSnapshot.set({
        status: StatusProcesso.publicado,
      } as unknown as ProcessoSeletivoDto);
      detectar();

      expect(componente.precisaExibir()).toBe(false);
      expect(leitura()).not.toContain('Cascata de remanejamento');
      // A busca da versão gravada não é o assunto deste teste.
      controller.match(URL_DA_REGRA);
    });

    it('na falha da consulta, diz que a regra gravada não foi confirmada e oferece tentar de novo', () => {
      controller
        .expectOne(URL_DA_REGRA)
        .flush(
          { type: 'about:blank', title: 'Erro', status: 503, traceId: 't' },
          { status: 503, statusText: 'Service Unavailable' },
        );
      detectar();

      expect(store.emConsulta()).toBe(true);
      expect(leitura()).toContain('REMANEJ-CASCATA-LEI-12711 · versão v0');
      expect(leitura()).toContain('Não foi possível confirmar a regra gravada');
      expect(elemento.querySelector('[role="alert"]')).not.toBeNull();
      expect(leitura()).toContain('Tentar novamente');
    });

    it('com a regra fora do catálogo, descreve o que falta sem mandar escolher outra', () => {
      controller
        .expectOne(URL_DA_REGRA)
        .flush(
          { type: 'about:blank', title: 'Não encontrada', status: 404, traceId: 't' },
          { status: 404, statusText: 'Not Found' },
        );
      detectar();

      expect(leitura()).toContain('A regra gravada não foi encontrada no catálogo');
      expect(leitura()).not.toContain('Escolha outra regra');
    });
  });
});
