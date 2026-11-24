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

const atoIndividualSemVotacao = {
  modo: ModoDeDeliberacao.ATO_INDIVIDUAL,
  integrantes: 1,
  suplentes: 0,
  quorum: null,
  criterio: null,
  desempate: null,
  encerramento: null,
  semUnanimidade: null,
};

describe('regra de deliberação da banca no comando da fase', () => {
  it('envia a banca sem regra com a regra nula', () => {
    const [banca] = comoComandoDeFase(faseComRegra(null)).bancasRequeridas ?? [];

    expect(banca).toMatchObject({ tipoBancaId: 'tipo-banca-1', regraDeDeliberacao: null });
  });

  it('envia a colegiada com os números inteiros e a votação declarada', () => {
    const [banca] = comoComandoDeFase(faseComRegra(COLEGIADA)).bancasRequeridas ?? [];

    expect(banca.regraDeDeliberacao).toEqual({
      modo: ModoDeDeliberacao.COLEGIADA_COM_VOTACAO,
      integrantes: 5,
      suplentes: 2,
      quorum: 3,
      criterio: 'MAIORIA_SIMPLES',
      desempate: 'VOTO_DA_PRESIDENCIA',
      encerramento: 'PRESIDENCIA_NO_QUORUM',
      semUnanimidade: null,
    });
  });

  it('envia o ato individual sem votação com os campos nulos', () => {
    const [banca] = comoComandoDeFase(faseComRegra(ATO_INDIVIDUAL)).bancasRequeridas ?? [];

    expect(banca.regraDeDeliberacao).toEqual(atoIndividualSemVotacao);
  });

  it('mantém a competência ao lado da regra', () => {
    const [banca] = comoComandoDeFase(faseComRegra(COLEGIADA)).bancasRequeridas ?? [];

    expect(banca.categoriasDocumentoIds).toEqual(['categoria-renda']);
  });
});

describe('regra de deliberação da banca no comando da etapa', () => {
  it('envia cada banca da etapa com a regra que declara', () => {
    const comando = comoComandoDeEtapa(
      etapaComBancas([
        {
          id: null,
          identificadorLocal: 'banca-teste',
          copiaDoTipo: null,
          tipoBancaId: 'tipo-banca-1',
          regraDeDeliberacao: COLEGIADA,
        },
        {
          id: null,
          identificadorLocal: 'banca-teste',
          copiaDoTipo: null,
          tipoBancaId: 'tipo-banca-2',
          regraDeDeliberacao: null,
        },
        {
          id: null,
          identificadorLocal: 'banca-teste',
          copiaDoTipo: null,
          tipoBancaId: 'tipo-banca-3',
          regraDeDeliberacao: comRegra({ integrantes: '1' }, ATO_INDIVIDUAL),
        },
      ]),
    );

    expect(comando.bancas).toEqual([
      {
        id: null,
        tipoBancaId: 'tipo-banca-1',
        regraDeDeliberacao: expect.objectContaining({ integrantes: 5 }),
      },
      { id: null, tipoBancaId: 'tipo-banca-2', regraDeDeliberacao: null },
      {
        id: null,
        tipoBancaId: 'tipo-banca-3',
        regraDeDeliberacao: atoIndividualSemVotacao,
      },
    ]);
  });
});
