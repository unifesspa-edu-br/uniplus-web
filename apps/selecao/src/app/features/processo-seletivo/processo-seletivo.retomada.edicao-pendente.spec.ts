import { TestBed } from '@angular/core/testing';
import { okResult } from '@uniplus/shared-core/http';
import { BehaviorSubject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfirmacaoDeSaida } from './wizard/shared/rascunho-nao-gravado.guard';
import { RascunhoDaPublicacao } from './editor/rascunho-da-publicacao.service';
import {
  PROCESSO_ID,
  OUTRO_ID,
  MONTAGEM_LENTA,
  detalhe,
  rascunhoGuardado,
  montar,
  propagar,
} from './processo-seletivo.retomada.testing';

describe(
  'ProcessoSeletivoPage — edição por gravar do rascunho da publicação',
  MONTAGEM_LENTA,
  () => {
    beforeEach(() => TestBed.resetTestingModule());

    /** Reposto do servidor não é edição pendente — a guarda de saída não pode disparar aí. */
    it('o bloco reposto não conta como edição por gravar', async () => {
      const cenario = montar({
        obterRascunho: rascunhoGuardado({
          numero: '07/2027',
          periodoInscricaoInicio: '',
          periodoInscricaoFim: '',
          ato: {
            orgao: 'REITORIA',
            serie: '',
            ano: '',
            dataDoAto: '',
            assinante: '',
            tipoAtoCodigo: '',
          },
        }),
      });
      await propagar();

      expect(cenario.componente.rascunhoPendente()).toBe(false);

      cenario.store.projetarSecao('publicacao', { numero: '08/2027' });
      expect(cenario.componente.rascunhoPendente()).toBe(true);
    });

    /**
     * Apagar o que estava guardado é edição como qualquer outra. Tratar o bloco vazio como
     * "nada a guardar" deixava o apagamento sair sem aviso, e a volta ao processo repunha do
     * servidor exatamente o que o operador tinha acabado de limpar.
     */
    it('esvaziar um rascunho já gravado conta como edição por gravar', async () => {
      const cenario = montar({
        obterRascunho: rascunhoGuardado({
          numero: '07/2027',
          periodoInscricaoInicio: '',
          periodoInscricaoFim: '',
          ato: {
            orgao: 'REITORIA',
            serie: '',
            ano: '',
            dataDoAto: '',
            assinante: '',
            tipoAtoCodigo: '',
          },
        }),
      });
      await propagar();
      expect(cenario.componente.rascunhoPendente()).toBe(false);

      cenario.store.projetarSecao('publicacao', {
        numero: '',
        ato: { orgao: '', serie: '', ano: '', dataDoAto: '', assinante: '', tipoAtoCodigo: '' },
      });

      expect(cenario.componente.rascunhoPendente()).toBe(true);
    });

    /**
     * Mudar só o `:id` reusa a rota: o componente nunca é desativado, e a guarda da rota não
     * roda. Sem perguntar no próprio editor, a promessa dela valia para sair da tela e não para
     * trocar de processo — e é a retomada quem apaga a transcrição, logo em seguida.
     */
    it('pergunta antes de trocar de processo com transcrição por gravar', async () => {
      const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
        get: () => PROCESSO_ID,
      });
      const cenario = montar({
        id: PROCESSO_ID,
        obter: vi.fn((id: string) => of(okResult(detalhe({ id })))),
        paramMap,
      });
      await propagar();

      cenario.store.projetarSecao('publicacao', { numero: '07/2027' });
      expect(cenario.componente.rascunhoPendente(), 'pré-condição: há o que perder').toBe(true);

      const confirmacao = TestBed.inject(ConfirmacaoDeSaida);
      const perguntar = vi.spyOn(confirmacao, 'confirmar').mockReturnValue(false);

      paramMap.next({ get: () => OUTRO_ID });
      await propagar();

      expect(perguntar).toHaveBeenCalled();
      expect(cenario.store.processoSeletivoId(), 'a troca foi recusada').toBe(PROCESSO_ID);
      expect(cenario.store.draft().publicacao.numero, 'a transcrição ficou').toBe('07/2027');
      expect(cenario.navigate).toHaveBeenCalledWith(['/processo-seletivo', PROCESSO_ID], {
        replaceUrl: true,
      });
    });

    /**
     * Recusada a troca a partir do cadastro novo, não há processo aberto para onde voltar — o
     * endereço precisa voltar a `/novo`. Deixá-lo no `:id` recusado punha o cadastro em andamento
     * sob o endereço de outro processo, e a criação seguinte não corrigiria a URL: o efeito que a
     * ajusta desiste quando ela já traz um id.
     */
    it('devolve o endereço a /novo quando a troca é recusada sem processo aberto', async () => {
      const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
        get: () => null,
      });
      const cenario = montar({ id: null, paramMap });
      await propagar();

      cenario.store.projetarSecao('publicacao', { numero: '07/2027' });
      expect(cenario.componente.rascunhoPendente(), 'pré-condição: há o que perder').toBe(true);
      vi.spyOn(TestBed.inject(ConfirmacaoDeSaida), 'confirmar').mockReturnValue(false);

      paramMap.next({ get: () => PROCESSO_ID });
      await propagar();

      expect(cenario.navigate).toHaveBeenCalledWith(['/processo-seletivo', 'novo'], {
        replaceUrl: true,
      });
      expect(cenario.store.draft().publicacao.numero).toBe('07/2027');
    });

    /** Aceita a perda, a troca segue: quem confirmou sabe o que está deixando para trás. */
    it('troca de processo quando a perda da transcrição é confirmada', async () => {
      const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
        get: () => PROCESSO_ID,
      });
      const cenario = montar({
        id: PROCESSO_ID,
        obter: vi.fn((id: string) => of(okResult(detalhe({ id })))),
        paramMap,
      });
      await propagar();

      cenario.store.projetarSecao('publicacao', { numero: '07/2027' });
      vi.spyOn(TestBed.inject(ConfirmacaoDeSaida), 'confirmar').mockReturnValue(true);

      paramMap.next({ get: () => OUTRO_ID });
      await propagar();
      await propagar();

      expect(cenario.store.processoSeletivoId()).toBe(OUTRO_ID);
    });

    /**
     * Depois de publicar, o servidor apagou o rascunho e o que sobra em tela é a declaração que
     * virou publicação. Zerar a referência fazia a guarda de saída ler esses campos como
     * transcrição por gravar, e avisar de perda a quem acabou de publicar.
     */
    it('não avisa de edição pendente quem acabou de publicar', async () => {
      const cenario = montar({ obterRascunho: rascunhoGuardado({ ato: { orgao: 'REITORIA' } }) });
      await propagar();

      cenario.store.projetarSecao('publicacao', {
        numero: '07/2027',
        ato: {
          orgao: 'REITORIA',
          serie: 'EDITAL',
          ano: '2027',
          dataDoAto: '2027-01-15',
          assinante: 'Reitor',
          tipoAtoCodigo: 'EDITAL_ABERTURA',
        },
      });
      expect(cenario.componente.rascunhoPendente(), 'pré-condição: há transcrição por gravar').toBe(
        true,
      );

      cenario.fixture.debugElement.injector.get(RascunhoDaPublicacao).fixarComoJaGravado();

      expect(cenario.componente.rascunhoPendente()).toBe(false);
    });
  },
);
