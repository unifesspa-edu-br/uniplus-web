import { HttpTestingController } from '@angular/common/http/testing';
import {
  ProcessoSeletivoDto,
  SituacaoDoProcessoSeletivoCodigo,
} from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import {
  ROTA_CASCATA_TESTE,
  ROTA_DISTRIBUICAO_TESTE,
  ROTA_PROCESSO_LIDO_TESTE,
  ROTA_SIMULACAO_TESTE,
  montarPassoComCascata,
} from './vagas.cascata.testing';
import { VagasPassoComponent } from './vagas.component';
import {
  AC_CASCATA,
  LB_Q,
  OFERTA_CASCATA,
  ServicosDasVagas,
  comReleitura,
  distribuicaoComCascata,
  tick,
} from './vagas.testing';

describe('VagasPassoComponent — falhas na gravação da cascata de remanejamento', () => {
  let componente: VagasPassoComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let servicos: ServicosDasVagas;
  let detectar: () => void;
  let simularEConferirDistribuicao: () => void;
  let escolherRegraCascataNaTela: (valor: string) => void;

  beforeEach(async () => {
    ({
      componente,
      store,
      controller,
      servicos,
      detectar,
      simularEConferirDistribuicao,
      escolherRegraCascataNaTela,
    } = await montarPassoComCascata());
  });

  afterEach(() => controller.verify());

  it('quando a distribuição falha, a cascata não é enviada', async () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicaoComCascata()] });
    detectar();
    simularEConferirDistribuicao();
    escolherRegraCascataNaTela('REMANEJ-CASCATA-LEI-12711|v1');
    detectar();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_DISTRIBUICAO_TESTE).flush(
      {
        type: 'about:blank',
        title: 'A quantidade de vagas de uma modalidade não pode ser negativa',
        status: 422,
        code: 'uniplus.selecao.configuracao_distribuicao_vagas.quantidade_vaga_negativa',
        traceId: 'trace-1',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    const resultado = await comReleitura(controller, gravacao);
    expect(resultado.valid).toBe(false);
    controller.expectNone(ROTA_CASCATA_TESTE);
  });

  it('quando a distribuição grava mas a cascata falha, a mensagem diz que só a distribuição gravou', async () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicaoComCascata()] });
    detectar();
    simularEConferirDistribuicao();
    escolherRegraCascataNaTela('REMANEJ-CASCATA-LEI-12711|v1');
    detectar();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_DISTRIBUICAO_TESTE).flush(null, {
      status: 204,
      statusText: 'No Content',
    });
    await tick();
    controller.expectOne(ROTA_CASCATA_TESTE).flush(
      {
        type: 'about:blank',
        title: 'A matriz diverge da regra.',
        status: 422,
        code: 'uniplus.selecao.configuracao_cascata_remanejamento.matriz_divergente_da_regra',
        traceId: 'trace-2',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    const resultado = await comReleitura(controller, gravacao);
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.[0]).toContain('distribuição de vagas foi gravada');
  });

  /**
   * Um 5xx na gravação da cascata é resposta
   * inconclusiva (`ChaveDeSubstituicao` preserva a chave porque o servidor
   * pode ter aplicado o comando mesmo sem confirmar) — `existeNoServidor`
   * não pode ficar `false` nesse caso, senão uma mudança seguinte que torne
   * a cascata desnecessária pula a remoção e deixa uma cascata possivelmente
   * gravada órfã no servidor.
   */
  it('trata recusa 5xx da cascata como presença possível, e força a remoção quando ela deixa de se aplicar depois', async () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicaoComCascata()] });
    detectar();
    simularEConferirDistribuicao();
    escolherRegraCascataNaTela('REMANEJ-CASCATA-LEI-12711|v1');
    detectar();

    const primeiraGravacao = componente.persistir();
    controller.expectOne(ROTA_DISTRIBUICAO_TESTE).flush(null, {
      status: 204,
      statusText: 'No Content',
    });
    await tick();
    controller.expectOne(ROTA_CASCATA_TESTE).flush(
      {
        type: 'about:blank',
        title: 'Erro interno do servidor.',
        status: 503,
        traceId: 'trace-3',
      },
      { status: 503, statusText: 'Service Unavailable' },
    );
    expect((await comReleitura(controller, primeiraGravacao)).valid).toBe(false);

    // A oferta deixa de exigir cascata — se o 5xx acima aplicou o comando no
    // servidor, pular a remoção deixaria a cascata órfã.
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ...distribuicaoComCascata(),
          modalidades: [
            { id: LB_Q, codigo: 'LB_Q' },
            { id: AC_CASCATA, codigo: 'AC' },
          ],
          quadro: [
            { modalidadeId: LB_Q, quantidade: '20' },
            { modalidadeId: AC_CASCATA, quantidade: '80' },
          ],
        },
      ],
    });
    detectar();
    servicos.simulacao.simular();
    controller.expectOne(ROTA_SIMULACAO_TESTE).flush([
      {
        ofertaCursoOrigemId: OFERTA_CASCATA,
        quadro: [],
        totalDeVagasDoEdital: 100,
        conferenciaDaReservaLegal: null,
        ajusteDoQuadroFixado: null,
      },
    ]);

    const segundaGravacao = componente.persistir();
    // A cascata ficou sem resposta conclusiva: o passo relê o processo antes de gravar de novo.
    controller.expectOne(ROTA_PROCESSO_LIDO_TESTE).flush({ distribuicaoVagas: [] });
    await tick();
    controller.expectOne(ROTA_DISTRIBUICAO_TESTE).flush(null, {
      status: 204,
      statusText: 'No Content',
    });
    await tick();

    const remocao = controller.expectOne(ROTA_CASCATA_TESTE);
    expect(remocao.request.body).toEqual({
      regraCodigo: null,
      regraVersao: null,
      fallbackCodigo: null,
      destinos: null,
    });
    remocao.flush(null, { status: 204, statusText: 'No Content' });
    await expect(comReleitura(controller, segundaGravacao)).resolves.toEqual({ valid: true });
  });

  it('envia a remoção quando a cascata deixou de se aplicar mas havia escolha anterior', async () => {
    // Hidratação anterior trouxe uma cascata do servidor — é isto, não o
    // valor do seletor de regra, que decide se a remoção precisa ser
    // enviada quando a oferta em tela já não tem modalidade SEGUE_CASCATA.
    store.remoteSnapshot.set({
      situacao: {
        codigo: SituacaoDoProcessoSeletivoCodigo.RASCUNHO,
        rotulo: SituacaoDoProcessoSeletivoCodigo.RASCUNHO,
      },
      cascata: {
        id: 'cascata-1',
        regra: { codigo: 'REMANEJ-CASCATA-LEI-12711', versao: 'v1', hash: 'hash-1' },
        fallbackCodigo: 'AC',
        destinos: [],
      },
    } as unknown as ProcessoSeletivoDto);
    detectar();

    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ...distribuicaoComCascata(),
          modalidades: [
            { id: LB_Q, codigo: 'LB_Q' },
            { id: AC_CASCATA, codigo: 'AC' },
          ],
          quadro: [
            { modalidadeId: LB_Q, quantidade: '20' },
            { modalidadeId: AC_CASCATA, quantidade: '80' },
          ],
        },
      ],
      cascata: null,
    });
    detectar();
    servicos.simulacao.simular();
    controller.expectOne(ROTA_SIMULACAO_TESTE).flush([
      {
        ofertaCursoOrigemId: OFERTA_CASCATA,
        quadro: [],
        totalDeVagasDoEdital: 100,
        conferenciaDaReservaLegal: null,
        ajusteDoQuadroFixado: null,
      },
    ]);

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_DISTRIBUICAO_TESTE).flush(null, {
      status: 204,
      statusText: 'No Content',
    });
    await tick();

    const cascataReq = controller.expectOne(ROTA_CASCATA_TESTE);
    expect(cascataReq.request.body).toEqual({
      regraCodigo: null,
      regraVersao: null,
      fallbackCodigo: null,
      destinos: null,
    });
    cascataReq.flush(null, { status: 204, statusText: 'No Content' });

    await expect(comReleitura(controller, gravacao)).resolves.toEqual({ valid: true });
  });
});
