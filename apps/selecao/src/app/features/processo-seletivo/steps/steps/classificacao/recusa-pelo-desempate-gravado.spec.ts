import { TestBed } from '@angular/core/testing';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';

import { ValidacaoDoPasso } from '../../processo-seletivo.models';
import { CatalogosDeClassificacao } from '../classificacao/catalogos-de-classificacao.service';

import {
  PROCESSO_ID,
  RESOLUCAO,
  ROTA_CLASSIFICACAO,
  ROTA_DETALHE,
  aguardarReleitura,
  componente,
  controller,
  lerCadastroComPeso,
  linhaDoCadastro,
  montarEliminacao,
  prepararClassificacaoLocal,
  store,
} from '../eliminacao/eliminacao.testing';

describe('recusa por um critério de desempate já gravado', () => {
  montarEliminacao();

  describe('recusa por um critério de desempate já gravado', () => {
    const FORA_DO_QUADRO = 'uniplus.selecao.processo_seletivo.desempate_area_enem_fora_do_quadro';
    const SEM_QUADRO = 'uniplus.selecao.processo_seletivo.desempate_area_enem_sem_quadro';
    const TEXTO_FORA_DO_QUADRO =
      'Um critério de desempate gravado cita área do ENEM que a resolução escolhida não tem em todos os grupos. No passo Desempate, retire a área — ou, se nenhuma área do critério sobrar, troque a regra dele ou remova-o — e grave o passo; ou escolha outra resolução.';
    const TEXTO_SEM_QUADRO =
      'Um critério de desempate gravado compara a nota de área do ENEM, que só existe com a classificação baseada no ENEM pela média ponderada. Troque a regra do critério ou remova-o no passo Desempate e grave o passo, ou marque o ENEM e a média ponderada no passo Fórmula.';
    const TEXTO_SEM_QUADRO_NA_RESOLUCAO =
      'Um critério de desempate gravado compara a nota de área do ENEM, que exige o quadro da resolução de Peso por Área. Troque a regra do critério no passo Desempate e grave o passo, ou escolha a resolução no passo Fórmula.';

    async function recusar(
      codigo: string,
      errors: readonly { field: string; code: string; message: string }[],
    ): Promise<ValidacaoDoPasso> {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });
      const gravacao = componente.persistir();
      controller.expectOne(ROTA_CLASSIFICACAO).flush(
        {
          type: 'about:blank',
          title: 'Título genérico da raiz.',
          status: 422,
          code: codigo,
          traceId: 'trace-1',
          errors,
        },
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
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

    it('no campo da resolução, explica com o texto da tela e o guarda sob o campo', async () => {
      const resultado = await recusar(FORA_DO_QUADRO, [
        { field: 'resolucaoPesoAreaEnem', code: FORA_DO_QUADRO, message: 'Critério 1.' },
      ]);

      expect(resultado.messages).toEqual([TEXTO_FORA_DO_QUADRO]);
      // Guardada à parte da recusa da resolução, e mostrada sob o mesmo campo.
      expect(store.classificacao.recusaPeloDesempatePorArea()).toBe(TEXTO_FORA_DO_QUADRO);
      expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBeNull();
    });

    it('a resposta nova pelo desempate substitui a recusa antiga da resolução', async () => {
      store.classificacao.recusaDaResolucaoPesoAreaEnem.set('Recusa antiga da resolução.');

      await recusar(FORA_DO_QUADRO, [
        { field: 'resolucaoPesoAreaEnem', code: FORA_DO_QUADRO, message: 'Critério 1.' },
      ]);

      expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBeNull();
      expect(store.classificacao.recusaPeloDesempatePorArea()).toBe(TEXTO_FORA_DO_QUADRO);
    });

    it('sem quadro no campo da resolução, orienta a escolher a resolução', async () => {
      const resultado = await recusar(SEM_QUADRO, [
        { field: 'resolucaoPesoAreaEnem', code: SEM_QUADRO, message: 'Critério 1.' },
      ]);

      expect(resultado.messages).toEqual([TEXTO_SEM_QUADRO_NA_RESOLUCAO]);
    });

    it('noutro campo, explica com o texto da tela, sem o título genérico', async () => {
      const resultado = await recusar(SEM_QUADRO, [
        { field: 'baseadoEmEnem', code: SEM_QUADRO, message: 'Critério 1.' },
      ]);

      expect(resultado.messages).toEqual([TEXTO_SEM_QUADRO]);
      expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBeNull();
    });

    it('sem campo, explica pelo código da raiz', async () => {
      const resultado = await recusar(SEM_QUADRO, []);

      expect(resultado.messages).toEqual([TEXTO_SEM_QUADRO]);
    });

    it('com outro erro junto, mantém o título da raiz para ele', async () => {
      const resultado = await recusar(SEM_QUADRO, [
        { field: 'baseadoEmEnem', code: SEM_QUADRO, message: 'Critério 1.' },
        { field: 'regraOrdemAlocacaoCodigo', code: 'outro', message: 'Outro.' },
      ]);

      expect(resultado.messages).toEqual([TEXTO_SEM_QUADRO, 'Título genérico da raiz.']);
    });
  });

  it('guarda a recusa do servidor à resolução para o passo Fórmula e a nomeia no resumo', async () => {
    prepararClassificacaoLocal();
    store.patchObjectSection('classificacao', {
      baseadoEmEnem: true,
      resolucaoPesoAreaEnem: RESOLUCAO,
    });

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_CLASSIFICACAO).flush(
      {
        type: 'about:blank',
        // A raiz traz como título o do primeiro erro de campo — o mesmo da resolução.
        title: 'A resolução de Pesos por Área não tem pesos para todos os grupos de área',
        status: 422,
        code: 'uniplus.selecao.configuracao_classificacao.resolucao_peso_area_enem_incompleta',
        traceId: 'trace-1',
        errors: [
          {
            field: 'resolucaoPesoAreaEnem',
            code: 'uniplus.selecao.configuracao_classificacao.resolucao_peso_area_enem_incompleta',
            message: 'A resolução não tem o grupo Saúde e Biológicas.',
          },
        ],
      },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );

    const resultado = await gravacao;
    const esperada =
      'A resolução escolhida não tem pesos cadastrados para todos os grupos de área. Complete-a no cadastro de Peso por Área ou escolha outra.';
    expect(resultado.valid).toBe(false);
    // O texto é o da tela para o código, e não o `message` que o servidor mandou — e a falha
    // aparece uma vez só, sem o título da raiz, que diria o mesmo.
    expect(resultado.messages).toEqual([
      `Resolução de Peso por Área, no passo Fórmula: ${esperada}`,
    ]);
    expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBe(esperada);
  });

  it('a recusa da escala da nota final vai ao campo do passo Fórmula, e a gravação certa a apaga', async () => {
    prepararClassificacaoLocal();
    store.patchObjectSection('classificacao', { escalaNotaFinal: '0' });
    const codigo = 'uniplus.selecao.configuracao_classificacao.escala_nota_final_invalida';

    const recusada = componente.persistir();
    controller.expectOne(ROTA_CLASSIFICACAO).flush(
      {
        type: 'about:blank',
        title: 'Escala inválida.',
        status: 422,
        code: codigo,
        traceId: 'trace-1',
        errors: [
          {
            field: 'escalaNotaFinal',
            code: codigo,
            message: 'A escala deve ser maior que zero.',
          },
        ],
      },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );

    const resultado = await recusada;
    const esperada = 'A escala deve ser maior que zero.';
    expect(resultado.messages).toEqual([`Escala da nota final, no passo Fórmula: ${esperada}`]);
    expect(store.classificacao.recusaDaEscalaDaNotaFinal()).toBe(esperada);

    store.patchObjectSection('classificacao', { escalaNotaFinal: '100' });
    const aceita = componente.persistir();
    controller.expectOne(ROTA_CLASSIFICACAO).flush(null, { status: 204, statusText: 'No Content' });
    await aceita;
    expect(store.classificacao.recusaDaEscalaDaNotaFinal()).toBeNull();
  });

  it('uma recusa que não traz erro da escala mantém a recusa guardada dela', async () => {
    prepararClassificacaoLocal();
    store.classificacao.recusaDaEscalaDaNotaFinal.set('Recusa anterior da escala.');

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_CLASSIFICACAO).flush(
      {
        type: 'about:blank',
        title: 'Campos inválidos.',
        status: 422,
        code: 'uniplus.selecao.validacao',
        traceId: 'trace-1',
        errors: [
          {
            field: 'casasArredondamento',
            code: 'uniplus.selecao.configuracao_classificacao.casas_arredondamento_obrigatorio',
            message: 'As casas decimais de arredondamento são obrigatórias.',
          },
        ],
      },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );

    const resultado = await gravacao;
    expect(store.classificacao.recusaDaEscalaDaNotaFinal()).toBe('Recusa anterior da escala.');
    expect(resultado.messages).toEqual(['Campos inválidos.']);
  });

  it('recusas iguais da resolução aparecem uma vez só no resumo', async () => {
    prepararClassificacaoLocal();
    store.patchObjectSection('classificacao', {
      baseadoEmEnem: true,
      resolucaoPesoAreaEnem: RESOLUCAO,
    });
    const recusa = {
      field: 'resolucaoPesoAreaEnem',
      code: 'uniplus.selecao.configuracao_classificacao.resolucao_peso_area_enem_invalida',
      message: 'x',
    };

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_CLASSIFICACAO).flush(
      {
        type: 'about:blank',
        title: 'Resolução inválida.',
        status: 422,
        code: recusa.code,
        traceId: 'trace-1',
        errors: [recusa, { ...recusa, field: '$.resolucaoPesoAreaEnem' }],
      },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );

    const resultado = await gravacao;
    expect(resultado.messages).toHaveLength(1);
  });

  it('uma recusa que não traz erro da resolução mantém a recusa guardada dela', async () => {
    prepararClassificacaoLocal();
    store.classificacao.recusaDaResolucaoPesoAreaEnem.set('Recusa anterior.');

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_CLASSIFICACAO).flush(
      {
        type: 'about:blank',
        title: 'Campos inválidos.',
        status: 422,
        code: 'uniplus.selecao.validacao',
        traceId: 'trace-1',
        errors: [
          {
            field: 'casasArredondamento',
            code: 'uniplus.selecao.configuracao_classificacao.casas_arredondamento_obrigatorio',
            message: 'As casas decimais de arredondamento são obrigatórias.',
          },
        ],
      },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );

    const resultado = await gravacao;
    expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBe('Recusa anterior.');
    expect(resultado.messages).toEqual(['Campos inválidos.']);
  });

  it('com a recusa da resolução, avisa também da recusa em outro campo pelo título traduzido', async () => {
    prepararClassificacaoLocal();
    store.patchObjectSection('classificacao', {
      baseadoEmEnem: true,
      resolucaoPesoAreaEnem: RESOLUCAO,
    });
    TestBed.inject(ProblemI18nService).register('uniplus.selecao.validacao', {
      title: 'A classificação tem campos a corrigir.',
    });

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_CLASSIFICACAO).flush(
      {
        type: 'about:blank',
        title: 'Campos inválidos.',
        status: 422,
        code: 'uniplus.selecao.validacao',
        traceId: 'trace-1',
        errors: [
          {
            field: 'resolucaoPesoAreaEnem',
            code: 'uniplus.selecao.configuracao_classificacao.resolucao_peso_area_enem_incompleta',
            message: 'x',
          },
          {
            field: 'casasArredondamento',
            code: 'uniplus.selecao.configuracao_classificacao.casas_arredondamento_obrigatorio',
            message: 'As casas decimais de arredondamento são obrigatórias.',
          },
        ],
      },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );

    const resultado = await gravacao;
    expect(resultado.messages).toEqual([
      'Resolução de Peso por Área, no passo Fórmula: A resolução escolhida não tem pesos cadastrados para todos os grupos de área. Complete-a no cadastro de Peso por Área ou escolha outra.',
      'A classificação tem campos a corrigir.',
    ]);
  });

  it('falha inconclusiva, mesmo sem resolução, deixa a classificação gravada desconhecida até a releitura', async () => {
    prepararClassificacaoLocal();

    const gravacao = componente.persistir();
    controller
      .expectOne(ROTA_CLASSIFICACAO)
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await aguardarReleitura();

    // O servidor pode ter gravado a classificação sem quadro, ou não ter gravado nada.
    expect(store.classificacao.gravada()).toEqual({ estado: 'desconhecida' });
    controller.expectOne(ROTA_DETALHE).flush({ id: PROCESSO_ID, classificacao: null });
    await gravacao;
    expect(store.classificacao.gravada()).toEqual({ estado: 'nunca-gravada' });
  });

  it('falha inconclusiva: o servidor pode ter gravado, e o quadro fica desconhecido se a releitura também falha', async () => {
    prepararClassificacaoLocal();
    store.patchObjectSection('classificacao', {
      baseadoEmEnem: true,
      resolucaoPesoAreaEnem: RESOLUCAO,
    });

    const gravacao = componente.persistir();
    controller
      .expectOne(ROTA_CLASSIFICACAO)
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await aguardarReleitura();
    controller
      .expectOne(ROTA_DETALHE)
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect((await gravacao).valid).toBe(false);
    expect(store.classificacao.motivoDaReleitura()).toBe('desconhecida');
  });

  it('usa um texto genérico para a recusa de código que a tela não conhece', async () => {
    prepararClassificacaoLocal();
    store.patchObjectSection('classificacao', {
      baseadoEmEnem: true,
      resolucaoPesoAreaEnem: RESOLUCAO,
    });

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_CLASSIFICACAO).flush(
      {
        type: 'about:blank',
        title: 'A requisição tem campos inválidos.',
        status: 422,
        code: 'uniplus.selecao.validacao',
        traceId: 'trace-1',
        errors: [
          { field: 'resolucaoPesoAreaEnem', code: 'uniplus.selecao.codigo_novo', message: 'x' },
        ],
      },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );

    await gravacao;
    expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBe(
      'O servidor recusou a resolução de Peso por Área escolhida. Confira o cadastro de Peso por Área ou escolha outra.',
    );
  });

  it('mantém a recusa guardada quando a falha seguinte não julgou a resolução', async () => {
    prepararClassificacaoLocal();
    store.classificacao.recusaDaResolucaoPesoAreaEnem.set('Recusa anterior.');

    const gravacao = componente.persistir();
    controller
      .expectOne(ROTA_CLASSIFICACAO)
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
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
    prepararClassificacaoLocal();
    store.patchObjectSection('classificacao', {
      baseadoEmEnem: true,
      resolucaoPesoAreaEnem: RESOLUCAO,
    });

    const gravacao = componente.persistir();
    // Responde o que tiver saído, para o teste falhar pela asserção e não por espera.
    const pedidos = controller.match(ROTA_CLASSIFICACAO);
    for (const pedido of pedidos) pedido.flush(null, { status: 204, statusText: 'No Content' });
    const resultado = await gravacao;

    expect(pedidos).toHaveLength(0);
    expect(resultado.valid).toBe(false);
    expect(resultado.messages).toContain(
      'A resolução de Peso por Área escolhida não está no cadastro lido. Se ela foi criada ou corrigida agora, use "Atualizar lista" no passo Fórmula; senão, escolha outra.',
    );
  });

  it('limpa a recusa guardada quando a gravação seguinte dá certo', async () => {
    prepararClassificacaoLocal();
    store.classificacao.recusaDaResolucaoPesoAreaEnem.set('Recusa antiga.');

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_CLASSIFICACAO).flush(null, { status: 204, statusText: 'No Content' });

    await expect(gravacao).resolves.toEqual({ valid: true });
    expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBeNull();
  });

  it('preserva o rascunho quando a API recusa', async () => {
    prepararClassificacaoLocal();
    const gravacao = componente.persistir();

    controller.expectOne(ROTA_CLASSIFICACAO).flush(
      {
        type: 'about:blank',
        title: 'Regra não encontrada.',
        status: 422,
        code: 'ConfiguracaoClassificacao.RegraNaoEncontrada',
        traceId: 'trace-1',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    const resultado = await gravacao;
    expect(resultado.valid).toBe(false);
    expect(store.draft().classificacao.regraCalculoCodigo).toBe('FORMULA-MEDIA-PONDERADA');
    expect(store.salvando()).toBe(false);
  });
});
