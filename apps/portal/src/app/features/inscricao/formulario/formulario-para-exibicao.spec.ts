import { describe, expect, it } from 'vitest';
import { TipoRenderizacaoCodigo } from '@uniplus/shared-data/selecao';
import { formularioParaExibicao } from './formulario-para-exibicao';
import {
  campoColetado,
  comCampoColetado,
  FORMULARIO_DE_INSCRICAO_MOCK,
} from './inscricao-do-candidato.testing';

describe('formulário para exibição', () => {
  it.each([
    [TipoRenderizacaoCodigo.SIM_OU_NAO, 'SIM_OU_NAO'],
    [TipoRenderizacaoCodigo.ESCOLHA_UNICA, 'ESCOLHA_UNICA'],
    [TipoRenderizacaoCodigo.ESCOLHA_MULTIPLA, 'ESCOLHA_MULTIPLA'],
  ])('apresenta o controle correspondente a %s', (tipo, controle) => {
    const formulario = comCampoColetado(
      FORMULARIO_DE_INSCRICAO_MOCK,
      campoColetado('PERGUNTA', 'Pergunta', tipo),
    ).formulario;

    const exibido = formularioParaExibicao(formulario);
    expect(
      exibido.coleta.itens.find((campo) => campo.fatoCodigo === 'PERGUNTA')?.apresentacao
        .tipoRenderizacao,
    ).toBe(controle);
    expect(
      formulario.coleta.itens.find((campo) => campo.fatoCodigo === 'PERGUNTA')?.apresentacao
        .tipoRenderizacao,
    ).toBe(tipo);
  });
});
