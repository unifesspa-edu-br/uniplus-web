import {
  type EtapaProcessoDto,
  ModoDeDeliberacao,
  TipoDeBancaCodigo,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { COLEGIADA } from './deliberacao/regra-de-deliberacao.testing';
import {
  etapaDoServidor,
  faseDoServidor,
  tipoDeBancaDoServidor,
} from './cronograma-do-servidor.testing';
import { hidratarDraft } from './hidratacao';
import { DRAFT, FASE_COM_RECURSO, dtoComCronograma } from './hidratacao.testing';

type RegraDoServidor = NonNullable<EtapaProcessoDto['bancas'][number]['regraDeDeliberacao']>;

const REGRA_DA_API: RegraDoServidor = {
  modo: ModoDeDeliberacao.colegiadaComVotacao,
  integrantes: 5,
  suplentes: 2,
  quorum: 3,
  criterio: 'maioriaSimples' as RegraDoServidor['criterio'],
  desempate: 'votoDaPresidencia' as RegraDoServidor['desempate'],
  encerramento: 'presidenciaNoQuorum' as RegraDoServidor['encerramento'],
  semUnanimidade: null,
};

const [BANCA_DA_FASE] = FASE_COM_RECURSO.bancasRequeridas;

function comRegraNaFase(regraDeDeliberacao: RegraDoServidor | null) {
  const fase = faseDoServidor({
    bancasRequeridas: [{ ...BANCA_DA_FASE, regraDeDeliberacao }],
  });
  return hidratarDraft(DRAFT, dtoComCronograma({ cronogramaFases: [fase], etapas: [] })).cronograma
    .fases[0];
}

function comBancasNaEtapa(bancas: EtapaProcessoDto['bancas']) {
  const dto = dtoComCronograma({
    cronogramaFases: [FASE_COM_RECURSO],
    etapas: [etapaDoServidor({ bancas })],
  });
  return hidratarDraft(DRAFT, dto).cronograma.etapas[0];
}

describe('hidratarDraft — regra de deliberação da banca', () => {
  it('lê a regra da banca requerida pela fase, com os números como o campo os edita', () => {
    expect(comRegraNaFase(REGRA_DA_API).bancasRequeridas[0].regraDeDeliberacao).toEqual(COLEGIADA);
  });

  it('lê a banca da fase sem regra como sem regra declarada', () => {
    expect(comRegraNaFase(null).bancasRequeridas[0].regraDeDeliberacao).toBeNull();
  });

  it('lê a banca da etapa pelo tipo de origem, com a regra que ela declara', () => {
    const etapa = comBancasNaEtapa([
      {
        id: 'banca-da-etapa-1',
        tipoBancaOrigemId: 'tipo-banca-1',
        ...tipoDeBancaDoServidor(TipoDeBancaCodigo.BANCA_ENTREVISTA),
        nome: 'Entrevista',
        regraDeDeliberacao: REGRA_DA_API,
      },
      {
        id: 'banca-da-etapa-2',
        tipoBancaOrigemId: 'tipo-banca-2',
        ...tipoDeBancaDoServidor(TipoDeBancaCodigo.BANCA_CORRECAO_REDACOES),
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
