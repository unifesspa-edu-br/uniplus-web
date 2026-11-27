import {
  apresentacaoDoCampo,
  conteudoInicial,
  REGRAS_INICIAIS,
  type ConteudoDoFormulario,
  type ItemDoFormulario,
} from '@uniplus/shared-inscricao/formulario';

import { describe, expect, it } from 'vitest';

import { ordemDeGravacao } from './ordem-de-gravacao';

const item = (
  fatoCodigo: string,
  ordem: number,
  extra: Partial<ItemDoFormulario> = {},
): ItemDoFormulario => ({
  fatoCodigo,
  ordem,
  paginaCodigo: null,
  apresentacao: apresentacaoDoCampo(fatoCodigo, 'SIM_OU_NAO'),
  regras: REGRAS_INICIAIS,
  ...extra,
});

const com = (...itens: ItemDoFormulario[]): ConteudoDoFormulario => ({
  ...conteudoInicial(),
  itens,
});
const citando = (fato: string) => ({
  regras: { ...REGRAS_INICIAIS, exibicao: [[{ fato, operador: 'IGUAL', valor: 'true' }]] },
});

const formulario = (
  codigo: string,
  servidor: ConteudoDoFormulario | null,
  desejado: ConteudoDoFormulario,
  daInscricao = false,
) => ({ codigo, daInscricao, servidor, desejado });

describe('a ordem em que os formulários gravam', () => {
  it('sem dependência entre eles, vale a ordem recebida', () => {
    expect(
      ordemDeGravacao([
        formulario('HABILITACAO', null, com(item('LAUDO', 0))),
        formulario('INSCRICAO', com(), com(item('PCD', 0)), true),
      ]),
    ).toEqual(['HABILITACAO', 'INSCRICAO']);
  });

  it('o fato que muda de formulário sai do que o perde antes de entrar no que o ganha', () => {
    expect(
      ordemDeGravacao([
        formulario('INSCRICAO', com(), com(item('RENDA', 0)), true),
        formulario('ISENCAO_TAXA', com(item('RENDA', 0)), com()),
      ]),
    ).toEqual(['ISENCAO_TAXA', 'INSCRICAO']);
  });

  it('a inscrição que ganha um fato grava antes do formulário que passa a citá-lo', () => {
    expect(
      ordemDeGravacao([
        formulario('ISENCAO_TAXA', com(item('BOLSA', 0)), com(item('BOLSA', 0, citando('PCD')))),
        formulario('INSCRICAO', com(), com(item('PCD', 0)), true),
      ]),
    ).toEqual(['INSCRICAO', 'ISENCAO_TAXA']);
  });

  it('a inscrição que perde um fato citado no servidor por outro formulário grava depois dele', () => {
    expect(
      ordemDeGravacao([
        formulario('INSCRICAO', com(item('PCD', 0)), com(), true),
        formulario('HABILITACAO', com(item('LAUDO', 0, citando('PCD'))), com(item('LAUDO', 0))),
      ]),
    ).toEqual(['HABILITACAO', 'INSCRICAO']);
  });

  it('dependências em ciclo seguem na ordem recebida, e a recusa da API aponta o conflito', () => {
    expect(
      ordemDeGravacao([
        formulario('A', com(item('X', 0)), com(item('Y', 0))),
        formulario('B', com(item('Y', 0)), com(item('X', 0))),
      ]),
    ).toEqual(['A', 'B']);
  });
});
