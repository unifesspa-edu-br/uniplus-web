import { ProblemDetails } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';

import { comExtensoesDePublicacao, eErroDeDocumentoOuAto } from './problemas-da-publicacao';

describe('eErroDeDocumentoOuAto', () => {
  it('reconhece as recusas dos anexos do edital', () => {
    expect(eErroDeDocumentoOuAto('uniplus.selecao.anexo_do_edital.nao_confirmado')).toBe(true);
    expect(eErroDeDocumentoOuAto('uniplus.selecao.anexo_do_edital.nome_invalido')).toBe(true);
  });

  it('reconhece os códigos nomeados que nenhum dos dois checklists cobre', () => {
    expect(
      eErroDeDocumentoOuAto('uniplus.selecao.processo_seletivo.documento_nao_confirmado'),
    ).toBe(true);
    expect(
      eErroDeDocumentoOuAto('uniplus.selecao.processo_seletivo.documento_do_edital_nao_e_pdf'),
    ).toBe(true);
    expect(
      eErroDeDocumentoOuAto('uniplus.selecao.processo_seletivo.tipo_de_ato_sem_versao_vigente'),
    ).toBe(true);
  });

  it('não reconhece código de conformidade estrutural nem legal', () => {
    expect(
      eErroDeDocumentoOuAto('uniplus.selecao.processo_seletivo.conformidade_insuficiente'),
    ).toBe(false);
    expect(
      eErroDeDocumentoOuAto('uniplus.selecao.processo_seletivo.conformidade_legal_insuficiente'),
    ).toBe(false);
  });
});

describe('comExtensoesDePublicacao', () => {
  it('expõe pendencias e obrigatoriedadesReprovadas quando presentes no body', () => {
    const problem: ProblemDetails = {
      type: 'about:blank',
      title: 'x',
      status: 422,
      code: 'uniplus.selecao.processo_seletivo.conformidade_insuficiente',
      traceId: 't',
    };
    const comExtensoes = {
      ...problem,
      pendencias: [{ codigo: 'a', dimensao: 'taxa_inscricao', mensagem: 'x' }],
    };

    const resultado = comExtensoesDePublicacao(comExtensoes);
    expect(resultado.pendencias).toEqual(comExtensoes.pendencias);
    expect(resultado.obrigatoriedadesReprovadas).toBeUndefined();
  });
});
