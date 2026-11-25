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

describe('VagasPassoComponent — gravação da cascata de remanejamento', () => {
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

  it('grava a cascata depois da distribuição, com a matriz inteira da regra', async () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicaoComCascata()] });
    detectar();
    simularEConferirDistribuicao();

    escolherRegraCascataNaTela('REMANEJ-CASCATA-LEI-12711|v1');
    detectar();

    const gravacao = componente.persistir();

    const distribuicaoReq = controller.expectOne(ROTA_DISTRIBUICAO_TESTE);
    distribuicaoReq.flush(null, { status: 204, statusText: 'No Content' });
    await tick();

    const cascataReq = controller.expectOne(ROTA_CASCATA_TESTE);
    expect(cascataReq.request.method).toBe('PUT');
    expect(cascataReq.request.body).toEqual({
      regraCodigo: 'REMANEJ-CASCATA-LEI-12711',
      regraVersao: 'v1',
      fallbackCodigo: 'AC',
      destinos: [
        { modalidadeOrigemCodigo: 'LB_PPI', ordem: 1, modalidadeDestinoCodigo: 'LB_Q' },
        { modalidadeOrigemCodigo: 'LB_PPI', ordem: 2, modalidadeDestinoCodigo: 'AC' },
      ],
    });
    expect(cascataReq.request.headers.get('Idempotency-Key')).toBeTruthy();

    cascataReq.flush(null, { status: 204, statusText: 'No Content' });
    await expect(comReleitura(controller, gravacao)).resolves.toEqual({ valid: true });
  });

  it('não envia cascata quando nenhuma oferta a exige', async () => {
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

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_DISTRIBUICAO_TESTE).flush(null, {
      status: 204,
      statusText: 'No Content',
    });
    await tick();

    controller.expectNone(ROTA_CASCATA_TESTE);
    await expect(comReleitura(controller, gravacao)).resolves.toEqual({ valid: true });
  });

  /**
   * A cascata exigida e sem regra escolhida continua bloqueando — isso é erro, não conferência.
   *
   * O que saiu daqui foi a marca do operador. Enquanto ela existia, o efeito que a zerava a
   * cada hidratação fazia a gravação da publicação falhar com "confirme a matriz" num passo que
   * o operador não tinha aberto — bastava um recarregamento antes de publicar.
   */
  it('recusa gravar com a cascata exigida e sem regra escolhida', async () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicaoComCascata()] });
    detectar();
    simularEConferirDistribuicao();

    const resultado = await comReleitura(controller, componente.persistir());

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('cascata'))).toBe(true);
    controller.expectNone(ROTA_DISTRIBUICAO_TESTE);
    controller.expectNone(ROTA_CASCATA_TESTE);
  });

  /**
   * O defeito que esta entrega conserta: depois de hidratar, a gravação da cascata falhava
   * porque o efeito de `remoteSnapshot` zerava a marca de conferência a cada leitura.
   */
  it('grava a cascata logo depois de hidratar, sem marca nenhuma a repor', async () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicaoComCascata()] });
    detectar();
    simularEConferirDistribuicao();
    escolherRegraCascataNaTela('REMANEJ-CASCATA-LEI-12711|v1');
    detectar();

    // O que a retomada faz: reprojeta o snapshot remoto por cima do que está em tela.
    store.remoteSnapshot.set({
      cascata: null,
      situacao: { codigo: SituacaoDoProcessoSeletivoCodigo.RASCUNHO, rotulo: 'Rascunho' },
    } as unknown as ProcessoSeletivoDto);
    detectar();

    expect(componente.validar().valid).toBe(true);
  });
});
