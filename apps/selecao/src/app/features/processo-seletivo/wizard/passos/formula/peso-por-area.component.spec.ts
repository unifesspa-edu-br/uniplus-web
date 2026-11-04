import { StatusProcesso } from '@uniplus/shared-data/selecao';
import { afterEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';

import {
  Montagem,
  OUTRA_RESOLUCAO,
  QUADRO_CONGELADO,
  RESOLUCAO,
  SELETOR_RESOLUCAO,
  montarSecao,
  catalogos,
  encerrarMontagem,
  escolherNoSeletor,
  falharPesos,
  marcarEnemComMediaPonderada,
  pedidosDoCadastro,
  processoGravadoCom,
  rascunhoComResolucao,
  resolucaoEmConsulta,
  responderAreas,
  responderPesos,
  seletor,
  texto,
} from './peso-por-area.testing';
describe('PesoPorAreaComponent', () => {
  afterEach(encerrarMontagem);

  describe('quando aparece e quando o cadastro é lido', () => {
    it('com ENEM e média ponderada, revela a escolha com as resoluções do cadastro', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);

      const opcoes = Array.from(
        m.el.querySelectorAll(`${SELETOR_RESOLUCAO} option`) as NodeListOf<HTMLOptionElement>,
      );
      expect(opcoes.map((opcao) => texto(opcao))).toEqual([
        '— escolher —',
        OUTRA_RESOLUCAO,
        RESOLUCAO,
      ]);
    });
  });

  describe('seletor mostra a escolha do rascunho', () => {
    it('ao reabrir o processo, o seletor mostra a resolução hidratada', async () => {
      const m = await montarSecao({ antesDeMontar: rascunhoComResolucao(RESOLUCAO) });
      responderPesos(m);

      expect(seletor(m).value).toBe(RESOLUCAO);
    });

    it('a seção recriada com a resolução no rascunho mostra a escolha', async () => {
      const m = await montarSecao({ antesDeMontar: rascunhoComResolucao(RESOLUCAO) });
      responderPesos(m);

      m.store.patchObjectSection('classificacao', { baseadoEmEnem: false });
      m.fixture.detectChanges();
      m.store.patchObjectSection('classificacao', { baseadoEmEnem: true });
      m.fixture.detectChanges();

      expect(seletor(m).value).toBe(RESOLUCAO);
    });
  });

  describe('resolução fora do cadastro', () => {
    it('só marca "fora do cadastro" depois de o cadastro ter sido lido', async () => {
      const m = await montarSecao({ antesDeMontar: rascunhoComResolucao('Resolução revogada') });

      const enquantoCarrega = Array.from(
        m.el.querySelectorAll(`${SELETOR_RESOLUCAO} option`) as NodeListOf<HTMLOptionElement>,
      ).map(texto);
      expect(enquantoCarrega).toContain('Resolução revogada');
      expect(enquantoCarrega.join(' ')).not.toContain('fora do cadastro');

      falharPesos(m);
      const depoisDaFalha = Array.from(
        m.el.querySelectorAll(`${SELETOR_RESOLUCAO} option`) as NodeListOf<HTMLOptionElement>,
      ).map(texto);
      expect(depoisDaFalha.join(' ')).not.toContain('fora do cadastro');
    });
  });

  describe('troca de processo', () => {
    /** O que a página faz ao abrir outro processo: limpa o editor, e a leitura dele chega. */
    function abrirOutroProcesso(
      m: Montagem,
      antesDeHidratar: (store: ProcessoSeletivoStore) => void,
    ) {
      m.store.reset();
      catalogos().esquecerPesosAreaEnem();
      antesDeHidratar(m.store);
      m.fixture.detectChanges();
    }

    it('criar o processo (o id nasce) mantém a lista lida e a prévia', async () => {
      const m = await montarSecao({ antesDeMontar: rascunhoComResolucao(RESOLUCAO) });
      responderPesos(m);

      m.store.processoSeletivoId.set('processo-criado');
      m.fixture.detectChanges();

      expect(pedidosDoCadastro(m)).toHaveLength(0);
      const opcoes = Array.from(
        m.el.querySelectorAll(`${SELETOR_RESOLUCAO} option`) as NodeListOf<HTMLOptionElement>,
      ).map(texto);
      expect(opcoes).toContain(RESOLUCAO);
      expect(texto(m.el.querySelector('caption'))).toContain('Prévia');
    });

    it('outro processo aberto por hidratação relê o cadastro', async () => {
      const m = await montarSecao({
        antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO),
      });
      responderPesos(m);

      abrirOutroProcesso(m, processoGravadoCom(OUTRA_RESOLUCAO, QUADRO_CONGELADO));

      expect(catalogos().pesosLidosNaMarca()).toBe(-1);
      responderPesos(m);
      expect(catalogos().pesosLidosNaMarca()).toBe(m.store.classificacao.versaoLida());
    });

    it('um processo só para consulta, aberto depois de outro, não herda a lista do anterior', async () => {
      const m = await montarSecao({
        antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO),
      });
      responderPesos(m);
      expect(catalogos().resolucoesPesoAreaEnem()).not.toEqual([]);

      abrirOutroProcesso(
        m,
        processoGravadoCom(OUTRA_RESOLUCAO, QUADRO_CONGELADO, StatusProcesso.publicado),
      );

      expect(catalogos().resolucoesPesoAreaEnem()).toEqual([]);
      expect(catalogos().pesosLidosNaMarca()).toBe(-1);
      expect(pedidosDoCadastro(m)).toHaveLength(0);
      expect(resolucaoEmConsulta(m)).toBe(OUTRA_RESOLUCAO);
    });
  });

  describe('processo que não aceita edição', () => {
    it('não lê o cadastro, lê a resolução como texto e mostra a cópia congelada', async () => {
      const m = await montarSecao({
        antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO, StatusProcesso.publicado),
      });
      responderAreas(m);

      expect(pedidosDoCadastro(m)).toHaveLength(0);
      expect(m.el.querySelector('select, input, button')).toBeNull();
      expect(resolucaoEmConsulta(m)).toBe(RESOLUCAO);
      expect(texto(m.el)).not.toContain('fora do cadastro');
      expect(texto(m.el.querySelector('caption'))).toContain('congelado no processo');
      expect(texto(m.el.querySelector('tbody tr td'))).toBe('Peso 9 corte 700');
    });

    it('publicado nesta sessão, deixa de avisar da próxima gravação', async () => {
      const m = await montarSecao({
        antesDeMontar: processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO),
      });
      responderPesos(m);
      expect(texto(m.el)).toContain('O cadastro de Peso por Área mudou depois');

      processoGravadoCom(RESOLUCAO, QUADRO_CONGELADO, StatusProcesso.publicado)(m.store);
      m.fixture.detectChanges();

      expect(texto(m.el)).not.toContain('O cadastro de Peso por Área mudou depois');
      expect(texto(m.el)).not.toContain('não está no cadastro de Peso por Área lido');
    });

    it('durante uma gravação, não troca a resolução nem apaga a recusa guardada', async () => {
      const m = await montarSecao({
        antesDeMontar: (store) => {
          rascunhoComResolucao(RESOLUCAO)(store);
          store.classificacao.recusaDaResolucaoPesoAreaEnem.set('Recusa anterior.');
        },
      });
      responderPesos(m);
      m.store.salvando.set(true);
      m.fixture.detectChanges();

      escolherNoSeletor(m, OUTRA_RESOLUCAO);

      expect(m.store.draft().classificacao.resolucaoPesoAreaEnem).toBe(RESOLUCAO);
      expect(m.store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBe('Recusa anterior.');
    });
  });

  describe('obrigatoriedade e limpeza', () => {
    it('mostra sob o campo a recusa guardada e só a tira quando a escolha muda de fato', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);
      escolherNoSeletor(m, RESOLUCAO);
      m.store.classificacao.recusaDaResolucaoPesoAreaEnem.set('Recusa do servidor.');
      m.fixture.detectChanges();

      expect(texto(m.el.querySelector('#f-resolucao-peso-area-erro'))).toBe('Recusa do servidor.');

      escolherNoSeletor(m, RESOLUCAO);
      expect(m.store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBe('Recusa do servidor.');

      escolherNoSeletor(m, OUTRA_RESOLUCAO);
      expect(m.store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBeNull();
      expect(m.el.querySelector('#f-resolucao-peso-area-erro')).toBeNull();
    });

    it('mostra sob o campo também a recusa por um critério de desempate, e a tira com a troca de resolução', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);
      escolherNoSeletor(m, RESOLUCAO);
      m.store.classificacao.recusaDaResolucaoPesoAreaEnem.set('Recusa da resolução.');
      m.store.classificacao.recusaPeloDesempatePorArea.set('Recusa pelo desempate.');
      m.fixture.detectChanges();

      // As duas recusas vigentes, e não uma escondendo a outra.
      expect(texto(m.el.querySelector('#f-resolucao-peso-area-erro'))).toBe(
        'Recusa da resolução. Recusa pelo desempate.',
      );

      escolherNoSeletor(m, OUTRA_RESOLUCAO);
      expect(m.store.classificacao.recusaPeloDesempatePorArea()).toBeNull();
    });
  });
});
