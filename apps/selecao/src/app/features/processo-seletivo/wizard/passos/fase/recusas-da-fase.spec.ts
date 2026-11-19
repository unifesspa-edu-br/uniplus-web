import { describe, expect, it } from 'vitest';

import type { ProblemDetails } from '@uniplus/shared-core/http';

import { traduzirRecusa } from './recusas-da-fase';

describe('tradução das recusas do domínio', () => {
  function recusa(erros: readonly { field: string; code: string }[]): ProblemDetails {
    return {
      type: 'about:blank',
      title: 'Configuração recusada',
      status: 422,
      code: 'uniplus.selecao.processo_seletivo.cronograma_invalido',
      traceId: '00000000000000000000000000000001',
      errors: erros.map((erro) => ({ ...erro, message: 'detalhe do servidor' })),
    };
  }

  const nomeDaFase = (indice: number): string => (indice === 0 ? 'Avaliação' : 'Recursos');

  it('leva a recusa da fase aberta para o campo que ela nomeia', () => {
    const traduzida = traduzirRecusa(
      recusa([
        {
          field: 'fases[0].regraRecurso',
          code: 'uniplus.selecao.regra_recurso_fase.prazo_em_dias_corridos',
        },
      ]),
      0,
      nomeDaFase,
    );

    expect(traduzida.porCampo.get('recurso.prazo')).toContain('dias corridos não é aceito');
    expect(traduzida.gerais).toEqual([]);
  });

  /**
   * Apontar no controle à vista uma recusa que é de outra fase mandaria
   * corrigir o que não está errado.
   */
  it('manda ao resumo, nomeando a fase, a recusa que é de outra', () => {
    const traduzida = traduzirRecusa(
      recusa([
        {
          field: 'fases[1].faseConcluinteCodigo',
          code: 'uniplus.selecao.processo_seletivo.conclusao_nao_declarada',
        },
      ]),
      0,
      nomeDaFase,
    );

    expect(traduzida.porCampo.size).toBe(0);
    expect(traduzida.gerais[0]).toContain('Na fase Recursos');
  });

  it('manda a recusa da unidade ao resumo, orientando a corrigi-la no Cronograma', () => {
    const traduzida = traduzirRecusa(
      recusa([
        {
          field: '$.fases[1].unidadeResponsavelId',
          code: 'uniplus.selecao.fase_cronograma.unidade_responsavel_nao_encontrada',
        },
      ]),
      0,
      nomeDaFase,
    );

    expect(traduzida.porCampo.size).toBe(0);
    expect(traduzida.gerais).toEqual([
      'Na fase Recursos: a unidade desta fase saiu do cadastro. Corrija a unidade da fase no passo Cronograma.',
    ]);
  });

  it('traduz a recusa da âncora que não é preliminar da própria fase', () => {
    const traduzida = traduzirRecusa(
      recusa([
        {
          field: 'fases[0].regraRecurso.atoAncoraCodigo',
          code: 'uniplus.selecao.regra_recurso_fase.ancora_nao_eh_produto_preliminar_da_fase',
        },
      ]),
      0,
      nomeDaFase,
    );

    expect(traduzida.porCampo.get('recurso.ancora')).toContain('esta própria fase');
  });

  it('traduz a recusa do recorte obrigatório entre bancas do mesmo tipo', () => {
    const traduzida = traduzirRecusa(
      recusa([
        {
          field: 'fases[0].bancasRequeridas[1]',
          code: 'uniplus.selecao.banca_requerida.recorte_de_competencia_obrigatorio',
        },
      ]),
      0,
      nomeDaFase,
    );

    expect(traduzida.porCampo.get('bancasRequeridas')).toContain(
      'categorias de documento que julga',
    );
  });

  /** Esconder a recusa seria pior do que exibi-la genérica. */
  it('manda ao resumo o código que ainda não tem tradução', () => {
    const traduzida = traduzirRecusa(
      recusa([{ field: 'fases[0]', code: 'uniplus.selecao.fase_cronograma.codigo_inventado' }]),
      0,
      nomeDaFase,
    );

    expect(traduzida.gerais).toEqual(['Configuração recusada']);
  });

  it('devolve o título quando a recusa não traz campo algum', () => {
    const semCampos: ProblemDetails = {
      type: 'about:blank',
      title: 'Processo não está em rascunho',
      status: 409,
      code: 'uniplus.selecao.processo_seletivo.mutacao_nao_permitida',
      traceId: '00000000000000000000000000000002',
    };

    expect(traduzirRecusa(semCampos, 0, nomeDaFase).gerais).toEqual([
      'Processo não está em rascunho',
    ]);
  });

  describe('regra de deliberação da banca', () => {
    const PREFIXO = 'uniplus.selecao.banca.';

    it('leva a recusa ao campo da regra que o caminho aponta, na posição da banca', () => {
      const traduzida = traduzirRecusa(
        recusa([
          {
            field: 'fases[0].bancasRequeridas[1].regraDeDeliberacao.quorum',
            code: `${PREFIXO}quorum_fora_do_intervalo`,
          },
        ]),
        0,
        nomeDaFase,
      );

      expect(traduzida.porCampo.get('bancasRequeridas.1.quorum')).toContain('entre 1 e o número');
      expect(traduzida.gerais).toEqual([]);
    });

    it('leva ao campo da tabela a recusa cujo caminho aponta só a banca', () => {
      const traduzida = traduzirRecusa(
        recusa([
          {
            field: 'fases[0].bancasRequeridas[0]',
            code: `${PREFIXO}regra_de_deliberacao_obrigatoria`,
          },
        ]),
        0,
        nomeDaFase,
      );

      expect(traduzida.porCampo.get('bancasRequeridas.0.regra')).toContain('Declare a regra');
    });

    it('mostra o mínimo de integrantes que só vem na mensagem do servidor', () => {
      const problema = recusa([
        {
          field: 'fases[0].bancasRequeridas[0].regraDeDeliberacao.integrantes',
          code: `${PREFIXO}integrantes_abaixo_do_minimo`,
        },
      ]);
      const erro = problema.errors?.[0];
      const comMinimo = {
        ...problema,
        errors: [{ ...erro, message: 'A banca precisa de 3 integrantes.' }],
      } as ProblemDetails;

      expect(
        traduzirRecusa(comMinimo, 0, nomeDaFase).porCampo.get('bancasRequeridas.0.integrantes'),
      ).toBe('A banca precisa de 3 integrantes.');
    });

    it('manda ao resumo, nomeando a fase, a recusa da regra de outra fase', () => {
      const traduzida = traduzirRecusa(
        recusa([
          {
            field: 'fases[1].bancasRequeridas[0].regraDeDeliberacao.criterio',
            code: `${PREFIXO}criterio_obrigatorio`,
          },
        ]),
        0,
        nomeDaFase,
      );

      expect(traduzida.porCampo.size).toBe(0);
      expect(traduzida.gerais[0]).toContain('Na fase Recursos');
      expect(traduzida.gerais[0]).toContain('critério');
    });

    it('leva ao campo das bancas a recusa do recorte em banca de recursos', () => {
      const traduzida = traduzirRecusa(
        recusa([
          {
            field: 'fases[0].bancasRequeridas[0]',
            code: `${PREFIXO}recorte_em_banca_de_recursos`,
          },
        ]),
        0,
        nomeDaFase,
      );

      expect(traduzida.porCampo.get('bancasRequeridas')).toContain('tire o recorte');
    });
  });
});
