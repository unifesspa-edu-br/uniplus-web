import type { ProblemDetails } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';

import {
  eErroDeDocumentoOuAto,
  motivoDeConformidadeLegalNaoAvaliavel,
} from './problemas-da-publicacao';

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

  it('reconhece as recusas de linhagem do ato, que Publicações repassa em 409', () => {
    expect(
      eErroDeDocumentoOuAto('uniplus.publicacoes.ato_normativo.objeto_ja_tem_ato_vivo_do_tipo'),
    ).toBe(true);
    expect(eErroDeDocumentoOuAto('uniplus.publicacoes.ato_normativo.ato_ja_retificado')).toBe(true);
  });

  it('não reconhece os códigos que a API deixou de emitir', () => {
    expect(
      eErroDeDocumentoOuAto('uniplus.selecao.processo_seletivo.objeto_ja_tem_ato_vivo_do_tipo'),
    ).toBe(false);
    expect(eErroDeDocumentoOuAto('uniplus.selecao.ato_do_processo.produto_aguarda_registro')).toBe(
      false,
    );
    expect(
      eErroDeDocumentoOuAto('uniplus.selecao.ato_do_processo.preliminar_aguarda_registro'),
    ).toBe(false);
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

describe('motivoDeConformidadeLegalNaoAvaliavel', () => {
  const SEM_JANELA = 'uniplus.selecao.processo_seletivo.fase_que_coleta_inscricao_sem_janela';

  const problema = (code: string, detail?: string): ProblemDetails => ({
    type: 'https://uniplus.unifesspa.edu.br/erros/conformidade',
    title: 'Não foi possível avaliar a conformidade.',
    status: 422,
    code,
    traceId: '',
    detail,
  });

  it('devolve o detalhe da recusa de pendência, sem os espaços das pontas', () => {
    expect(
      motivoDeConformidadeLegalNaoAvaliavel(problema(SEM_JANELA, '  A fase não tem janela.  ')),
    ).toBe('A fase não tem janela.');
  });

  it.each([
    ['ausente', undefined],
    ['vazio', ''],
    ['só espaços', '   '],
  ])('com o detalhe %s, devolve o título da recusa', (_, detalhe) => {
    expect(motivoDeConformidadeLegalNaoAvaliavel(problema(SEM_JANELA, detalhe))).toBe(
      'Não foi possível avaliar a conformidade.',
    );
  });

  it('devolve nulo para a recusa que é falha de carga, e não pendência', () => {
    expect(
      motivoDeConformidadeLegalNaoAvaliavel(
        problema('uniplus.selecao.processo_seletivo.conformidade_legal_insuficiente', 'Faltou.'),
      ),
    ).toBeNull();
  });
});
