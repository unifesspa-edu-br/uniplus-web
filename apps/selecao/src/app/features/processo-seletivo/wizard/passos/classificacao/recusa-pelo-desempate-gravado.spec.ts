import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ValidacaoDoPasso } from '../../processo-seletivo.models';
import { CatalogosDeClassificacao } from './catalogos-de-classificacao.service';

import {
  componente,
  controller,
  lerCadastroComPeso,
  linhaDoCadastro,
  montarEliminacao,
  store,
} from '../eliminacao/eliminacao.testing';
import {
  ErroDeCampoDaRecusa,
  prepararClassificacaoLocalComResolucao,
  recusarGravacao,
} from './recusa-da-gravacao.testing';

describe('recusa por um critério de desempate já gravado', () => {
  montarEliminacao();

  const FORA_DO_QUADRO = 'uniplus.selecao.processo_seletivo.desempate_area_enem_fora_do_quadro';
  const SEM_QUADRO = 'uniplus.selecao.processo_seletivo.desempate_area_enem_sem_quadro';
  const MENSAGEM_FORA_DO_QUADRO =
    'O critério de desempate na ordem 2 cita área que o quadro não tem em todos os grupos: Linguagens.';
  const MENSAGEM_SEM_QUADRO = 'O critério na ordem 1 compara nota de área, e falta o quadro.';
  const TEXTO_GENERICO =
    'O servidor recusou a classificação por um critério de desempate já gravado. Confira o passo Desempate.';

  async function recusar(
    codigo: string,
    errors: readonly ErroDeCampoDaRecusa[],
  ): Promise<ValidacaoDoPasso> {
    prepararClassificacaoLocalComResolucao();
    const gravacao = componente.persistir();
    recusarGravacao({ title: 'Título genérico da raiz.', code: codigo, errors });
    return gravacao;
  }

  it('guarda com a recusa a última leitura do cadastro pedida: só uma pedida depois conta como posterior', async () => {
    lerCadastroComPeso(2);
    const catalogos = TestBed.inject(CatalogosDeClassificacao);
    // Uma leitura pedida antes da recusa e respondida depois dela não é posterior.
    catalogos.recarregarPesosAreaEnem(0);
    const emVoo = controller.expectOne((requisicao) =>
      requisicao.url.endsWith('/api/configuracao/pesos-area-enem'),
    );

    await recusar(FORA_DO_QUADRO, [
      { field: 'resolucaoPesoAreaEnem', code: FORA_DO_QUADRO, message: 'Critério 1.' },
    ]);
    emVoo.flush([linhaDoCadastro(2)]);

    expect(store.classificacao.leituraDoCadastroNaRecusaPeloDesempate()).toBe(2);
    expect(catalogos.pesosLidosNaLeitura()).toBe(2);
  });

  it('no campo da resolução, mostra a mensagem da API no resumo e a guarda sob o campo', async () => {
    const resultado = await recusar(FORA_DO_QUADRO, [
      { field: 'resolucaoPesoAreaEnem', code: FORA_DO_QUADRO, message: MENSAGEM_FORA_DO_QUADRO },
    ]);

    expect(resultado.messages).toEqual([MENSAGEM_FORA_DO_QUADRO]);
    // Guardada à parte da recusa da resolução, e mostrada sob o mesmo campo.
    expect(store.classificacao.recusaPeloDesempatePorArea()).toBe(MENSAGEM_FORA_DO_QUADRO);
    expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBeNull();
  });

  it('a resposta nova pelo desempate substitui a recusa antiga da resolução', async () => {
    store.classificacao.recusaDaResolucaoPesoAreaEnem.set('Recusa antiga da resolução.');

    await recusar(FORA_DO_QUADRO, [
      { field: 'resolucaoPesoAreaEnem', code: FORA_DO_QUADRO, message: MENSAGEM_FORA_DO_QUADRO },
    ]);

    expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBeNull();
    expect(store.classificacao.recusaPeloDesempatePorArea()).toBe(MENSAGEM_FORA_DO_QUADRO);
  });

  it('sem quadro no campo da resolução, mostra a mensagem da API', async () => {
    const resultado = await recusar(SEM_QUADRO, [
      { field: 'resolucaoPesoAreaEnem', code: SEM_QUADRO, message: MENSAGEM_SEM_QUADRO },
    ]);

    expect(resultado.messages).toEqual([MENSAGEM_SEM_QUADRO]);
  });

  it.each(['redação nova, sem maiúscula nem ponto', 'Outra redação, com ponto final.'])(
    'mostra a redação da API sem alterar a letra inicial nem a pontuação: %s',
    async (mensagem) => {
      const resultado = await recusar(FORA_DO_QUADRO, [
        { field: 'resolucaoPesoAreaEnem', code: FORA_DO_QUADRO, message: mensagem },
      ]);

      expect(resultado.messages).toEqual([mensagem]);
      expect(store.classificacao.recusaPeloDesempatePorArea()).toBe(mensagem);
    },
  );

  it('sem mensagem, mostra o texto genérico no resumo e sob o campo', async () => {
    const resultado = await recusar(FORA_DO_QUADRO, [
      { field: 'resolucaoPesoAreaEnem', code: FORA_DO_QUADRO, message: '' },
    ]);

    expect(resultado.messages).toEqual([TEXTO_GENERICO]);
    expect(store.classificacao.recusaPeloDesempatePorArea()).toBe(TEXTO_GENERICO);
  });

  it('noutro campo, mostra a mensagem da API, sem o título genérico', async () => {
    const resultado = await recusar(SEM_QUADRO, [
      { field: 'baseadoEmEnem', code: SEM_QUADRO, message: MENSAGEM_SEM_QUADRO },
    ]);

    expect(resultado.messages).toEqual([MENSAGEM_SEM_QUADRO]);
    expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBeNull();
  });

  it('sem causa de campo, só a raiz, mostra o texto genérico e não o título da raiz', async () => {
    const resultado = await recusar(SEM_QUADRO, []);

    expect(resultado.messages).toEqual([TEXTO_GENERICO]);
  });

  it.each(['baseadoEmEnem', 'regraCalculoCodigo'])(
    'apontando o campo %s, guarda a mensagem da API também para o passo Fórmula',
    async (campo) => {
      await recusar(SEM_QUADRO, [{ field: campo, code: SEM_QUADRO, message: MENSAGEM_SEM_QUADRO }]);

      expect(store.classificacao.recusaPeloDesempatePorArea()).toBe(MENSAGEM_SEM_QUADRO);
    },
  );

  it('no campo da regra de cálculo e sem mensagem, mostra o texto genérico do desempate', async () => {
    const resultado = await recusar(SEM_QUADRO, [
      { field: 'regraCalculoCodigo', code: SEM_QUADRO, message: '' },
    ]);

    expect(resultado.messages).toEqual([TEXTO_GENERICO]);
    expect(store.classificacao.recusaPeloDesempatePorArea()).toBe(TEXTO_GENERICO);
  });

  it('com outro erro junto, mantém o título da raiz para ele', async () => {
    const resultado = await recusar(SEM_QUADRO, [
      { field: 'baseadoEmEnem', code: SEM_QUADRO, message: MENSAGEM_SEM_QUADRO },
      { field: 'nomeDoProcesso', code: 'outro', message: 'Outro.' },
    ]);

    expect(resultado.messages).toEqual([MENSAGEM_SEM_QUADRO, 'Título genérico da raiz.']);
  });

  describe('cada recusa só muda com a resposta que a julgou', () => {
    const INCOMPLETA =
      'uniplus.selecao.configuracao_classificacao.resolucao_peso_area_enem_incompleta';

    async function recusarComAnteriores(errors: readonly ErroDeCampoDaRecusa[]) {
      store.classificacao.recusaDaResolucaoPesoAreaEnem.set('Da resolução, anterior.');
      store.classificacao.recusaPeloDesempatePorArea.set('Do desempate, anterior.');
      return recusar(FORA_DO_QUADRO, errors);
    }

    it.each(['baseadoEmEnem', 'regraCalculoCodigo'])(
      '"sem quadro" em %s: a recusa anterior da resolução fica',
      async (campo) => {
        await recusarComAnteriores([
          { field: campo, code: SEM_QUADRO, message: MENSAGEM_SEM_QUADRO },
        ]);

        expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBe('Da resolução, anterior.');
        expect(store.classificacao.recusaPeloDesempatePorArea()).toBe(MENSAGEM_SEM_QUADRO);
      },
    );

    it('causa da resolução sem desempate: a recusa anterior do desempate fica', async () => {
      await recusarComAnteriores([
        { field: 'resolucaoPesoAreaEnem', code: INCOMPLETA, message: 'Resolução incompleta.' },
      ]);

      expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBe('Resolução incompleta.');
      expect(store.classificacao.recusaPeloDesempatePorArea()).toBe('Do desempate, anterior.');
    });

    it('causa só em outro campo: as duas ficam', async () => {
      await recusarComAnteriores([{ field: 'nomeDoProcesso', code: 'outro', message: 'Outro.' }]);

      expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBe('Da resolução, anterior.');
      expect(store.classificacao.recusaPeloDesempatePorArea()).toBe('Do desempate, anterior.');
    });

    it('só causas de desempate no campo da resolução: a recusa da resolução sai', async () => {
      await recusarComAnteriores([
        { field: 'resolucaoPesoAreaEnem', code: FORA_DO_QUADRO, message: MENSAGEM_FORA_DO_QUADRO },
      ]);

      expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBeNull();
    });

    it('"sem quadro" nos dois campos: a mensagem aparece uma vez no resumo', async () => {
      const resultado = await recusar(SEM_QUADRO, [
        { field: 'baseadoEmEnem', code: SEM_QUADRO, message: MENSAGEM_SEM_QUADRO },
        { field: 'regraCalculoCodigo', code: SEM_QUADRO, message: MENSAGEM_SEM_QUADRO },
      ]);

      expect(resultado.messages).toEqual([MENSAGEM_SEM_QUADRO]);
      expect(store.classificacao.recusaPeloDesempatePorArea()).toBe(MENSAGEM_SEM_QUADRO);
    });

    it('dois critérios recusados juntam as duas mensagens no passo Fórmula', async () => {
      await recusar(FORA_DO_QUADRO, [
        { field: 'baseadoEmEnem', code: SEM_QUADRO, message: 'Critério da ordem 1.' },
        { field: 'resolucaoPesoAreaEnem', code: FORA_DO_QUADRO, message: 'Critério da ordem 2.' },
      ]);

      expect(store.classificacao.recusaPeloDesempatePorArea()).toBe(
        'Critério da ordem 1. Critério da ordem 2.',
      );
    });

    it('desempate no campo da escala e causa própria da escala: cada texto explica a sua', async () => {
      const resultado = await recusar(FORA_DO_QUADRO, [
        { field: 'escalaNotaFinal', code: SEM_QUADRO, message: MENSAGEM_SEM_QUADRO },
        { field: 'escalaNotaFinal', code: 'outra', message: 'Mensagem inventada da escala.' },
      ]);

      expect(resultado.messages).toEqual([
        MENSAGEM_SEM_QUADRO,
        expect.stringContaining('Mensagem inventada da escala.'),
      ]);
      expect(store.classificacao.recusaDaEscalaDaNotaFinal()).toBe('Mensagem inventada da escala.');
      expect(store.classificacao.recusaPeloDesempatePorArea()).toBe(MENSAGEM_SEM_QUADRO);
    });
  });
});
