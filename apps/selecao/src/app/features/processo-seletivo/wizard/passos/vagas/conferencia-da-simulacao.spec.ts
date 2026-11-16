import { describe, expect, it } from 'vitest';

import { conferenciaDaSimulacao, haConferencia } from './conferencia-da-simulacao';
import { ajusteFixado, reservaConferida, simulada } from './simulacao.testing';

describe('conferenciaDaSimulacao — reserva legal acima do percentual', () => {
  it('aponta a oferta com excedente e reserva efetiva diferente da nominal', () => {
    const conferencia = conferenciaDaSimulacao([
      simulada('oferta-1', {
        conferenciaDaReservaLegal: reservaConferida({
          reservaLegalNominal: 20,
          reservaLegalEfetiva: 22,
          excedenteSobreAReservaLegal: 2,
        }),
      }),
    ]);

    expect(conferencia.reservaAcimaDoPercentual).toEqual([
      { ofertaCursoId: 'oferta-1', reservaLegalNominal: 20, reservaLegalEfetiva: 22 },
    ]);
  });

  it('não aponta reserva sem excedente, que seria "de 20 passou a 20"', () => {
    const conferencia = conferenciaDaSimulacao([
      simulada('oferta-1', { conferenciaDaReservaLegal: reservaConferida() }),
    ]);

    expect(conferencia.reservaAcimaDoPercentual).toEqual([]);
  });

  it('não aponta excedente quando a reserva efetiva é igual à nominal', () => {
    const conferencia = conferenciaDaSimulacao([
      simulada('oferta-1', {
        conferenciaDaReservaLegal: reservaConferida({ excedenteSobreAReservaLegal: 1 }),
      }),
    ]);

    expect(conferencia.reservaAcimaDoPercentual).toEqual([]);
  });
});

describe('conferenciaDaSimulacao — vagas cortadas por escassez', () => {
  it('aponta só a oferta que teve vagas cortadas', () => {
    const conferencia = conferenciaDaSimulacao([
      simulada('oferta-1', {
        conferenciaDaReservaLegal: reservaConferida({ vagasCortadasPorEscassez: 3 }),
      }),
      simulada('oferta-2', { conferenciaDaReservaLegal: reservaConferida() }),
    ]);

    expect(conferencia.vagasCortadasPorEscassez).toEqual([
      { ofertaCursoId: 'oferta-1', quantidade: 3 },
    ]);
  });
});

describe('conferenciaDaSimulacao — ajuste do quadro fixado', () => {
  it('traz o total e as vagas retiradas de cada modalidade', () => {
    const conferencia = conferenciaDaSimulacao([
      simulada('oferta-1', {
        ajusteDoQuadroFixado: ajusteFixado({
          totalDeVagasRetiradas: 3,
          vagasRetiradas: [
            { modalidadeCodigo: 'AC', quantidade: 2 },
            { modalidadeCodigo: 'LB_PPI', quantidade: 1 },
            { modalidadeCodigo: 'LB_Q', quantidade: 0 },
          ],
        }),
      }),
    ]);

    expect(conferencia.vagasRetiradasPeloAjuste).toEqual([
      {
        ofertaCursoId: 'oferta-1',
        total: 3,
        porModalidade: [
          { modalidadeCodigo: 'AC', quantidade: 2 },
          { modalidadeCodigo: 'LB_PPI', quantidade: 1 },
        ],
      },
    ]);
  });

  it('não aponta ajuste que nada retirou', () => {
    const conferencia = conferenciaDaSimulacao([
      simulada('oferta-1', { ajusteDoQuadroFixado: ajusteFixado() }),
    ]);

    expect(conferencia.vagasRetiradasPeloAjuste).toEqual([]);
  });
});

describe('haConferencia', () => {
  it('é falso quando nenhuma oferta trouxe conferência nem ajuste', () => {
    expect(haConferencia(conferenciaDaSimulacao([simulada('oferta-1')]))).toBe(false);
  });

  it('é verdadeiro quando ao menos um grupo tem oferta', () => {
    const conferencia = conferenciaDaSimulacao([
      simulada('oferta-1', {
        conferenciaDaReservaLegal: reservaConferida({ vagasCortadasPorEscassez: 1 }),
      }),
    ]);

    expect(haConferencia(conferencia)).toBe(true);
  });
});
