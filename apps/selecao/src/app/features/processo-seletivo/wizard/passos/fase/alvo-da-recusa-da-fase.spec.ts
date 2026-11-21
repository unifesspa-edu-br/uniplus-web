import { describe, expect, it } from 'vitest';

import type { FaseDoCronograma, RecursoDaFase } from '../../processo-seletivo.models';
import { umaFaseDoCronograma } from '../../shared/fase-do-cronograma.testing';
import { alvosDaRecusaDaFase } from './alvo-da-recusa-da-fase';

const FASE = umaFaseDoCronograma({ codigo: 'AVALIACAO' });

function comInstanciaSuperior(valor: boolean | null): FaseDoCronograma {
  const regra = { admiteInstanciaSuperior: valor } as RecursoDaFase;
  return umaFaseDoCronograma({ codigo: 'AVALIACAO', regraRecurso: regra });
}

describe('alvosDaRecusaDaFase', () => {
  it.each([
    ['unidadeResponsavelId', ['cr-unidade-2']],
    ['inicio', ['cr-inicio-2']],
    ['fim', ['cr-fim-2']],
  ])('leva a recusa de %s ao campo da linha do tempo da fase', (campo, esperado) => {
    expect(alvosDaRecusaDaFase(campo, FASE, 2)).toEqual(esperado);
  });

  it('prefere o controle e reserva o bloco das recusas nas publicações e nas bancas', () => {
    expect(alvosDaRecusaDaFase('produtos', FASE, 0)).toEqual([
      'fase-AVALIACAO-produto-ato-0',
      'fase-AVALIACAO-produtos-erro',
    ]);
    expect(alvosDaRecusaDaFase('bancasRequeridas', FASE, 0)).toEqual([
      'fase-AVALIACAO-banca-0',
      'fase-AVALIACAO-bancas-erro',
    ]);
  });

  it('leva a recusa do parecer individual à caixa de marcar', () => {
    expect(alvosDaRecusaDaFase('emiteParecerIndividual', FASE, 0)[0]).toBe(
      'fase-AVALIACAO-parecer',
    );
  });

  it.each([
    ['recurso.regra', 'fase-AVALIACAO-regra'],
    ['recurso.prazoValor', 'fase-AVALIACAO-prazo-valor'],
    ['recurso.prazoUnidade', 'fase-AVALIACAO-prazo-unidade'],
    ['recurso.ancora', 'fase-AVALIACAO-ancora'],
    ['recurso.suspensividadePrimeiraInstanciaValor', 'fase-AVALIACAO-susp1-valor'],
    ['recurso.suspensividadePrimeiraInstanciaUnidade', 'fase-AVALIACAO-susp1-unidade'],
    ['recurso.suspensividadeSegundaInstanciaValor', 'fase-AVALIACAO-susp2-valor'],
    ['recurso.suspensividadeSegundaInstanciaUnidade', 'fase-AVALIACAO-susp2-unidade'],
  ])(
    'leva a recusa de %s ao controle dela, com o bloco das recusas de reserva',
    (campo, controle) => {
      expect(alvosDaRecusaDaFase(campo, FASE, 0)).toEqual([
        controle,
        'fase-AVALIACAO-recurso-recusa',
      ]);
    },
  );

  it.each([
    [true, 'fase-AVALIACAO-superior-sim'],
    [false, 'fase-AVALIACAO-superior-nao'],
    [null, 'fase-AVALIACAO-superior-sim'],
  ])(
    'leva a recusa da instância superior à opção marcada (%s), ou à primeira sem marca',
    (marcada, opcao) => {
      expect(
        alvosDaRecusaDaFase('recurso.admiteInstanciaSuperior', comInstanciaSuperior(marcada), 0),
      ).toEqual([opcao, 'fase-AVALIACAO-recurso-recusa']);
    },
  );

  it('leva a recusa da regra de recurso sem controle próprio só ao bloco das recusas', () => {
    expect(alvosDaRecusaDaFase('recurso', FASE, 0)).toEqual(['fase-AVALIACAO-recurso-recusa']);
  });

  it('leva a recusa sem controle ao topo da fase', () => {
    expect(alvosDaRecusaDaFase('', FASE, 0)).toEqual(['fase-AVALIACAO-recusas']);
  });
});
