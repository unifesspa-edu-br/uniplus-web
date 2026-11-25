import { RegraRemanejamentoModalidadeCodigo } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { distribuicaoFederal } from './cascata-remanejamento.testing';
import { modalidadesDoRol, modalidadesGravadasPorId } from './modalidades-da-distribuicao';

const GRAVADA = {
  descricao: null,
  composicaoVagas: null,
  composicaoOrigemCodigo: null,
  remanejamentoDestino: null,
  remanejamentoPar: null,
  remanejamentoFallback: null,
};

describe('modalidadesGravadasPorId', () => {
  it.each([
    'SegueOrdemDeRemanejamento',
    RegraRemanejamentoModalidadeCodigo.SEGUE_ORDEM_DE_REMANEJAMENTO,
  ])('reconhece a regra gravada %s', (regraRemanejamento) => {
    const gravada = { ...GRAVADA, regraRemanejamento };
    const oferta = distribuicaoFederal([{ id: 'modalidade', codigo: 'LB_PPI', gravada }]);
    const modalidades = modalidadesGravadasPorId([oferta], new Map());
    expect(modalidades.get('modalidade')?.regraRemanejamento).toBe(
      RegraRemanejamentoModalidadeCodigo.SEGUE_ORDEM_DE_REMANEJAMENTO,
    );
  });
});

describe('modalidadesDoRol', () => {
  const CATALOGO_COMPLETO = [{ codigo: 'AC' }, { codigo: 'AC_I' }, { codigo: 'AC_Q' }];

  it('devolve o catálogo inteiro quando o rol é aberto (null)', () => {
    expect(modalidadesDoRol(CATALOGO_COMPLETO, null)).toEqual(CATALOGO_COMPLETO);
  });

  it('restringe ao rol fechado, na ordem do catálogo', () => {
    expect(modalidadesDoRol(CATALOGO_COMPLETO, ['AC_I', 'AC_Q']).map((m) => m.codigo)).toEqual([
      'AC_I',
      'AC_Q',
    ]);
  });

  it('devolve vazio quando nenhuma modalidade do catálogo está no rol', () => {
    expect(modalidadesDoRol(CATALOGO_COMPLETO, ['AC_PCD'])).toEqual([]);
  });
});
