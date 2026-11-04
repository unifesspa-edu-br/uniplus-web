import { describe, expect, it } from 'vitest';

import { camposSemValoresOfertados, problemasDoFormulario } from './problemas-do-formulario';
import {
  ID_TITULO,
  item,
  inscricaoGravada,
  formularioCom,
  exigenciaCom,
  rascunhoCom,
  NENHUMA_EXIGENCIA,
} from './formulario-de-inscricao.testing';

describe('o que impede gravar o formulário', () => {
  const FASES_VIVAS = new Set(['INSCRICAO', 'HABILITACAO']);

  it('cobra a política quando alguma exigência condiciona por idade', () => {
    const problemas = problemasDoFormulario(
      formularioCom(inscricaoGravada()),
      rascunhoCom(
        exigenciaCom(ID_TITULO, [{ fato: 'FAIXA_ETARIA', operador: 'MAIOR_IGUAL', valor: '18' }]),
      ),
      FASES_VIVAS,
    );

    expect(problemas).toContainEqual(expect.stringContaining('idade'));
  });

  it('acusa a apuração ancorada em fase que saiu do cronograma', () => {
    const problemas = problemasDoFormulario(
      formularioCom(inscricaoGravada(), {
        referenciaTemporal: { tipo: 'INICIO_FASE', data: '', faseCodigo: 'RECURSOS' },
      }),
      NENHUMA_EXIGENCIA,
      FASES_VIVAS,
    );

    expect(problemas).toContainEqual(expect.stringContaining('não está no cronograma'));
  });

  it('cobra o rótulo que o candidato vai ler, também nos campos de grupo', () => {
    const problemas = problemasDoFormulario(
      formularioCom(inscricaoGravada({ itens: [item('PCD', 0, 'S1', { rotulo: '  ' })] })),
      NENHUMA_EXIGENCIA,
      FASES_VIVAS,
    );

    expect(problemas).toContainEqual(expect.stringContaining('rótulo'));
  });
});

describe('campos cujo domínio sai da oferta de atendimento', () => {
  const semOferta = { condicoes: [], recursos: [], tiposDeficiencia: [] };
  const comCampos = (...campos: readonly [string, string][]) =>
    formularioCom(
      inscricaoGravada({
        itens: campos.map(([codigo, tipo], i) => item(codigo, i, 'S1', { tipoRenderizacao: tipo })),
      }),
    );

  it('acusa a condição de atendimento sem valor nenhum ofertado, e não o tipo de deficiência, que vem do cadastro', () => {
    const formulario = comCampos(
      ['TIPO_DEFICIENCIA', 'SELECAO_UNICA'],
      ['CONDICAO_ATENDIMENTO', 'SELECAO_UNICA'],
    );

    expect(camposSemValoresOfertados(formulario, semOferta)).toEqual(['a condição de atendimento']);
  });

  it('acusa o recurso de acessibilidade perguntado como seleção com a oferta sem recursos', () => {
    const formulario = comCampos(['RECURSO_ACESSIBILIDADE', 'SELECAO_MULTIPLA']);

    expect(camposSemValoresOfertados(formulario, semOferta)).toEqual([
      'o recurso de acessibilidade',
    ]);
  });

  it('cala o recurso de acessibilidade com ao menos um recurso ofertado, ou fora de seleção', () => {
    const comRecurso = { ...semOferta, recursos: [{ id: 'r1', codigo: 'LIBRAS', nome: 'Libras' }] };

    expect(
      camposSemValoresOfertados(
        comCampos(['RECURSO_ACESSIBILIDADE', 'SELECAO_MULTIPLA']),
        comRecurso,
      ),
    ).toEqual([]);
    expect(
      camposSemValoresOfertados(comCampos(['RECURSO_ACESSIBILIDADE', 'TEXTO']), semOferta),
    ).toEqual([]);
  });

  it('acusa também o campo perguntado em outro formulário do processo', () => {
    const habilitacao = inscricaoGravada({
      itens: [item('CONDICAO_ATENDIMENTO', 0, 'S1', { tipoRenderizacao: 'SELECAO_MULTIPLA' })],
    });
    const formulario = {
      ...comCampos(),
      outrasFinalidades: [
        { finalidade: 'HABILITACAO', faseCodigo: 'HABILITACAO', conteudo: habilitacao },
      ],
    };

    expect(camposSemValoresOfertados(formulario, semOferta)).toEqual(['a condição de atendimento']);
  });

  it('cala quando a oferta declara ao menos um valor, ou quando o campo não é de seleção', () => {
    const comOferta = { ...semOferta, condicoes: [{ id: 'c1', codigo: 'PCD', nome: 'PcD' }] };

    expect(
      camposSemValoresOfertados(comCampos(['CONDICAO_ATENDIMENTO', 'SELECAO_UNICA']), comOferta),
    ).toEqual([]);
    expect(
      camposSemValoresOfertados(comCampos(['CONDICAO_ATENDIMENTO', 'TEXTO']), semOferta),
    ).toEqual([]);
  });
});
