import { describe, expect, it } from 'vitest';

import { exigenciasDaFase, todasAsExigencias } from './consulta-das-exigencias';
import { exigenciasDe } from './leitura-das-exigencias';
import { modalidadesDaExigencia } from './recorte-por-modalidade';
import {
  ID_ETAPA_RENDA,
  ID_HABILITACAO,
  ID_ISENCAO,
  ID_RG,
  comando,
  detalheDaApi,
  exigenciaDaApi,
} from './exigencias.testing';

describe('Leitura e regravação das exigências de documentos', () => {
  /**
   * A perda central: a API guarda uma exigência por (documento, fase) e o rascunho as
   * achatava num registro por documento. Entrega, consequência e norma da segunda fase
   * voltavam com o valor da primeira, e a gravação seguinte reescrevia as duas iguais.
   */
  it('mantém separadas as duas exigências do mesmo documento em fases diferentes', () => {
    const isencao = exigenciaDaApi({
      exigidoNaFaseId: ID_ISENCAO,
      obrigatorio: true,
      consequenciaIndeferimento: 'ELIMINA',
    });
    const habilitacao = exigenciaDaApi({
      exigidoNaFaseId: ID_HABILITACAO,
      obrigatorio: false,
      consequenciaIndeferimento: null,
    });
    const lido = exigenciasDe(detalheDaApi([isencao, habilitacao]));

    const naIsencao = exigenciasDaFase(lido, 'ISENCAO');
    const naHabilitacao = exigenciasDaFase(lido, 'HABILITACAO');

    expect(naIsencao).toHaveLength(1);
    expect(naHabilitacao).toHaveLength(1);
    expect(naIsencao[0].obrigatorio).toBe(true);
    expect(naIsencao[0].consequenciaIndeferimento).toBe('ELIMINA');
    expect(naHabilitacao[0].obrigatorio).toBe(false);
    expect(naHabilitacao[0].consequenciaIndeferimento).toBe('');
  });

  /** As normas 2..N eram descartadas: a leitura lia só `basesLegais[0]`. */
  it('lê todas as normas da exigência, e a observação de cada uma', () => {
    const lido = exigenciasDe(
      detalheDaApi([
        exigenciaDaApi({
          basesLegais: [
            {
              id: 'b1',
              referencia: 'Lei 12.711/2012',
              abrangencia: 'FEDERAL',
              status: 'RESOLVIDO',
              observacao: 'cotas',
            },
            {
              id: 'b2',
              referencia: 'Edital 01/2027',
              abrangencia: 'INTERNA_EDITAL',
              status: 'PENDENTE',
              observacao: null,
            },
          ],
        }),
      ]),
    );

    const bases = exigenciasDaFase(lido, 'HABILITACAO')[0].basesLegais;
    expect(bases).toHaveLength(2);
    expect(bases[0]).toEqual({
      referencia: 'Lei 12.711/2012',
      abrangencia: 'FEDERAL',
      status: 'RESOLVIDO',
      observacao: 'cotas',
    });
    expect(bases[1].status).toBe('PENDENTE');
    expect(bases[1].observacao).toBeNull();
  });

  it('guarda a fase pelo código, não pelo identificador', () => {
    const lido = exigenciasDe(detalheDaApi([exigenciaDaApi()]));
    expect(todasAsExigencias(lido)[0].faseCodigo).toBe('HABILITACAO');
  });

  it('traz a etapa que coleta, quando declarada', () => {
    const lido = exigenciasDe(detalheDaApi([exigenciaDaApi({ exigidoNaEtapaId: ID_ETAPA_RENDA })]));
    expect(todasAsExigencias(lido)[0].etapaId).toBe(ID_ETAPA_RENDA);
  });

  it('reconstrói o recorte de modalidade a partir do gatilho', () => {
    const lido = exigenciasDe(
      detalheDaApi([
        exigenciaDaApi({
          aplicabilidade: 'CONDICIONAL',
          condicoes: [
            { id: 'c1', clausula: 1, fato: 'MODALIDADE', operador: 'EM', valor: '["LB_PPI"]' },
          ],
        }),
      ]),
    );

    expect(modalidadesDaExigencia(todasAsExigencias(lido)[0])).toEqual(['LB_PPI']);
  });

  it('descarta a exigência cuja fase não está no cronograma lido', () => {
    const lido = exigenciasDe(
      detalheDaApi([exigenciaDaApi({ exigidoNaFaseId: 'fase-desconhecida' })]),
    );
    expect(todasAsExigencias(lido)).toHaveLength(0);
  });

  /** O ida-e-volta completo: ler e regravar não pode mudar nada. */
  it('lê o formulário declarado e o regrava', () => {
    const lido = exigenciasDe(
      detalheDaApi([exigenciaDaApi({ exigidoNaFaseId: ID_ISENCAO, finalidade: 'ISENCAO_TAXA' })]),
    );

    expect(comando(lido)[0].documento?.finalidade).toBe('ISENCAO_TAXA');
  });

  it('lê e regrava sem perder nada', () => {
    const lido = exigenciasDe(
      detalheDaApi([
        exigenciaDaApi({
          exigidoNaEtapaId: ID_ETAPA_RENDA,
          obrigatorio: false,
          consequenciaIndeferimento: 'PENDENCIA_REENVIO',
          basesLegais: [
            {
              id: 'b1',
              referencia: 'Lei 12.711/2012',
              abrangencia: 'FEDERAL',
              status: 'RESOLVIDO',
              observacao: 'cotas',
            },
            {
              id: 'b2',
              referencia: 'Edital 01/2027',
              abrangencia: 'INTERNA_EDITAL',
              status: 'RESOLVIDO',
              observacao: null,
            },
          ],
          formatosPermitidos: ['PDF'],
          tamanhoMaximoBytes: 3000000,
        }),
      ]),
    );

    const raizes = comando(lido);

    expect(raizes[0].documento).toMatchObject({
      exigidoNaFaseId: ID_HABILITACAO,
      exigidoNaEtapaId: ID_ETAPA_RENDA,
      tipoDocumentoId: ID_RG,
      obrigatorio: false,
      consequenciaIndeferimento: 'PENDENCIA_REENVIO',
      formatosPermitidos: ['PDF'],
      tamanhoMaximoBytes: 3000000,
    });
    expect(raizes[0].documento?.basesLegais).toHaveLength(2);
    expect(raizes[0].documento?.basesLegais[0].observacao).toBe('cotas');
  });

  /** O `PUT` substitui a árvore inteira: o modelo que não volta no comando é desvinculado. */
  it('regrava o modelo de documento que a exigência oferece', () => {
    const modelo = {
      modeloId: '01960000-0000-7000-0000-00000000a0de',
      nomeArquivo: 'autodeclaracao.docx',
      formato: 'DOCX',
      hashSha256: 'ab'.repeat(32),
    };
    const lido = exigenciasDe(detalheDaApi([exigenciaDaApi({ modelo })]));

    const raizes = comando(lido);

    expect(raizes[0].documento?.modeloId).toBe(modelo.modeloId);
  });
});
