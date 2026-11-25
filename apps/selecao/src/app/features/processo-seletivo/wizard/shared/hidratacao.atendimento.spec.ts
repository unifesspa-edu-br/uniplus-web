import { FinalidadeFormularioCodigo, TipoDaReferenciaTemporal } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';
import {
  type FormularioDto,
  type ProcessoSeletivoDto,
  TipoDeCampoCodigo,
} from '@uniplus/shared-data/selecao';
import {
  campoDoServidor,
  etapaDoServidor,
  formularioDoServidor,
} from './formulario-do-servidor.testing';
import { hidratarDraft } from './hidratacao';
import {
  DRAFT,
  DISTRIBUICAO,
  dtoCom,
  FASE_COM_RECURSO,
  dtoComCronograma,
} from './hidratacao.testing';

describe('hidratarDraft — cascata de remanejamento', () => {
  it('projeta só o par código/versão da regra escolhida', () => {
    const dto = dtoCom([DISTRIBUICAO]);
    (dto as unknown as { cascata: unknown }).cascata = {
      id: 'snapshot-cascata',
      regra: { codigo: 'REMANEJ-CASCATA-LEI-12711', versao: 'v1', hash: 'hash-1' },
      fallbackCodigo: 'AC',
      destinos: [
        { id: 'd1', modalidadeOrigemCodigo: 'LB_PPI', ordem: 1, modalidadeDestinoCodigo: 'LB_Q' },
      ],
    };

    const { cascata } = hidratarDraft(DRAFT, dto).vagas;

    expect(cascata).toEqual({ regraCodigo: 'REMANEJ-CASCATA-LEI-12711', regraVersao: 'v1' });
  });

  it('processo sem cascata gravada hidrata null', () => {
    const { cascata } = hidratarDraft(DRAFT, dtoCom([DISTRIBUICAO])).vagas;

    expect(cascata).toBeNull();
  });
});

const ATENDIMENTO_ESPECIALIZADO = {
  id: 'snapshot-atendimento',
  condicoes: [
    {
      id: 'snapshot-condicao-1',
      condicaoOrigemId: 'condicao-pcd',
      condicaoCodigo: 'PCD',
      condicaoNome: 'Pessoa com deficiência',
    },
  ],
  recursos: [
    {
      id: 'snapshot-recurso-1',
      recursoOrigemId: 'recurso-ledor',
      recursoCodigo: 'LEDOR',
      recursoNome: 'Ledor',
    },
  ],
  tiposDeficiencia: [
    {
      id: 'snapshot-tipo-1',
      tipoDeficienciaOrigemId: 'tipo-visual',
      tipoDeficienciaNome: 'Deficiência visual',
    },
  ],
};

describe('hidratarDraft — atendimento especializado', () => {
  it('projeta condições, recursos e tipos de deficiência pelo id de origem', () => {
    const { atendimento } = hidratarDraft(
      DRAFT,
      dtoComCronograma({ atendimentoEspecializado: ATENDIMENTO_ESPECIALIZADO }),
    );

    expect(atendimento).toEqual({
      condicoes: [{ id: 'condicao-pcd', codigo: 'PCD', nome: 'Pessoa com deficiência' }],
      recursos: [{ id: 'recurso-ledor', nome: 'Ledor' }],
      tiposDeficiencia: [{ id: 'tipo-visual', nome: 'Deficiência visual' }],
    });
  });

  it('trata processo sem atendimento especializado como as três listas vazias', () => {
    const { atendimento } = hidratarDraft(
      DRAFT,
      dtoComCronograma({ atendimentoEspecializado: null }),
    );

    expect(atendimento).toEqual({ condicoes: [], recursos: [], tiposDeficiencia: [] });
  });
});

/**
 * O formulário de inscrição. Toda dimensão que o wizard grava precisa ser lida de volta: os
 * comandos substituem a coleção inteira, então o que a hidratação não trouxer é reescrito em
 * branco na gravação seguinte — foi assim que a exigência documental perdia entrega,
 * consequência e norma.
 */
describe('hidratarDraft — formulário de inscrição', () => {
  const ID_INSCRICAO = '01960000-0000-7000-0000-0000000000f1';

  /** Reusa a fixture do cronograma, trocando só o id e o código da fase que a idade ancora. */
  function dtoComFormulario(extra: Record<string, unknown>): ProcessoSeletivoDto {
    return dtoComCronograma({
      cronogramaFases: [{ ...FASE_COM_RECURSO, id: ID_INSCRICAO, codigo: 'INSCRICAO' }],
      ...extra,
    });
  }

  const formulario = (
    finalidade: FormularioDto['finalidade']['codigo'],
    extra: Partial<FormularioDto> = {},
  ) =>
    formularioDoServidor({
      finalidade: { codigo: finalidade, rotulo: finalidade },
      faseId: ID_INSCRICAO,
      titulo: 'Inscrição 2027',
      etapas: [etapaDoServidor('DADOS_BASICOS', 0), etapaDoServidor('S1', 1)],
      coleta: {
        itens: [
          campoDoServidor('NOME', 0, 'DADOS_BASICOS', TipoDeCampoCodigo.ESCOLHA_UNICA),
          campoDoServidor('SEXO', 1, 'S1', TipoDeCampoCodigo.ESCOLHA_UNICA),
        ],
        grupos: [],
      },
      ...extra,
    });

  it('lê o formulário de inscrição no conteúdo do editor, com a fase pelo código', () => {
    const draft = hidratarDraft(
      DRAFT,
      dtoComFormulario({ formularios: [formulario(FinalidadeFormularioCodigo.INSCRICAO)] }),
    );

    expect(draft.formulario.faseCodigo).toBe('INSCRICAO');
    expect(draft.formulario.conteudo.titulo).toBe('Inscrição 2027');
    expect(
      draft.formulario.conteudo.itens?.map((item) => [
        item.fatoCodigo,
        item.regras?.obrigatoriedade.tipo,
      ]),
    ).toEqual([
      ['NOME', 'SEMPRE'],
      ['SEXO', 'SEMPRE'],
    ]);
  });

  it('guarda o formulário de cada outra finalidade, fora da inscrição: o passo edita cada um na sua aba', () => {
    const draft = hidratarDraft(
      DRAFT,
      dtoComFormulario({
        formularios: [
          formulario(FinalidadeFormularioCodigo.INSCRICAO),
          formulario(FinalidadeFormularioCodigo.ISENCAO_TAXA, {
            etapas: [etapaDoServidor('S1', 0)],
            coleta: {
              itens: [campoDoServidor('RENDA', 0, 'S1', TipoDeCampoCodigo.ESCOLHA_UNICA)],
              grupos: [],
            },
          }),
        ],
      }),
    );

    expect(
      draft.formulario.outrasFinalidades.map((outra) => [
        outra.finalidade,
        outra.conteudo.itens?.map((item) => item.fatoCodigo),
      ]),
    ).toEqual([['ISENCAO_TAXA', ['RENDA']]]);
    expect(draft.formulario.conteudo.itens?.map((item) => item.fatoCodigo)).not.toContain('RENDA');
  });

  it('guarda de que modelo cada formulário partiu', () => {
    const draft = hidratarDraft(
      DRAFT,
      dtoComFormulario({
        formularios: [
          formulario(FinalidadeFormularioCodigo.INSCRICAO, {
            modeloOrigem: { id: 'm1', codigo: 'MEDICINA-INSCRICAO' },
          }),
          formulario(FinalidadeFormularioCodigo.ISENCAO_TAXA, {
            etapas: [etapaDoServidor('S1', 0)],
            modeloOrigem: { id: 'm2', codigo: 'ISENCAO-PADRAO' },
          }),
        ],
      }),
    );

    expect(draft.formulario.modeloOrigemCodigo).toBe('MEDICINA-INSCRICAO');
    expect(draft.formulario.outrasFinalidades[0].modeloOrigemCodigo).toBe('ISENCAO-PADRAO');
  });

  /** A fase volta por CÓDIGO — o id não sobrevive a uma gravação de cronograma. */
  it('traduz a fase da referência temporal de identificador para código', () => {
    const draft = hidratarDraft(
      DRAFT,
      dtoComFormulario({
        referenciaTemporalFatos: {
          tipo: {
            codigo: TipoDaReferenciaTemporal.INICIO_FASE,
            rotulo: TipoDaReferenciaTemporal.INICIO_FASE,
          },
          data: null,
          faseId: ID_INSCRICAO,
        },
      }),
    );

    expect(draft.formulario.referenciaTemporal).toEqual({
      tipo: 'INICIO_FASE',
      data: '',
      faseCodigo: 'INSCRICAO',
    });
  });

  it('lê a referência ancorada em data específica', () => {
    const draft = hidratarDraft(
      DRAFT,
      dtoComFormulario({
        referenciaTemporalFatos: {
          tipo: {
            codigo: TipoDaReferenciaTemporal.DATA_ESPECIFICA,
            rotulo: TipoDaReferenciaTemporal.DATA_ESPECIFICA,
          },
          data: '2027-01-31',
          faseId: null,
        },
      }),
    );

    expect(draft.formulario.referenciaTemporal).toEqual({
      tipo: 'DATA_ESPECIFICA',
      data: '2027-01-31',
      faseCodigo: '',
    });
  });

  it('ausência de política é estado legítimo, não erro', () => {
    const draft = hidratarDraft(DRAFT, dtoComFormulario({ referenciaTemporalFatos: null }));
    expect(draft.formulario.referenciaTemporal.tipo).toBe('');
  });

  it('carrega as regras de derivação que a tela não edita', () => {
    const regras = [{ ordem: 0, contribui: 'LB_PPI', quando: null }];
    const draft = hidratarDraft(
      DRAFT,
      dtoComFormulario({ regrasDerivacao: [{ codigoFato: 'MODALIDADE', regras }] }),
    );

    expect(draft.formulario.derivacao).toEqual([{ codigoFato: 'MODALIDADE', regras }]);
  });

  it('processo sem formulário declarado hidrata vazio, sem quebrar', () => {
    const draft = hidratarDraft(DRAFT, dtoComFormulario({}));

    // Sem formulário de inscrição, o conteúdo nasce só com a revisão e aceite; a seção dos dados
    // básicos chega com a criação.
    expect(draft.formulario.faseCodigo).toBe('');
    expect(draft.formulario.conteudo.etapas?.map((e) => e.codigo)).toEqual(['REVISAO_E_ACEITE']);
    expect(draft.formulario.conteudo.itens).toEqual([]);
    expect(draft.formulario.derivacao).toEqual([]);
  });
});
