import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { montarPassoEmGravacao } from './vagas.gravacao.testing';
import { TelaDasVagas } from './tela-das-vagas.testing';
import { VagasPassoComponent } from './vagas.component';
import {
  OFERTA,
  OUTRA_OFERTA,
  ROTA_DISTRIBUICAO,
  ROTA_SIMULACAO,
  comReleitura,
  ServicosDasVagas,
} from './vagas.testing';

describe('VagasPassoComponent — simulação do quadro', () => {
  let componente: VagasPassoComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let servicos: ServicosDasVagas;
  let operador: TelaDasVagas;
  let simular: (ofertas: readonly string[]) => void;

  beforeEach(async () => {
    ({ componente, store, controller, servicos, operador, simular } =
      await montarPassoEmGravacao());
  });

  afterEach(() => controller.verify());

  /**
   * O diálogo distingue as linhas pelo rótulo, e duas modalidades de descrição parecida
   * colidiriam — o código de domínio é o que garante a unicidade.
   */
  it('resume o quadro com rótulos únicos e totais que batem com as colunas', () => {
    simular([OFERTA, OUTRA_OFERTA]);

    const confirmacao = componente.confirmacaoDeGravacao();
    if (confirmacao === null) throw new Error('o quadro simulado e sem pendência deve confirmar');

    const rotulos = confirmacao.itens.map((item) => item.rotulo);
    expect(new Set(rotulos).size).toBe(rotulos.length);
    expect(rotulos).toContain('Ofertas de curso no quadro');
    expect(confirmacao.itens.find((i) => i.rotulo === 'Ofertas de curso no quadro')?.valor).toBe(
      String(servicos.estado.distribuicoes().length),
    );
  });

  /**
   * Sob a Lei 12.711 a suplementar ACRESCE ao total da oferta, então o que o edital publica
   * pode ser maior que a soma das vagas informadas. O diálogo diz representar o quadro
   * publicado, e pedia confirmação do número menor — com o rótulo do maior.
   */
  it('confirma os dois totais quando o publicado difere do informado', () => {
    simular([OFERTA, OUTRA_OFERTA]);

    const confirmacao = componente.confirmacaoDeGravacao();
    if (confirmacao === null) throw new Error('o quadro simulado e sem pendência deve confirmar');

    const informadas = confirmacao.itens.find((i) => i.rotulo === 'Vagas informadas nas ofertas');
    const publicado = confirmacao.itens.find((i) => i.rotulo.startsWith('Total publicado'));

    expect(informadas?.valor, 'duas ofertas de 40 vagas informadas').toBe('80');
    expect(
      publicado?.valor,
      'duas ofertas cujo cálculo da regra publica 42 — é este o total do edital',
    ).toBe('84');
  });

  /**
   * Editar o quadro invalida a simulação — e é a simulação, não uma marca do operador, que o
   * passo exige antes de gravar. Era isso que o checkbox protegia indiretamente; agora a
   * invariante está sozinha, e sem estado que possa envelhecer entre o clique e a gravação.
   */
  it('editar o quadro derruba a simulação e volta a impedir a gravação', () => {
    simular([OFERTA, OUTRA_OFERTA]);
    expect(componente.validar().valid).toBe(true);

    operador.alterarVoBase(OFERTA, '35');

    expect(store.draft().vagas.ofertas[0].voBase).toBe('35');
    expect(servicos.estado.simulacaoCobreOQuadro()).toBe(false);
    expect(componente.validar().valid).toBe(false);
  });

  /**
   * A resposta descreveria o quadro anterior, e a conferência — que só olha se
   * cada oferta tem resultado — a aceitaria como atual. Abandonar a requisição
   * resolve os dois lados: nada obsoleto é instalado, e o botão de simular fica
   * livre para o quadro novo em vez de esperar por um resultado que será
   * ignorado.
   */
  it('abandona a simulação em voo quando o quadro muda', async () => {
    servicos.simulacao.simular();
    const requisicao = controller.expectOne(ROTA_SIMULACAO);
    expect(servicos.simulacao.simulando()).toBe(true);

    operador.alterarVoBase(OFERTA, '35');

    expect(store.draft().vagas.ofertas[0].voBase).toBe('35');
    expect(requisicao.cancelled).toBe(true);
    expect(servicos.simulacao.simulando()).toBe(false);
    expect(servicos.estado.simulacaoCobreOQuadro()).toBe(false);

    const resultado = await comReleitura(controller, componente.persistir());
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('Simule o quadro'))).toBe(true);
    controller.expectNone(ROTA_DISTRIBUICAO);
  });

  /** Simular de novo não deixa a requisição anterior competindo pelo resultado. */
  it('abandona a simulação anterior ao simular outra vez', () => {
    servicos.simulacao.simular();
    const primeira = controller.expectOne(ROTA_SIMULACAO);

    servicos.simulacao.simular();
    const segunda = controller.expectOne(ROTA_SIMULACAO);

    expect(primeira.cancelled).toBe(true);
    expect(segunda.cancelled).toBe(false);
    expect(servicos.simulacao.simulando()).toBe(true);
  });

  /** Sem edição no meio, a resposta é a do quadro em tela e vale. */
  it('instala a simulação quando o quadro não mudou', () => {
    simular([OFERTA, OUTRA_OFERTA]);

    expect(servicos.estado.simulacaoCobreOQuadro()).toBe(true);
  });
});
