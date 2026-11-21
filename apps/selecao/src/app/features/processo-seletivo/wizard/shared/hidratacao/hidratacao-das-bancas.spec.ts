import { ModoDeDeliberacao, type ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { ATO_INDIVIDUAL } from '../deliberacao/regra-de-deliberacao.testing';
import { bancaDaEtapaDe, bancaRequeridaDe } from './hidratacao-das-bancas';

type BancaRequeridaDto = ProcessoSeletivoDto['cronogramaFases'][number]['bancasRequeridas'][number];
type BancaDaEtapaDto = ProcessoSeletivoDto['etapas'][number]['bancas'][number];

const REGRA_DO_DTO = {
  modo: ModoDeDeliberacao.atoIndividual,
  integrantes: 1,
  suplentes: 0,
};

describe('bancaRequeridaDe', () => {
  it('leva o tipo, as categorias atendidas e a regra da banca da fase', () => {
    const dto = {
      tipoBancaOrigemId: 'tipo-1',
      candidatosAtendidos: [{ categoriaDocumentoOrigemId: 'categoria-1' }],
      regraDeDeliberacao: REGRA_DO_DTO,
    } as unknown as BancaRequeridaDto;

    expect(bancaRequeridaDe(dto)).toEqual({
      tipoBancaId: 'tipo-1',
      categoriasDocumentoIds: ['categoria-1'],
      regraDeDeliberacao: expect.objectContaining({ modo: ATO_INDIVIDUAL.modo }),
    });
  });
});

describe('bancaDaEtapaDe', () => {
  it('leva o tipo e a regra da banca da etapa', () => {
    const dto = {
      tipoBancaOrigemId: 'tipo-2',
      regraDeDeliberacao: REGRA_DO_DTO,
    } as unknown as BancaDaEtapaDto;

    expect(bancaDaEtapaDe(dto)).toEqual({
      tipoBancaId: 'tipo-2',
      regraDeDeliberacao: expect.objectContaining({ modo: ATO_INDIVIDUAL.modo }),
    });
  });
});
