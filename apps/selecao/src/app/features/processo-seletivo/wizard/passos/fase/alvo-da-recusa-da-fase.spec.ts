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

  it.each([
    ['produtos.2.atoCodigo', 'produto-ato-2'],
    ['produtos.2', 'produto-ato-2'],
    ['produtos.1.papel', 'produto-papel-1'],
  ])('leva a recusa de %s ao controle da linha, com os blocos de reserva', (campo, controle) => {
    const posicao = campo.split('.')[1];

    expect(alvosDaRecusaDaFase(campo, FASE, 0)).toEqual([
      `fase-AVALIACAO-${controle}`,
      `fase-AVALIACAO-produto-${posicao}-erro`,
      'fase-AVALIACAO-produtos-erro',
    ]);
  });

  it('leva a recusa do parecer individual à caixa de marcar', () => {
    expect(alvosDaRecusaDaFase('emiteParecerIndividual', FASE, 0)[0]).toBe(
      'fase-AVALIACAO-parecer',
    );
  });

  it.each([
    ['recurso.regra', 'fase-AVALIACAO-regra'],
    ['recurso.ancora', 'fase-AVALIACAO-ancora'],
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
    ['recurso.prazoValor', ['recurso-fase-id-1-prazo-interposicao-valor']],
    [
      'recurso.prazoUnidade',
      [
        'recurso-fase-id-1-prazo-interposicao-unidade',
        'recurso-fase-id-1-prazo-interposicao-situacao',
      ],
    ],
    ['recurso.efeitoSuspensivo', ['recurso-fase-id-1-efeito-grupo']],
    ['recurso.guardaDaVaga', ['recurso-fase-id-1-guarda-grupo']],
    ['recurso.prazoSegundaInstanciaValor', ['recurso-fase-id-1-prazo-segunda-valor']],
    [
      'recurso.prazoSegundaInstanciaUnidade',
      ['recurso-fase-id-1-prazo-segunda-unidade', 'recurso-fase-id-1-prazo-segunda-situacao'],
    ],
  ])(
    'leva a recusa de %s ao controle do componente comum, com o bloco das recusas de reserva',
    (campo, controles) => {
      expect(alvosDaRecusaDaFase(campo, FASE, 0)).toEqual([
        ...controles,
        'fase-AVALIACAO-recurso-recusa',
      ]);
    },
  );

  it.each([
    [true, 'recurso-fase-id-1-superior-sim'],
    [false, 'recurso-fase-id-1-superior-nao'],
    [null, 'recurso-fase-id-1-superior-sim'],
  ])(
    'leva a recusa da instância superior à opção marcada (%s), ou à primeira sem marca',
    (marcada, opcao) => {
      expect(
        alvosDaRecusaDaFase('recurso.admiteInstanciaSuperior', comInstanciaSuperior(marcada), 0),
      ).toEqual([opcao, 'recurso-fase-id-1-superior-recusas', 'fase-AVALIACAO-recurso-recusa']);
    },
  );

  it('leva a recusa da regra de recurso sem controle próprio só ao bloco das recusas', () => {
    expect(alvosDaRecusaDaFase('recurso', FASE, 0)).toEqual(['fase-AVALIACAO-recurso-recusa']);
  });

  it('leva a recusa sem controle ao topo da fase', () => {
    expect(alvosDaRecusaDaFase('', FASE, 0)).toEqual(['fase-AVALIACAO-recusas']);
  });
});
