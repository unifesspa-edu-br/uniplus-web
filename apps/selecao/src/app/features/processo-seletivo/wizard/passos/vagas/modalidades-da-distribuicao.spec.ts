import { RegraRemanejamentoModalidadeCodigo } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { distribuicaoFederal } from './cascata-remanejamento.testing';
import {
  modalidadesDoRol,
  modalidadesGravadasPorId,
  nomeDaModalidade,
  rotuloDaModalidade,
  rotulosPorCodigo,
} from './modalidades-da-distribuicao';
import { modalidade } from './distribuicao-de-vagas.testing';

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
    const oferta = distribuicaoFederal([{ id: 'modalidade', codigo: 'LB_PPI', nome: '', gravada }]);
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

describe('rótulo da modalidade', () => {
  const ALFA = modalidade({ id: 'm-alfa', codigo: 'ZZ_TESTE', nome: 'Modalidade de teste Alfa' });
  const SEM_NOME = modalidade({ id: 'm-sem-nome', codigo: 'ZZ_SEM_NOME', nome: '' });
  const rotulos = rotulosPorCodigo(
    new Map([
      [ALFA.id, ALFA],
      [SEM_NOME.id, SEM_NOME],
    ]),
  );

  it('junta o código e o nome', () => {
    expect(rotuloDaModalidade(rotulos, 'ZZ_TESTE')).toBe('ZZ_TESTE — Modalidade de teste Alfa');
  });

  it('mostra só o código quando a modalidade não tem nome', () => {
    expect(rotuloDaModalidade(rotulos, 'ZZ_SEM_NOME')).toBe('ZZ_SEM_NOME');
  });

  it('mostra só o código quando o catálogo não conhece a modalidade', () => {
    expect(rotuloDaModalidade(rotulos, 'ZZ_DESCONHECIDA')).toBe('ZZ_DESCONHECIDA');
  });
});

describe('nome da modalidade', () => {
  it('prefere o nome gravado ao do catálogo vivo', () => {
    expect(nomeDaModalidade('Nome gravado', 'Nome vivo')).toBe('Nome gravado');
  });

  it.each([undefined, '', '  '])('usa o catálogo quando o nome gravado é %j', (gravado) => {
    expect(nomeDaModalidade(gravado, 'Nome vivo')).toBe('Nome vivo');
  });

  it('fica vazio quando nenhum dos dois traz o nome', () => {
    expect(nomeDaModalidade(undefined, undefined)).toBe('');
  });

  it('o catálogo completa o nome que o rascunho não tem', () => {
    const oferta = distribuicaoFederal([
      {
        id: 'modalidade',
        codigo: 'LB_PPI',
        nome: '',
        gravada: { ...GRAVADA, regraRemanejamento: null },
      },
    ]);
    const vigente = modalidade({ id: 'modalidade', codigo: 'LB_PPI', nome: 'Nome vivo' });

    const modalidades = modalidadesGravadasPorId([oferta], new Map([['modalidade', vigente]]));

    expect(modalidades.get('modalidade')?.nome).toBe('Nome vivo');
  });
});
