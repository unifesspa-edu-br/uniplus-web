import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TelaDasVagas } from './tela-das-vagas.testing';
import { montarPassoEmGravacao } from './vagas.gravacao.testing';
import { ajusteFixado, reservaConferida, simulada } from './simulacao.testing';
import { OFERTA, OUTRA_OFERTA, ROTA_SIMULACAO, ServicosDasVagas } from './vagas.testing';

const CONFERENCIA = 'sel-conferencia-da-simulacao';

describe('VagasPassoComponent — conferência do quadro simulado', () => {
  let controller: HttpTestingController;
  let servicos: ServicosDasVagas;
  let operador: TelaDasVagas;
  let elemento: HTMLElement;

  beforeEach(async () => {
    ({ controller, servicos, operador, elemento } = await montarPassoEmGravacao());
  });

  afterEach(() => controller.verify());

  function simularComResposta(...respostas: ReturnType<typeof simulada>[]): void {
    servicos.simulacao.simular();
    controller.expectOne(ROTA_SIMULACAO).flush(respostas);
    operador.atualizar();
  }

  function conferencia(): HTMLElement | null {
    return elemento.querySelector<HTMLElement>(CONFERENCIA);
  }

  function texto(): string {
    return (conferencia()?.textContent ?? '').replace(/\s+/g, ' ');
  }

  it('não aparece quando o servidor não trouxe conferência nem ajuste', () => {
    simularComResposta(simulada(OFERTA), simulada(OUTRA_OFERTA));

    expect(conferencia()).toBeNull();
  });

  it('avisa a reserva legal acima do percentual, com o nominal e o efetivo de cada oferta', () => {
    simularComResposta(
      simulada(OFERTA, {
        conferenciaDaReservaLegal: reservaConferida({
          reservaLegalNominal: 20,
          reservaLegalEfetiva: 22,
          excedenteSobreAReservaLegal: 2,
        }),
      }),
      simulada(OUTRA_OFERTA),
    );

    expect(texto()).toContain('1 oferta ficou com a reserva legal acima do percentual declarado');
    expect(texto()).toContain('reserva legal de 20 passou a 22');
  });

  it('não avisa reserva legal que não passou do nominal', () => {
    simularComResposta(simulada(OFERTA, { conferenciaDaReservaLegal: reservaConferida() }));

    expect(conferencia()).toBeNull();
  });

  it('avisa as vagas cortadas por escassez na oferta que as teve', () => {
    simularComResposta(
      simulada(OFERTA, {
        conferenciaDaReservaLegal: reservaConferida({ vagasCortadasPorEscassez: 1 }),
      }),
    );

    expect(texto()).toContain('1 oferta ficou com vagas cortadas por escassez');
    expect(texto()).toContain('1 vaga cortada por escassez');
  });

  it('avisa o que o ajuste retirou do quadro fixado, total e por modalidade', () => {
    simularComResposta(
      simulada(OFERTA, {
        ajusteDoQuadroFixado: ajusteFixado({
          totalDeVagasRetiradas: 3,
          vagasRetiradas: [
            { modalidadeCodigo: 'AC', quantidade: 2 },
            { modalidadeCodigo: 'LB_PPI', quantidade: 1 },
          ],
        }),
      }),
    );

    expect(texto()).toContain('1 oferta ficou com vagas retiradas pelo ajuste do quadro');
    expect(texto()).toContain('3 vagas retiradas (AC: 2; LB_PPI: 1)');
  });

  it('é uma região de status para o leitor de tela', () => {
    simularComResposta(
      simulada(OFERTA, {
        conferenciaDaReservaLegal: reservaConferida({ vagasCortadasPorEscassez: 2 }),
      }),
    );

    expect(conferencia()?.getAttribute('role')).toBe('status');
  });
});
