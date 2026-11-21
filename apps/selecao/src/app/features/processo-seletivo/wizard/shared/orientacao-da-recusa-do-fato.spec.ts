import { describe, expect, it } from 'vitest';

import {
  orientacaoDaRecusaDaRepeticao,
  orientacaoDaRecusaDeFase,
  recusaDaExigenciaDoServidor,
} from './orientacao-da-recusa-do-fato';
import {
  type LugarDaExigencia,
  type ProducaoDosFatos,
  recusaDaRepeticao,
  recusaDeFaseDoGatilho,
} from './producao-dos-fatos';
import {
  COM_HABILITACAO,
  FASE_DIVIDIDA,
  familiaNa,
  FASES,
  formulario,
  na,
  NOMES,
  producao,
} from './producao-dos-fatos.testing';

describe('a recusa do servidor sobre onde o documento é cobrado', () => {
  const recusa = (
    code: string,
    errors: readonly { field: string; code: string; message: string }[] = [],
  ) => recusaDaExigenciaDoServidor({ code, errors });

  it('diz o que fazer quando a repetição nomeia grupo que não existe ou se aninha', () => {
    expect(recusa('uniplus.selecao.no_exigencia.tipo_entidade_invalido')).toContain(
      'campo “Repetir por”',
    );
    expect(recusa('uniplus.selecao.no_exigencia.repeticao_de_entidade_aninhada')).toContain(
      'Escolha “Não repete”',
    );
    expect(recusa('uniplus.predicado_dnf.fato_nao_coletado_pelo_processo')).toContain(
      'Escolha o grupo no campo “Repetir por”',
    );
  });

  it('diz o que fazer para cada recusa de fase, e nada para as outras', () => {
    expect(recusa('uniplus.selecao.documento_exigido.fato_resolvido_em_fase_posterior')).toContain(
      'Exija o documento numa fase em que o dado já seja conhecido',
    );
    expect(
      recusa('uniplus.selecao.documento_exigido.fato_da_isencao_em_outra_finalidade'),
    ).toContain('Escolha o formulário de isenção no campo “Formulário” do documento');
    expect(
      recusa('uniplus.selecao.documento_exigido.ponto_resolucao_fora_do_cronograma'),
    ).toContain('Acrescente essa fase ao cronograma');
    expect(recusa('uniplus.selecao.documento_exigido.outra')).toBeNull();
  });

  it('diz que o tipo de documento que aguarda a proteção de dados não aceita vínculo', () => {
    expect(
      recusa('uniplus.selecao.documento_exigido.tipo_documento_com_protecao_pendente'),
    ).toContain('aguarda a aprovação da proteção de dados');
  });

  it('as recusas do formulário do documento apontam o campo “Formulário”, venham no problema ou num erro dele', () => {
    const CAMPO = 'no campo “Formulário” do documento';
    expect(recusa('uniplus.selecao.documento_exigido.finalidade_obrigatoria')).toContain(CAMPO);
    expect(recusa('uniplus.selecao.documento_exigido.fase_incoerente_com_finalidade')).toContain(
      CAMPO,
    );
    expect(recusa('uniplus.selecao.no_exigencia.grupo_com_finalidades_diferentes')).toContain(
      CAMPO,
    );
    expect(
      recusa('uniplus.validacao', [
        {
          field: 'raizes[0].documento.finalidade',
          code: 'uniplus.estrutura_formulario.finalidade_invalida',
          message: '',
        },
      ]),
    ).toContain(CAMPO);
  });
});

describe('a orientação da recusa de fase', () => {
  const orientar = (
    codigo: string,
    lugar: LugarDaExigencia,
    contexto: ProducaoDosFatos,
  ): string => {
    const recusa = recusaDeFaseDoGatilho(codigo, lugar, contexto);
    if (recusa === null) throw new Error('esperava recusa');
    return orientacaoDaRecusaDeFase(recusa, lugar, contexto, NOMES);
  };

  it('propõe levar a exigência para a fase do fato ou levar o campo para a inscrição', () => {
    expect(orientar('LAUDO_RECENTE', na('INSCRICAO'), COM_HABILITACAO)).toBe(
      '“laudo_recente” só é conhecido na fase habilitacao, depois da fase em que o documento é exigido. ' +
        'Como resolver: exija o documento na fase habilitacao; ou colete “laudo_recente” no formulário de inscrição.',
    );
  });

  it('não propõe mudar de formulário o fato que o catálogo situa depois da exigência', () => {
    expect(orientar('MODALIDADE_CONVOCACAO', na('INSCRICAO'), producao())).toBe(
      '“modalidade_convocacao” só é conhecido na fase resultado_final, depois da fase em que o documento é exigido. ' +
        'Como resolver: exija o documento na fase resultado_final ou em fase posterior.',
    );
  });

  it('do fato só da isenção, propõe a fase da isenção e a coleta pela inscrição quando ela vem antes', () => {
    const comIsencao = producao({
      formularios: [
        formulario('INSCRICAO', 'INSCRICAO', 'PCD'),
        formulario('ISENCAO_TAXA', 'SOLICITACAO_ISENCAO', 'BAIXA_RENDA'),
      ],
    });

    expect(orientar('BAIXA_RENDA', na('HABILITACAO'), comIsencao)).toBe(
      '“baixa_renda” vem do formulário de isenção e só condiciona documento apresentado nele, que se responde na fase solicitacao_isencao. ' +
        'Como resolver: exija o documento na fase solicitacao_isencao; ou colete “baixa_renda” no formulário de inscrição.',
    );
  });

  it('na fase dividida, propõe o formulário de isenção da mesma fase, e não a fase inteira', () => {
    expect(orientar('BAIXA_RENDA', na('INSCRICAO', 'INSCRICAO'), FASE_DIVIDIDA)).toBe(
      '“baixa_renda” vem do formulário de isenção e só condiciona documento apresentado nele, que se responde na fase inscricao. ' +
        'Como resolver: exija o documento no formulário de isenção da taxa de inscrição, na fase inscricao; ou colete “baixa_renda” no formulário de inscrição.',
    );
  });

  it('não propõe levar o campo para formulário em que ele também seria recusado', () => {
    const tresFormularios = producao({
      formularios: [
        formulario('INSCRICAO', 'INSCRICAO', 'PCD'),
        formulario('ISENCAO_TAXA', 'SOLICITACAO_ISENCAO'),
        formulario('HABILITACAO', 'HABILITACAO', 'LAUDO_RECENTE'),
      ],
    });

    const orientacao = orientar('LAUDO_RECENTE', na('RESULTADO_FINAL'), tresFormularios);

    expect(orientacao).toContain('colete “laudo_recente” no formulário de inscrição');
    expect(orientacao).not.toContain('formulário de isenção da taxa de inscrição');
  });

  it('sem fase que o aceite, propõe acrescentar ao cronograma a fase em que o fato é conhecido', () => {
    const semResultado = producao({
      fases: FASES.filter((fase) => fase.codigo !== 'RESULTADO_FINAL'),
    });

    expect(orientar('MODALIDADE_CONVOCACAO', na('HABILITACAO'), semResultado)).toBe(
      '“modalidade_convocacao” só é conhecido na fase resultado_final, que o cronograma não tem. ' +
        'Como resolver: acrescente ao cronograma a fase resultado_final e exija o documento nela ou em fase posterior.',
    );
  });
});

describe('a orientação da recusa da repetição do documento por grupo', () => {
  it('nomeia o grupo e leva o documento para onde ele é respondido', () => {
    const naHabilitacao = familiaNa('HABILITACAO', 'HABILITACAO');
    const recusa = recusaDaRepeticao('FAMILIA', na('INSCRICAO'), naHabilitacao);

    expect(recusa === null ? '' : orientacaoDaRecusaDaRepeticao(recusa, naHabilitacao, NOMES)).toBe(
      'O grupo “Composição familiar” é respondido na fase habilitacao, depois da fase em que o documento é exigido. ' +
        'Como resolver: exija o documento na fase habilitacao; ou escolha outro grupo em “Repetir por”, ou “Não repete”.',
    );
  });
});
