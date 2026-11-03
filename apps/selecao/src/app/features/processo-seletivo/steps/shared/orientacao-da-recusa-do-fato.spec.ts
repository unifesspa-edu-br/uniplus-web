import { describe, expect, it } from 'vitest';

import { recusaDaExigenciaDoServidor } from './orientacao-da-recusa-do-fato';

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
