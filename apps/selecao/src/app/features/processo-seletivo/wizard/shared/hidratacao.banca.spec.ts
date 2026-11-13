import { ModoDeDeliberacao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { COLEGIADA } from './deliberacao/regra-de-deliberacao.testing';
import { hidratarDraft } from './hidratacao';
import { DRAFT, ETAPA, FASE_COM_RECURSO, dtoComCronograma } from './hidratacao.testing';

const REGRA_DA_API = {
  modo: ModoDeDeliberacao.colegiadaComVotacao,
  integrantes: 5,
  suplentes: 2,
  quorum: 3,
  criterio: 'maioriaSimples',
  desempate: 'votoDaPresidencia',
  encerramento: 'presidenciaNoQuorum',
  semUnanimidade: null,
};

const [BANCA_DA_FASE] = FASE_COM_RECURSO.bancasRequeridas;

function comRegraNaFase(regraDeDeliberacao: unknown) {
  const fase = {
    ...FASE_COM_RECURSO,
    bancasRequeridas: [{ ...BANCA_DA_FASE, regraDeDeliberacao }],
  };
  return hidratarDraft(DRAFT, dtoComCronograma({ cronogramaFases: [fase], etapas: [] })).cronograma
    .fases[0];
}

function comBancasNaEtapa(bancas: readonly unknown[]) {
  const dto = dtoComCronograma({
    cronogramaFases: [FASE_COM_RECURSO],
    etapas: [{ ...ETAPA, bancas }],
  });
  return hidratarDraft(DRAFT, dto).cronograma.etapas[0];
}

describe('hidratarDraft — regra de deliberação da banca', () => {
  it('lê a regra da banca requerida pela fase, com os números como o campo os edita', () => {
    expect(comRegraNaFase(REGRA_DA_API).bancasRequeridas[0].regraDeDeliberacao).toEqual(COLEGIADA);
  });

  it('lê a banca da fase sem regra como sem regra declarada', () => {
    expect(comRegraNaFase(null).bancasRequeridas[0].regraDeDeliberacao).toBeNull();
    expect(comRegraNaFase(undefined).bancasRequeridas[0].regraDeDeliberacao).toBeNull();
  });

  it('lê a banca da etapa pelo tipo de origem, com a regra que ela declara', () => {
    const etapa = comBancasNaEtapa([
      {
        id: 'banca-da-etapa-1',
        tipoBancaOrigemId: 'tipo-banca-1',
        codigo: 'BANCA_ENTREVISTA',
        nome: 'Entrevista',
        regraDeDeliberacao: REGRA_DA_API,
      },
      {
        id: 'banca-da-etapa-2',
        tipoBancaOrigemId: 'tipo-banca-2',
        codigo: 'BANCA_REDACAO',
        nome: 'Redação',
        regraDeDeliberacao: null,
      },
    ]);

    expect(etapa.bancas).toEqual([
      { tipoBancaId: 'tipo-banca-1', regraDeDeliberacao: COLEGIADA },
      { tipoBancaId: 'tipo-banca-2', regraDeDeliberacao: null },
    ]);
  });
});
