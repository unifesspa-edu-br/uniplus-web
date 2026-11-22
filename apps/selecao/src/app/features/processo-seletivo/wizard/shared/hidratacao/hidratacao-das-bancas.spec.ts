import { ModoDeDeliberacao, type ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { ATO_INDIVIDUAL } from '../deliberacao/regra-de-deliberacao.testing';
import { bancaDaEtapaDe, bancaRequeridaDe } from './hidratacao-das-bancas';

type BancaRequeridaDto = ProcessoSeletivoDto['cronogramaFases'][number]['bancasRequeridas'][number];
type BancaDaEtapaDto = ProcessoSeletivoDto['etapas'][number]['bancas'][number];

const REGRA_DO_DTO = {
  modo: { codigo: ModoDeDeliberacao.atoIndividual, rotulo: 'Individual' },
  integrantes: 1,
  suplentes: 0,
};

describe('bancaRequeridaDe', () => {
  it('leva o tipo, as categorias atendidas e a regra da banca da fase', () => {
    const dto = {
      id: 'banca-1',
      tipoBancaOrigemId: 'tipo-1',
      codigo: { codigo: 'BANCA_ENTREVISTA', rotulo: 'Banca de entrevista' },
      papel: { codigo: 'AVALIA_O_MERITO', rotulo: 'Avalia o mérito' },
      exigeDuasOuMaisBancas: false,
      encerraRecursoNaPrimeiraInstancia: false,
      candidatosAtendidos: [{ categoriaDocumentoOrigemId: 'categoria-1' }],
      regraDeDeliberacao: REGRA_DO_DTO,
    } as unknown as BancaRequeridaDto;

    expect(bancaRequeridaDe(dto)).toMatchObject({
      id: 'banca-1',
      identificadorLocal: 'banca-banca-1',
      tipoBancaId: 'tipo-1',
      categoriasDocumentoIds: ['categoria-1'],
      regraDeDeliberacao: expect.objectContaining({ modo: ATO_INDIVIDUAL.modo }),
    });
  });
});

describe('bancaDaEtapaDe', () => {
  it('leva o tipo e a regra da banca da etapa', () => {
    const dto = {
      id: 'banca-2',
      tipoBancaOrigemId: 'tipo-2',
      codigo: { codigo: 'BANCA_ENTREVISTA', rotulo: 'Banca de entrevista' },
      papel: { codigo: 'AVALIA_O_MERITO', rotulo: 'Avalia o mérito' },
      exigeDuasOuMaisBancas: false,
      encerraRecursoNaPrimeiraInstancia: false,
      regraDeDeliberacao: REGRA_DO_DTO,
    } as unknown as BancaDaEtapaDto;

    expect(bancaDaEtapaDe(dto)).toMatchObject({
      id: 'banca-2',
      identificadorLocal: 'banca-banca-2',
      copiaDoTipo: expect.objectContaining({ rotulo: 'Banca de entrevista' }),
      tipoBancaId: 'tipo-2',
      regraDeDeliberacao: expect.objectContaining({ modo: ATO_INDIVIDUAL.modo }),
    });
  });
});
