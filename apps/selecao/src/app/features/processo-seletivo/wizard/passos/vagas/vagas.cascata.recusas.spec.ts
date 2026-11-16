import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import {
  ROTA_CASCATA_TESTE,
  ROTA_DISTRIBUICAO_TESTE,
  montarPassoComCascata,
} from './vagas.cascata.testing';
import { VagasPassoComponent } from './vagas.component';
import { BASE, comReleitura, distribuicaoComCascata } from './vagas.testing';

describe('VagasPassoComponent — recusas da cascata de remanejamento', () => {
  let componente: VagasPassoComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let detectar: () => void;
  let simularEConferirDistribuicao: () => void;
  let escolherRegraCascataNaTela: (valor: string) => void;

  beforeEach(async () => {
    ({
      componente,
      store,
      controller,
      detectar,
      simularEConferirDistribuicao,
      escolherRegraCascataNaTela,
    } = await montarPassoComCascata());
  });

  afterEach(() => controller.verify());

  /**
   * Reproduz o beco sem saída: a regra existe no catálogo, mas seu
   * `esquemaArgs` não declara a matriz no formato esperado — a tabela e o
   * checkbox de confirmação não aparecem no template. Sem o desvio em
   * `pendenciasDaCascata()`, `validar()` pedia para "confirmar a cascata",
   * mandando o operador marcar um controle que a tela nem renderiza.
   */
  it('recusa avançar com mensagem acionável quando a regra escolhida não tem matriz reconhecida', async () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicaoComCascata()] });
    detectar();
    simularEConferirDistribuicao();

    escolherRegraCascataNaTela('REMANEJ-CASCATA-SEM-MATRIZ|v1');
    detectar();

    const resultado = await comReleitura(controller, componente.persistir());

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('não declara uma matriz'))).toBe(true);
    expect(resultado.messages?.some((m) => /escolha outra regra ou versão/i.test(m))).toBe(true);
    expect(resultado.messages?.some((m) => m.includes('Confirme que conferiu'))).toBe(false);
    controller.expectNone(ROTA_DISTRIBUICAO_TESTE);
    controller.expectNone(ROTA_CASCATA_TESTE);
  });

  /**
   * Reproduz o mesmo beco sem saída do teste acima, por outra entrada: a
   * cascata hidratada referencia uma versão que a listagem ativa não traz
   * mais, e a busca direta da versão também não a encontra (regra
   * genuinamente removida, não apenas fora da página carregada).
   */
  it('recusa avançar com mensagem acionável quando a regra hidratada não é encontrada no catálogo', async () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicaoComCascata()],
      cascata: { regraCodigo: 'REMANEJ-CASCATA-REMOVIDA', regraVersao: 'v9' },
    });
    detectar();
    simularEConferirDistribuicao();

    controller
      .expectOne(`${BASE}/api/selecao/regras-catalogo/REMANEJ-CASCATA-REMOVIDA/versoes/v9`)
      .flush(
        { type: 'about:blank', title: 'Regra não encontrada.', status: 404, traceId: 't' },
        { status: 404, statusText: 'Not Found' },
      );
    detectar();

    const resultado = await comReleitura(controller, componente.persistir());

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('não foi encontrada no catálogo'))).toBe(
      true,
    );
    expect(resultado.messages?.some((m) => m.includes('Confirme que conferiu'))).toBe(false);
    controller.expectNone(ROTA_DISTRIBUICAO_TESTE);
    controller.expectNone(ROTA_CASCATA_TESTE);
  });

  /**
   * Uma falha transitória (5xx) ao consultar a versão fora da listagem não
   * pode virar "regra não encontrada" — a mensagem precisa dizer que foi a
   * consulta que falhou, distinta da recusa definitiva do teste acima.
   */
  it('recusa avançar com mensagem distinta quando a consulta da regra hidratada falha (não confunde com regra ausente)', async () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicaoComCascata()],
      cascata: { regraCodigo: 'REMANEJ-CASCATA-LEI-12711', regraVersao: 'v0' },
    });
    detectar();
    simularEConferirDistribuicao();

    controller
      .expectOne(`${BASE}/api/selecao/regras-catalogo/REMANEJ-CASCATA-LEI-12711/versoes/v0`)
      .flush(
        { type: 'about:blank', title: 'Erro interno.', status: 503, traceId: 't' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    detectar();

    const resultado = await comReleitura(controller, componente.persistir());

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('a consulta falhou'))).toBe(true);
    expect(resultado.messages?.some((m) => m.includes('não foi encontrada no catálogo'))).toBe(
      false,
    );
    controller.expectNone(ROTA_DISTRIBUICAO_TESTE);
    controller.expectNone(ROTA_CASCATA_TESTE);
  });

  /**
   * `cascata_modalidade_fora_do_regime_federal` bloqueia a publicação mais
   * adiante (`ExisteCascataForaDoRegimeFederal` no domínio) mesmo quando a
   * seção da cascata nem aparece — por isso o passo Vagas não pode deixar o
   * operador avançar como se estivesse tudo bem, só porque não há cascata
   * para confirmar.
   */
  it('recusa gravar com modalidade SEGUE_CASCATA fora do ramo federal, mesmo sem seção de cascata', async () => {
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ...distribuicaoComCascata(),
          ramoDaDistribuicao: 'QUADRO_FIXADO_NO_EDITAL',
        },
      ],
    });
    detectar();

    const resultado = await comReleitura(controller, componente.persistir());

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('fora do ramo federal'))).toBe(true);
    controller.expectNone(ROTA_DISTRIBUICAO_TESTE);
    controller.expectNone(ROTA_CASCATA_TESTE);
  });
});
