import { TestBed } from '@angular/core/testing';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';

import { NOME_DO_PASSO_DA_FORMULA } from '../../processo-seletivo.data';
import { CatalogosDeClassificacao } from './catalogos-de-classificacao.service';

import {
  detalheSemClassificacao,
  ROTA_CLASSIFICACAO,
  RESOLUCAO,
  ROTA_DETALHE,
  aguardarReleitura,
  componente,
  controller,
  montarEliminacao,
  prepararClassificacaoLocal,
  store,
} from '../eliminacao/eliminacao.testing';
import {
  aceitarGravacao,
  falharPorRede,
  prepararClassificacaoLocalComResolucao,
  recusarGravacao,
} from './recusa-da-gravacao.testing';

const CODIGO_INCOMPLETA =
  'uniplus.selecao.configuracao_classificacao.resolucao_peso_area_enem_incompleta';
const RECUSA_DE_OUTRO_CAMPO = {
  field: 'nomeDoProcesso',
  code: 'uniplus.selecao.processo_seletivo.nome_invalido',
  message: 'O nome do processo é inválido.',
};
const MENSAGEM_DA_API = 'Falta o grupo Saúde e Biológicas na resolução escolhida';
const ROTULO_DO_PASSO = `Resolução de Peso por Área, no passo ${NOME_DO_PASSO_DA_FORMULA}`;
const TEXTO_GENERICO =
  'O servidor recusou a resolução de Peso por Área escolhida. Confira o cadastro de Peso por Área ou escolha outra.';

describe('recusa da resolução de Peso por Área na gravação da classificação', () => {
  montarEliminacao();

  it('guarda a recusa do servidor à resolução para o passo Fórmula e a nomeia no resumo', async () => {
    prepararClassificacaoLocalComResolucao();

    const gravacao = componente.persistir();
    recusarGravacao({
      // A raiz traz como título o do primeiro erro de campo — o mesmo da resolução.
      title: MENSAGEM_DA_API,
      code: CODIGO_INCOMPLETA,
      errors: [
        { field: 'resolucaoPesoAreaEnem', code: CODIGO_INCOMPLETA, message: MENSAGEM_DA_API },
      ],
    });

    const resultado = await gravacao;
    expect(resultado.valid).toBe(false);
    // O texto é o `message` do servidor, como veio — e a falha aparece uma vez só, sem o título da
    // raiz, que diria o mesmo.
    expect(resultado.messages).toEqual([`${ROTULO_DO_PASSO}: ${MENSAGEM_DA_API}`]);
    expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBe(MENSAGEM_DA_API);
  });

  it.each([
    'a redação nova, sem letra maiúscula nem ponto final',
    'Outra redação, com ponto final.',
  ])(
    'mostra a redação da API sem alterar a letra inicial nem a pontuação: %s',
    async (mensagem) => {
      prepararClassificacaoLocalComResolucao();

      const gravacao = componente.persistir();
      recusarGravacao({
        title: 'Recusada.',
        code: CODIGO_INCOMPLETA,
        errors: [{ field: 'resolucaoPesoAreaEnem', code: CODIGO_INCOMPLETA, message: mensagem }],
      });

      expect((await gravacao).messages).toEqual([`${ROTULO_DO_PASSO}: ${mensagem}`]);
      expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBe(mensagem);
    },
  );

  it('uma recusa da resolução e outra da eliminação na mesma gravação mostram cada mensagem', async () => {
    prepararClassificacaoLocalComResolucao();

    const gravacao = componente.persistir();
    recusarGravacao({
      title: 'Recusada.',
      code: 'uniplus.selecao.validacao',
      errors: [
        {
          field: 'resolucaoPesoAreaEnem',
          code: CODIGO_INCOMPLETA,
          message: 'Mensagem inventada da resolução',
        },
        {
          field: 'regrasEliminacao[0].areaCodigo',
          code: 'uniplus.selecao.configuracao_classificacao.corte_em_area_repetido',
          message: 'Mensagem inventada do corte',
        },
      ],
    });

    expect((await gravacao).messages).toEqual([
      `${ROTULO_DO_PASSO}: Mensagem inventada da resolução`,
      'Regra de eliminação 1: Mensagem inventada do corte',
    ]);
  });

  it('a recusa da resolução sem mensagem da API usa o texto genérico, sem valor digitado', async () => {
    prepararClassificacaoLocalComResolucao();

    const gravacao = componente.persistir();
    recusarGravacao({
      title: 'Recusada.',
      code: 'uniplus.selecao.validacao',
      errors: [{ field: 'resolucaoPesoAreaEnem', code: CODIGO_INCOMPLETA, message: '  ' }],
    });

    expect((await gravacao).messages).toEqual([`${ROTULO_DO_PASSO}: ${TEXTO_GENERICO}`]);
    expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).not.toContain(RESOLUCAO);
  });

  it('recusas iguais da resolução aparecem uma vez só no resumo', async () => {
    prepararClassificacaoLocalComResolucao();
    const recusa = {
      field: 'resolucaoPesoAreaEnem',
      code: 'uniplus.selecao.configuracao_classificacao.resolucao_peso_area_enem_invalida',
      message: 'x',
    };

    const gravacao = componente.persistir();
    recusarGravacao({
      title: 'Resolução inválida.',
      code: recusa.code,
      errors: [recusa, { ...recusa, field: '$.resolucaoPesoAreaEnem' }],
    });

    const resultado = await gravacao;
    expect(resultado.messages).toHaveLength(1);
  });

  it('uma recusa que não traz erro da resolução mantém a recusa guardada dela', async () => {
    prepararClassificacaoLocal();
    store.classificacao.recusaDaResolucaoPesoAreaEnem.set('Recusa anterior.');

    const gravacao = componente.persistir();
    recusarGravacao({
      title: 'Campos inválidos.',
      code: 'uniplus.selecao.validacao',
      errors: [RECUSA_DE_OUTRO_CAMPO],
    });

    const resultado = await gravacao;
    expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBe('Recusa anterior.');
    expect(resultado.messages).toEqual(['Campos inválidos.']);
  });

  it('com a recusa da resolução, avisa também da recusa em outro campo pelo título traduzido', async () => {
    prepararClassificacaoLocalComResolucao();
    TestBed.inject(ProblemI18nService).register('uniplus.selecao.validacao', {
      title: 'A classificação tem campos a corrigir.',
    });

    const gravacao = componente.persistir();
    recusarGravacao({
      title: 'Campos inválidos.',
      code: 'uniplus.selecao.validacao',
      errors: [
        { field: 'resolucaoPesoAreaEnem', code: CODIGO_INCOMPLETA, message: MENSAGEM_DA_API },
        RECUSA_DE_OUTRO_CAMPO,
      ],
    });

    const resultado = await gravacao;
    expect(resultado.messages).toEqual([
      `${ROTULO_DO_PASSO}: ${MENSAGEM_DA_API}`,
      'A classificação tem campos a corrigir.',
    ]);
  });

  it('mostra a mensagem da API também para um código que a tela não conhece', async () => {
    prepararClassificacaoLocalComResolucao();

    const gravacao = componente.persistir();
    recusarGravacao({
      title: 'A requisição tem campos inválidos.',
      code: 'uniplus.selecao.validacao',
      errors: [
        {
          field: 'resolucaoPesoAreaEnem',
          code: 'uniplus.selecao.codigo_novo',
          message: MENSAGEM_DA_API,
        },
      ],
    });

    await gravacao;
    expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBe(MENSAGEM_DA_API);
  });

  it('a orientação antes de enviar não chama a API', async () => {
    prepararClassificacaoLocalComResolucao();
    store.patchObjectSection('classificacao', { resolucaoPesoAreaEnem: '' });

    const resultado = componente.validar();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.join(' ')).toContain(
      'Selecione a resolução de Peso por Área usada na nota',
    );
    controller.expectNone(ROTA_CLASSIFICACAO);
  });

  it('mantém a recusa guardada quando a falha seguinte não julgou a resolução', async () => {
    prepararClassificacaoLocal();
    store.classificacao.recusaDaResolucaoPesoAreaEnem.set('Recusa anterior.');

    const gravacao = componente.persistir();
    falharPorRede(ROTA_CLASSIFICACAO);
    await aguardarReleitura();
    controller.expectOne(ROTA_DETALHE).flush(detalheSemClassificacao());

    const resultado = await gravacao;
    expect(resultado.valid).toBe(false);
    expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBe('Recusa anterior.');
  });

  it('não grava a resolução que o cadastro lido já não tem', async () => {
    TestBed.inject(CatalogosDeClassificacao).garantirPesosAreaEnem(0);
    controller
      .expectOne((requisicao) => requisicao.url.endsWith('/api/configuracao/pesos-area-enem'))
      .flush([]);
    controller
      .expectOne((requisicao) => requisicao.url.endsWith('/api/configuracao/pesos-area-enem/areas'))
      .flush([]);
    prepararClassificacaoLocalComResolucao();

    const gravacao = componente.persistir();
    // Responde o que tiver saído, para o teste falhar pela asserção e não por espera.
    const pedidos = controller.match(ROTA_CLASSIFICACAO);
    for (const pedido of pedidos) pedido.flush(null, { status: 204, statusText: 'No Content' });
    const resultado = await gravacao;

    expect(pedidos).toHaveLength(0);
    expect(resultado.valid).toBe(false);
    expect(resultado.messages).toContain(
      `A resolução de Peso por Área escolhida não está no cadastro lido. Se ela foi criada ou corrigida agora, use "Atualizar lista" no passo ${NOME_DO_PASSO_DA_FORMULA}; senão, escolha outra.`,
    );
  });

  it('limpa a recusa guardada quando a gravação seguinte dá certo', async () => {
    prepararClassificacaoLocal();
    store.classificacao.recusaDaResolucaoPesoAreaEnem.set('Recusa antiga.');

    const gravacao = componente.persistir();
    aceitarGravacao();

    await expect(gravacao).resolves.toEqual({ valid: true });
    expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBeNull();
  });
});
