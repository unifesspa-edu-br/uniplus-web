import { TestBed } from '@angular/core/testing';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';

import { NOME_DO_PASSO_DA_FORMULA } from '../../processo-seletivo.data';
import { CatalogosDeClassificacao } from './catalogos-de-classificacao.service';

import {
  PROCESSO_ID,
  ROTA_CLASSIFICACAO,
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
const CODIGO_CASAS_OBRIGATORIAS =
  'uniplus.selecao.configuracao_classificacao.casas_arredondamento_obrigatorio';
const RECUSA_DAS_CASAS = {
  field: 'casasArredondamento',
  code: CODIGO_CASAS_OBRIGATORIAS,
  message: 'As casas decimais de arredondamento são obrigatórias.',
};
const TEXTO_DA_RESOLUCAO_INCOMPLETA =
  'A resolução escolhida não tem pesos cadastrados para todos os grupos de área. Complete-a no cadastro de Peso por Área ou escolha outra.';

describe('recusa da resolução de Peso por Área na gravação da classificação', () => {
  montarEliminacao();

  it('guarda a recusa do servidor à resolução para o passo Fórmula e a nomeia no resumo', async () => {
    prepararClassificacaoLocalComResolucao();

    const gravacao = componente.persistir();
    recusarGravacao({
      // A raiz traz como título o do primeiro erro de campo — o mesmo da resolução.
      title: 'A resolução de Pesos por Área não tem pesos para todos os grupos de área',
      code: CODIGO_INCOMPLETA,
      errors: [
        {
          field: 'resolucaoPesoAreaEnem',
          code: CODIGO_INCOMPLETA,
          message: 'A resolução não tem o grupo Saúde e Biológicas.',
        },
      ],
    });

    const resultado = await gravacao;
    expect(resultado.valid).toBe(false);
    // O texto é o da tela para o código, e não o `message` que o servidor mandou — e a falha
    // aparece uma vez só, sem o título da raiz, que diria o mesmo.
    expect(resultado.messages).toEqual([
      `Resolução de Peso por Área, no passo ${NOME_DO_PASSO_DA_FORMULA}: ${TEXTO_DA_RESOLUCAO_INCOMPLETA}`,
    ]);
    expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBe(TEXTO_DA_RESOLUCAO_INCOMPLETA);
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
      errors: [RECUSA_DAS_CASAS],
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
        { field: 'resolucaoPesoAreaEnem', code: CODIGO_INCOMPLETA, message: 'x' },
        RECUSA_DAS_CASAS,
      ],
    });

    const resultado = await gravacao;
    expect(resultado.messages).toEqual([
      `Resolução de Peso por Área, no passo ${NOME_DO_PASSO_DA_FORMULA}: ${TEXTO_DA_RESOLUCAO_INCOMPLETA}`,
      'A classificação tem campos a corrigir.',
    ]);
  });

  it('usa um texto genérico para a recusa de código que a tela não conhece', async () => {
    prepararClassificacaoLocalComResolucao();

    const gravacao = componente.persistir();
    recusarGravacao({
      title: 'A requisição tem campos inválidos.',
      code: 'uniplus.selecao.validacao',
      errors: [
        { field: 'resolucaoPesoAreaEnem', code: 'uniplus.selecao.codigo_novo', message: 'x' },
      ],
    });

    await gravacao;
    expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBe(
      'O servidor recusou a resolução de Peso por Área escolhida. Confira o cadastro de Peso por Área ou escolha outra.',
    );
  });

  it('mantém a recusa guardada quando a falha seguinte não julgou a resolução', async () => {
    prepararClassificacaoLocal();
    store.classificacao.recusaDaResolucaoPesoAreaEnem.set('Recusa anterior.');

    const gravacao = componente.persistir();
    falharPorRede(ROTA_CLASSIFICACAO);
    await aguardarReleitura();
    controller.expectOne(ROTA_DETALHE).flush({ id: PROCESSO_ID, classificacao: null });

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
