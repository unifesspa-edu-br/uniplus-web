import {
  TipoDeDecisaoDoDocumento as Tipo,
  type DocumentoDaConfiguracaoProcedimentoDeRecurso,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import type { ProcedimentoDeRecurso } from '../../processo-seletivo.models';
import { tiposSemProcedimento } from './cobertura-dos-procedimentos';

const tipos = [Tipo.NOTA_DA_ETAPA, Tipo.CLASSIFICACAO];
const procedimento: DocumentoDaConfiguracaoProcedimentoDeRecurso = {
  tipoDeDecisao: Tipo.NOTA_DA_ETAPA,
  alvo: { itemDeAvaliacaoChave: 'item-inexistente' },
  regra: { codigo: 'FORA-DO-CATALOGO', versao: 'v9' },
};
const anterior: ProcedimentoDeRecurso = {
  tipoDeDecisao: Tipo.NOTA_DA_ETAPA,
  alvo: null,
  regraCodigo: 'FORA-DO-CATALOGO',
  regraVersao: 'v9',
  sugestao: null,
};

describe('orientação de cobertura por tipo', () => {
  it('avisa uma vez por tipo declarado na ordem recebida, sem modificar os dados', () => {
    const declarados = Object.freeze([...tipos, Tipo.NOTA_DA_ETAPA]);
    expect(tiposSemProcedimento(true, declarados, [])).toEqual(tipos);
    expect(declarados).toHaveLength(3);
  });

  it('não exige cobertura sem janela, mesmo quando há tipos declarados', () => {
    expect(tiposSemProcedimento(false, tipos, [])).toEqual([]);
  });

  it('considera presença por tipo sem afirmar validade do alvo ou da regra', () => {
    expect(tiposSemProcedimento(true, tipos, [procedimento])).toEqual([Tipo.CLASSIFICACAO]);
    expect(procedimento.alvo).toEqual({ itemDeAvaliacaoChave: 'item-inexistente' });
  });

  it.each([
    { formato: 'anterior', procedimentos: [anterior] },
    { formato: 'documento', procedimentos: [procedimento] },
    { formato: 'misto', procedimentos: [anterior, procedimento] },
  ])('considera o mesmo tipo no formato $formato', ({ procedimentos }) => {
    const recebidos = Object.freeze(procedimentos);
    expect(tiposSemProcedimento(true, tipos, recebidos)).toEqual([Tipo.CLASSIFICACAO]);
    expect(tiposSemProcedimento(false, tipos, recebidos)).toEqual([]);
    expect(recebidos).toEqual(procedimentos);
  });

  it('não cobra tipo não declarado e não altera os procedimentos importados', () => {
    const importados = Object.freeze([procedimento, procedimento]);
    expect(tiposSemProcedimento(true, [Tipo.CLASSIFICACAO], importados)).toEqual([
      Tipo.CLASSIFICACAO,
    ]);
    expect(tiposSemProcedimento(true, [], importados)).toEqual([]);
    expect(importados).toHaveLength(2);
  });
});
