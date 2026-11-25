import { describe, expect, it } from 'vitest';
import { TipoDeCampoCodigo } from '@uniplus/shared-data/selecao';
import { formularioParaExibicao } from './formulario-para-exibicao';
import {
  campoColetado,
  comCampoColetado,
  FORMULARIO_DE_INSCRICAO_MOCK,
} from './inscricao-do-candidato.testing';

describe('formulário para exibição', () => {
  it.each([
    [TipoDeCampoCodigo.SIM_OU_NAO, 'SIM_OU_NAO'],
    [TipoDeCampoCodigo.ESCOLHA_UNICA, 'ESCOLHA_UNICA'],
    [TipoDeCampoCodigo.ESCOLHA_MULTIPLA, 'ESCOLHA_MULTIPLA'],
  ])('apresenta o controle correspondente a %s', (tipo, controle) => {
    const formulario = comCampoColetado(
      FORMULARIO_DE_INSCRICAO_MOCK,
      campoColetado('PERGUNTA', 'Pergunta', tipo),
    ).formulario;

    const exibido = formularioParaExibicao(formulario);
    expect(
      exibido.coleta.itens.find((campo) => campo.fatoCodigo === 'PERGUNTA')?.apresentacao
        .tipoDeCampo,
    ).toBe(controle);
    expect(
      formulario.coleta.itens.find((campo) => campo.fatoCodigo === 'PERGUNTA')?.apresentacao
        .tipoDeCampo,
    ).toBe(tipo);
  });
});
