import { describe, expect, it } from 'vitest';
import { OperadorCodigo } from '@uniplus/shared-data/selecao';

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
      faseId: ID_ISENCAO,
      indeferimento: { obrigatorio: true, consequencia: 'ELIMINA' },
    });
    const habilitacao = exigenciaDaApi({
      faseId: ID_HABILITACAO,
      indeferimento: { obrigatorio: false, consequencia: null },
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
          indeferimento: {
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
          },
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
    const lido = exigenciasDe(detalheDaApi([exigenciaDaApi({ etapaId: ID_ETAPA_RENDA })]));
    expect(todasAsExigencias(lido)[0].etapaId).toBe(ID_ETAPA_RENDA);
  });

  it('reconstrói o recorte de modalidade a partir do gatilho', () => {
    const lido = exigenciasDe(
      detalheDaApi([
        exigenciaDaApi({
          aplicabilidade: {
            tipo: 'CONDICIONAL',
            condicoes: [
              {
                id: 'c1',
                clausula: 1,
                fato: 'MODALIDADE',
                operador: OperadorCodigo.EM,
                valor: '["LB_PPI"]',
              },
            ],
          },
        }),
      ]),
    );

    expect(modalidadesDaExigencia(todasAsExigencias(lido)[0])).toEqual(['LB_PPI']);
  });

  it('descarta a exigência cuja fase não está no cronograma lido', () => {
    const lido = exigenciasDe(detalheDaApi([exigenciaDaApi({ faseId: 'fase-desconhecida' })]));
    expect(todasAsExigencias(lido)).toHaveLength(0);
  });

  /** O ida-e-volta completo: ler e regravar não pode mudar nada. */
  it('lê o formulário declarado e o regrava', () => {
    const lido = exigenciasDe(
      detalheDaApi([exigenciaDaApi({ faseId: ID_ISENCAO, finalidade: 'ISENCAO_TAXA' })]),
    );

    expect(comando(lido)[0].documento?.momento?.finalidade).toBe('ISENCAO_TAXA');
  });

  it('lê e regrava sem perder nada', () => {
    const lido = exigenciasDe(
      detalheDaApi([
        exigenciaDaApi({
          etapaId: ID_ETAPA_RENDA,
          indeferimento: {
            obrigatorio: false,
            consequencia: 'PENDENCIA_REENVIO',
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
          },
          requisitos: { formatosPermitidos: ['PDF'], tamanhoMaximoBytes: 3000000 },
        }),
      ]),
    );

    const documento = comando(lido)[0].documento;

    expect(documento?.momento).toMatchObject({ faseId: ID_HABILITACAO, etapaId: ID_ETAPA_RENDA });
    expect(documento?.tipoDocumento?.id).toBe(ID_RG);
    expect(documento?.indeferimento).toMatchObject({
      obrigatorio: false,
      consequencia: 'PENDENCIA_REENVIO',
    });
    expect(documento?.requisitos).toMatchObject({
      formatosPermitidos: ['PDF'],
      tamanhoMaximoBytes: 3000000,
    });
    const bases = documento?.indeferimento?.basesLegais ?? [];
    expect(bases).toHaveLength(2);
    expect(bases[0].observacao).toBe('cotas');
  });

  /** O `PUT` substitui a árvore inteira: o modelo que não volta no comando é desvinculado. */
  it('regrava o modelo de documento que a exigência oferece', () => {
    const modelo = {
      modeloId: '01960000-0000-7000-0000-00000000a0de',
      nomeArquivo: 'autodeclaracao.docx',
      formato: 'DOCX',
      hashSha256: 'ab'.repeat(32),
    };
    const lido = exigenciasDe(detalheDaApi([exigenciaDaApi({ requisitos: { modelo } })]));

    const raizes = comando(lido);

    expect(raizes[0].documento?.requisitos?.modelo?.modeloId).toBe(modelo.modeloId);
  });
});
