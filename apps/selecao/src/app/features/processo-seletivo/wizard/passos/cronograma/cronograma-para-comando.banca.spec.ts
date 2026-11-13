import { ModoDeDeliberacao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import type { EtapaPontuada, FaseDoCronograma } from '../../processo-seletivo.models';
import {
  ATO_INDIVIDUAL,
  COLEGIADA,
  comRegra,
} from '../../shared/deliberacao/regra-de-deliberacao.testing';
import { hidratarDraft } from '../../shared/hidratacao';
import { DRAFT, ETAPA, FASE_COM_RECURSO, dtoComCronograma } from '../../shared/hidratacao.testing';
import { comoComandoDeEtapa, comoComandoDeFase } from './cronograma-para-comando';

const [fase] = hidratarDraft(
  DRAFT,
  dtoComCronograma({ cronogramaFases: [FASE_COM_RECURSO], etapas: [ETAPA] }),
).cronograma.fases;
const [etapa] = hidratarDraft(
  DRAFT,
  dtoComCronograma({ cronogramaFases: [FASE_COM_RECURSO], etapas: [ETAPA] }),
).cronograma.etapas;

const faseComRegra = (
  regraDeDeliberacao: FaseDoCronograma['bancasRequeridas'][number]['regraDeDeliberacao'],
) => ({
  ...fase,
  bancasRequeridas: [{ ...fase.bancasRequeridas[0], regraDeDeliberacao }],
});

const etapaComBancas = (bancas: EtapaPontuada['bancas']): EtapaPontuada => ({ ...etapa, bancas });

describe('regra de deliberação da banca no comando da fase', () => {
  it('envia a banca sem regra com a regra nula', () => {
    const [banca] = comoComandoDeFase(faseComRegra(null)).bancasRequeridas ?? [];

    expect(banca).toMatchObject({ tipoBancaId: 'tipo-banca-1', regraDeDeliberacao: null });
  });

  it('envia a colegiada com os números inteiros e a votação declarada', () => {
    const [banca] = comoComandoDeFase(faseComRegra(COLEGIADA)).bancasRequeridas ?? [];

    expect(banca.regraDeDeliberacao).toEqual({
      modo: ModoDeDeliberacao.colegiadaComVotacao,
      integrantes: 5,
      suplentes: 2,
      quorum: 3,
      criterio: 'maioriaSimples',
      desempate: 'votoDaPresidencia',
      encerramento: 'presidenciaNoQuorum',
      semUnanimidade: null,
    });
  });

  it('envia o ato individual sem nenhum campo de votação', () => {
    const [banca] = comoComandoDeFase(faseComRegra(ATO_INDIVIDUAL)).bancasRequeridas ?? [];

    expect(banca.regraDeDeliberacao).toEqual({
      modo: ModoDeDeliberacao.atoIndividual,
      integrantes: 1,
      suplentes: 0,
    });
  });

  it('mantém o recorte de competência ao lado da regra', () => {
    const [banca] = comoComandoDeFase(faseComRegra(COLEGIADA)).bancasRequeridas ?? [];

    expect(banca.categoriasDocumentoIds).toEqual(['categoria-renda']);
  });
});

describe('regra de deliberação da banca no comando da etapa', () => {
  it('envia cada banca da etapa com a regra que declara', () => {
    const comando = comoComandoDeEtapa(
      etapaComBancas([
        { tipoBancaId: 'tipo-banca-1', regraDeDeliberacao: COLEGIADA },
        { tipoBancaId: 'tipo-banca-2', regraDeDeliberacao: null },
        {
          tipoBancaId: 'tipo-banca-3',
          regraDeDeliberacao: comRegra({ integrantes: '1' }, ATO_INDIVIDUAL),
        },
      ]),
    );

    expect(comando.bancas).toEqual([
      {
        tipoBancaId: 'tipo-banca-1',
        regraDeDeliberacao: expect.objectContaining({ integrantes: 5 }),
      },
      { tipoBancaId: 'tipo-banca-2', regraDeDeliberacao: null },
      {
        tipoBancaId: 'tipo-banca-3',
        regraDeDeliberacao: { modo: ModoDeDeliberacao.atoIndividual, integrantes: 1, suplentes: 0 },
      },
    ]);
  });
});
