import { describe, expect, it } from 'vitest';

import { umaBancaDeclarada, umaBancaRequeridaDaFase } from '../bancas/banca-declarada.testing';
import { umaEtapaDoCronograma } from '../etapa-do-cronograma.testing';
import { umaFaseDoCronograma } from '../fase-do-cronograma.testing';
import {
  lugarDaRecusaDaPublicacao,
  type CronogramaConferido,
} from './lugar-da-recusa-da-publicacao';

const daFase = { lista: 'fases', identificador: 'CLASSIFICACAO' };
const daEtapa = { lista: 'etapas', identificador: 'etapa-1' };
const daBancaDaFase = (identificador: string) => ({ lista: 'bancasRequeridas', identificador });
const daBancaDaEtapa = (identificador: string) => ({ lista: 'bancas', identificador });

const CRONOGRAMA: CronogramaConferido = {
  fases: [
    umaFaseDoCronograma({
      codigo: 'CLASSIFICACAO',
      bancasRequeridas: [
        umaBancaRequeridaDaFase({ id: 'id-aaa', identificadorLocal: 'banca-1' }),
        umaBancaRequeridaDaFase({ id: 'id-bbb', identificadorLocal: 'banca-2' }),
      ],
    }),
  ],
  etapas: [
    umaEtapaDoCronograma({
      id: 'etapa-1',
      bancas: [
        umaBancaDeclarada({ id: 'id-ccc', identificadorLocal: 'banca-1' }),
        umaBancaDeclarada({ id: 'id-ddd', identificadorLocal: 'banca-2' }),
      ],
    }),
  ],
};

const naFase = (campo: string, ...identificadores: { lista: string; identificador: string }[]) =>
  lugarDaRecusaDaPublicacao({ campo, identificadores: [daFase, ...identificadores] }, CRONOGRAMA);
const naEtapa = (campo: string, ...identificadores: { lista: string; identificador: string }[]) =>
  lugarDaRecusaDaPublicacao({ campo, identificadores: [daEtapa, ...identificadores] }, CRONOGRAMA);

describe('lugarDaRecusaDaPublicacao: banca da fase', () => {
  it('acha a banca pelo identificador, e não pela posição que a API deu', () => {
    const lugar = naFase(
      'fases[0].bancasRequeridas[0].regraDeDeliberacao.quorum',
      daBancaDaFase('id-bbb'),
    );

    expect(lugar).toMatchObject({
      tipo: 'fase',
      campo: 'bancasRequeridas.banca-2.quorum',
      bancaAusente: false,
    });
  });

  it('distingue duas bancas do mesmo tipo recusadas em posições diferentes', () => {
    const primeira = naFase('fases[0].bancasRequeridas[0]', daBancaDaFase('id-aaa'));
    const segunda = naFase('fases[0].bancasRequeridas[1]', daBancaDaFase('id-bbb'));

    expect([primeira, segunda]).toMatchObject([
      { campo: 'bancasRequeridas.banca-1' },
      { campo: 'bancasRequeridas.banca-2' },
    ]);
  });

  it('leva à seção, marcada como banca ausente, a recusa que não trouxe identificador', () => {
    expect(naFase('fases[0].bancasRequeridas[1]')).toMatchObject({
      campo: 'bancasRequeridas',
      bancaAusente: true,
    });
  });

  it('leva à seção, marcada como banca ausente, a banca que não está mais na tela', () => {
    expect(naFase('fases[0].bancasRequeridas[0]', daBancaDaFase('id-que-saiu'))).toMatchObject({
      campo: 'bancasRequeridas',
      bancaAusente: true,
    });
  });

  it('deixa na seção, sem marcar banca ausente, a recusa que nunca apontou banca', () => {
    expect(naFase('fases[0].bancasRequeridas')).toMatchObject({
      campo: 'bancasRequeridas',
      bancaAusente: false,
    });
  });
});

describe('lugarDaRecusaDaPublicacao: banca da etapa', () => {
  it('acha a banca pelo identificador, e não pela posição que a API deu', () => {
    const lugar = naEtapa('etapas[0].bancas[0].regraDeDeliberacao.modo', daBancaDaEtapa('id-ddd'));

    expect(lugar).toMatchObject({
      tipo: 'etapa',
      campo: 'bancas.banca-2.modo',
      bancaAusente: false,
    });
  });

  it('leva à seção, marcada como banca ausente, a recusa sem identificador ou de banca que saiu', () => {
    expect(naEtapa('etapas[0].bancas[1]')).toMatchObject({ campo: 'bancas', bancaAusente: true });
    expect(naEtapa('etapas[0].bancas[1]', daBancaDaEtapa('id-que-saiu'))).toMatchObject({
      campo: 'bancas',
      bancaAusente: true,
    });
  });

  it('deixa na seção, sem marcar banca ausente, a recusa que nunca apontou banca', () => {
    expect(naEtapa('etapas[0].bancas')).toMatchObject({ campo: 'bancas', bancaAusente: false });
  });
});
