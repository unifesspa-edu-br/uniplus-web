import { describe, expect, it } from 'vitest';
import {
  AplicabilidadeCodigo,
  OperadorCodigo,
  type DocumentoExigidoDto,
} from '@uniplus/shared-data/selecao';

import { exigenciasDaFase, todasAsExigencias } from './consulta-das-exigencias';
import { exigenciasDe } from './leitura-das-exigencias';
import { modalidadesDaExigencia } from './modalidades-da-exigencia';
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
      indeferimento: {
        obrigatorio: true,
        consequenciaDoDescumprimento: {
          codigo: 'ELIMINA_DO_PROCESSO' as NonNullable<
            DocumentoExigidoDto['indeferimento']['consequenciaDoDescumprimento']
          >['codigo'],
          rotulo: 'Elimina',
        },
      },
    });
    const habilitacao = exigenciaDaApi({
      faseId: ID_HABILITACAO,
      indeferimento: { obrigatorio: false, consequenciaDoDescumprimento: null },
    });
    const lido = exigenciasDe(detalheDaApi([isencao, habilitacao]));

    const naIsencao = exigenciasDaFase(lido, 'ISENCAO');
    const naHabilitacao = exigenciasDaFase(lido, 'HABILITACAO');

    expect(naIsencao).toHaveLength(1);
    expect(naHabilitacao).toHaveLength(1);
    expect(naIsencao[0].obrigatorio).toBe(true);
    expect(naIsencao[0].consequenciaIndeferimento).toBe('ELIMINA_DO_PROCESSO');
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
                abrangencia: {
                  codigo:
                    'FEDERAL' as DocumentoExigidoDto['indeferimento']['basesLegais'][number]['abrangencia']['codigo'],
                  rotulo: 'Federal',
                },
                situacao: {
                  codigo:
                    'RESOLVIDO' as DocumentoExigidoDto['indeferimento']['basesLegais'][number]['situacao']['codigo'],
                  rotulo: 'Resolvido',
                },
                observacao: 'cotas',
              },
              {
                id: 'b2',
                referencia: 'Edital 01/2027',
                abrangencia: {
                  codigo:
                    'INTERNA_EDITAL' as DocumentoExigidoDto['indeferimento']['basesLegais'][number]['abrangencia']['codigo'],
                  rotulo: 'Edital',
                },
                situacao: {
                  codigo:
                    'PENDENTE' as DocumentoExigidoDto['indeferimento']['basesLegais'][number]['situacao']['codigo'],
                  rotulo: 'Pendente',
                },
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
      situacao: 'RESOLVIDO',
      observacao: 'cotas',
    });
    expect(bases[1].situacao).toBe('PENDENTE');
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

  it('reconstrói a seleção de modalidades a partir do gatilho', () => {
    const lido = exigenciasDe(
      detalheDaApi([
        exigenciaDaApi({
          aplicabilidade: {
            tipo: { codigo: AplicabilidadeCodigo.CONDICIONAL, rotulo: 'Condicional' },
            condicoes: [
              {
                id: 'c1',
                clausula: 1,
                fato: 'MODALIDADE',
                operador: OperadorCodigo.ALGUM_DE,
                valor: '["LB_PPI"]',
              },
            ],
          },
        }),
      ]),
    );

    expect(modalidadesDaExigencia(todasAsExigencias(lido)[0])).toEqual(['LB_PPI']);
  });

  it('conserva a exigência cuja fase não está no cronograma lido', () => {
    const lido = exigenciasDe(detalheDaApi([exigenciaDaApi({ faseId: 'fase-desconhecida' })]));
    expect(todasAsExigencias(lido)[0].faseIdLido).toBe('fase-desconhecida');
    expect(comando(lido)[0].documento?.momento?.faseId).toBe('fase-desconhecida');
  });

  /** O ida-e-volta completo: ler e regravar não pode mudar nada. */
  it('lê o formulário declarado e o regrava', () => {
    const lido = exigenciasDe(
      detalheDaApi([exigenciaDaApi({ faseId: ID_ISENCAO, formularioCodigo: 'ISENCAO_TAXA' })]),
    );

    expect(comando(lido)[0].documento?.momento?.formularioCodigo).toBe('ISENCAO_TAXA');
  });

  it('lê e regrava sem perder nada', () => {
    const lido = exigenciasDe(
      detalheDaApi([
        exigenciaDaApi({
          etapaId: ID_ETAPA_RENDA,
          indeferimento: {
            obrigatorio: false,
            consequenciaDoDescumprimento: {
              codigo: 'RETIRA_O_ACRESCIMO' as NonNullable<
                DocumentoExigidoDto['indeferimento']['consequenciaDoDescumprimento']
              >['codigo'],
              rotulo: 'Retira o acréscimo',
            },
            basesLegais: [
              {
                id: 'b1',
                referencia: 'Lei 12.711/2012',
                abrangencia: {
                  codigo:
                    'FEDERAL' as DocumentoExigidoDto['indeferimento']['basesLegais'][number]['abrangencia']['codigo'],
                  rotulo: 'Federal',
                },
                situacao: {
                  codigo:
                    'RESOLVIDO' as DocumentoExigidoDto['indeferimento']['basesLegais'][number]['situacao']['codigo'],
                  rotulo: 'Resolvido',
                },
                observacao: 'cotas',
              },
              {
                id: 'b2',
                referencia: 'Edital 01/2027',
                abrangencia: {
                  codigo:
                    'INTERNA_EDITAL' as DocumentoExigidoDto['indeferimento']['basesLegais'][number]['abrangencia']['codigo'],
                  rotulo: 'Edital',
                },
                situacao: {
                  codigo:
                    'RESOLVIDO' as DocumentoExigidoDto['indeferimento']['basesLegais'][number]['situacao']['codigo'],
                  rotulo: 'Resolvido',
                },
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
      consequenciaDoDescumprimento: 'RETIRA_O_ACRESCIMO',
    });
    expect(documento?.requisitos).toMatchObject({
      formatosPermitidos: [{ formato: 'PDF', tamanhoMaximoBytesMax: null }],
      tamanhoMaximoBytes: 3000000,
    });
    const bases = documento?.indeferimento?.basesLegais ?? [];
    expect(bases).toHaveLength(2);
    expect(bases[0].observacao).toBe('cotas');
  });

  /** O `PUT` substitui a estrutura de regras inteira: o modelo que não volta no comando é desvinculado. */
  it('regrava o modelo de documento que a exigência oferece', () => {
    const modelo = {
      modeloId: '01960000-0000-7000-0000-00000000a0de',
      nomeArquivo: 'autodeclaracao.docx',
      formato: {
        codigo: 'DOCX' as NonNullable<
          DocumentoExigidoDto['requisitos']['modelo']
        >['formato']['codigo'],
        rotulo: 'DOCX',
      },
      hashSha256: 'ab'.repeat(32),
    };
    const lido = exigenciasDe(detalheDaApi([exigenciaDaApi({ requisitos: { modelo } })]));

    const regrasPrincipais = comando(lido);

    expect(regrasPrincipais[0].documento?.requisitos?.modelo?.modeloId).toBe(modelo.modeloId);
  });
});
