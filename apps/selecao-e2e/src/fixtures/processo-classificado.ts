import type {
  ConfiguracaoBonusRegionalDto,
  CriterioDesempateDto,
} from '@uniplus/shared-data/selecao';
import type { JsonDaApi } from '@uniplus/shared-e2e';
import { etapaDoServidor } from './cronograma-do-servidor';
import { PARAMETROS_DO_DESEMPATE_SEM_VALOR, referencia } from './regras-congeladas-do-servidor';
import {
  AREAS_ENEM,
  BASE_LEGAL_BONUS_REGIONAL_ID,
  PESOS_AREA_ENEM,
  RESOLUCAO_PESO_AREA,
} from './catalogos-da-classificacao';

export const PROCESSO_PUBLICADO_ID = '01960000-0000-7000-0000-000000000898';

export const ETAPA_ENTREVISTA_ID = '01960000-0000-7000-0000-0000000008f1';

function tipoDeEtapa(nome: string, ordem: number, notaDeOrigemNoEnem: boolean) {
  return {
    origemId: `01960000-0000-7000-0000-0000000008f${ordem + 1}`,
    codigo: notaDeOrigemNoEnem ? 'NOTA_ENEM' : 'ENTREVISTA',
    nome,
    notaDeOrigemNoEnem,
    exigeCorrecaoIndependente: false,
  };
}

/** Uma etapa gravada, com o mínimo que a hidratação do rascunho lê. */
function etapaGravada(id: string, nome: string, ordem: number, notaDeOrigemNoEnem: boolean) {
  const tipoEtapa = tipoDeEtapa(nome, ordem, notaDeOrigemNoEnem);
  return etapaDoServidor({ id, identificacao: { nome, ordem, tipoEtapa }, nota: { peso: 1 } });
}

/**
 * Um processo publicado com as quatro seções declaradas — o que a consulta precisa ler.
 * O estado publicado é o que põe o editor em somente leitura.
 */
export const DETALHE_PUBLICADO = {
  id: PROCESSO_PUBLICADO_ID,
  nome: 'Processo seletivo publicado',
  tipoProcesso: {
    origemId: '01960000-0000-7000-0000-000000000905',
    codigo: 'GRAD',
    nome: 'Graduação',
  },
  situacao: { codigo: 'PUBLICADO', rotulo: 'Publicado' },
  origemCandidatos: { codigo: 'INSCRICAO_PROPRIA', rotulo: 'Inscrição própria' },
  unidadeAdministradora: {
    origemId: '01960000-0000-7000-0000-000000000906',
    sigla: 'CEPS',
    slug: 'ceps',
    nome: 'CEPS',
    tipo: 'PROREITORIA',
    cidadeCodigoIbge: '1504208',
    cidadeNome: 'Marabá',
    cidadeUf: 'PA',
  },
  localidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  etapas: [
    etapaGravada(ETAPA_ENTREVISTA_ID, 'Entrevista', 1, false),
    etapaGravada('01960000-0000-7000-0000-0000000008f9', 'Nota do ENEM', 2, true),
  ],
  atendimentoEspecializado: null,
  distribuicaoVagas: [],
  aplicaBonusRegional: true,
  opcoesDeCurso: { numero: 1 },
  bonusRegional: {
    id: '01960000-0000-7000-0000-0000000008b1',
    regra: referencia('BONUS-MULTIPLICATIVO'),
    fator: 1.2,
    teto: null,
    fatoElegibilidadeCodigo: 'PEDE_O_ACRESCIMO',
    baseLegal: {
      id: BASE_LEGAL_BONUS_REGIONAL_ID,
      tipoInstrumento: 'PORTARIA',
      identificacao: 'Portaria Unifesspa nº 2514/2023',
      descricao: 'Institui inclusão regional.',
      municipios: [{ codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' }],
    },
  } satisfies JsonDaApi<ConfiguracaoBonusRegionalDto>,
  cascata: null,
  criteriosDesempate: [
    {
      id: '01960000-0000-7000-0000-0000000008d1',
      ordem: 1,
      regra: referencia('DESEMPATE_MAIOR_IDADE'),
      parametros: PARAMETROS_DO_DESEMPATE_SEM_VALOR,
    },
  ] satisfies readonly JsonDaApi<CriterioDesempateDto>[],
  classificacao: {
    id: '01960000-0000-7000-0000-0000000008c1',
    regraCalculo: referencia('FORMULA-MEDIA-PONDERADA'),
    regraArredondamento: referencia('ARRED-TRUNCAR'),
    casasArredondamento: 2,
    regraOrdemAlocacao: referencia('ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA'),
    regrasEliminacao: [
      {
        id: '01960000-0000-7000-0000-0000000008e1',
        regra: referencia('ELIMINACAO_ZERO_EM_AREA'),
        etapaRef: null,
        notaMinima: null,
        minimo: null,
        areaCodigo: null,
      },
      {
        id: '01960000-0000-7000-0000-0000000008e2',
        regra: referencia('ELIMINACAO_AUSENCIA_NA_ETAPA'),
        etapaRef: ETAPA_ENTREVISTA_ID,
        notaMinima: null,
        minimo: null,
        areaCodigo: null,
      },
    ],
    concorrenciaDuplaAplicavel: false,
    baseadoEmEnem: false,
    escalaNotaFinal: 100,
    resolucaoPesoAreaEnem: null,
    quadroPesoAreaEnem: [],
  },
  cronogramaFases: [],
  documentosExigidos: [],
  regrasDeComprovacao: [],
  referenciaTemporalFatos: null,
  regrasDerivacao: [],
  formularios: [],
  opcoesDeclaradas: [],
  configuracaoDivulgacao: null,
  configuracaoTaxaInscricao: null,
  algoritmoContagemPrazo: null,
  criadoEm: '2026-09-01T00:00:00Z',
};

/** O que cada passo lê em consulta: o rótulo do campo e o trecho que o valor tem de trazer. */
export const LEITURAS: Record<string, Record<string, string>> = {
  'Fórmula e precisão': {
    'Regra de cálculo': 'FORMULA-MEDIA-PONDERADA — Resolução CEPS 12/2026',
    'Regra de arredondamento': 'ARRED-TRUNCAR — Edital padrão PSIQ',
    'Casas decimais': '2',
    'Ordem de alocação': 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA',
    'Escala da nota final': '0 a 100',
  },
  FADA: {
    FADA: 'Aplicado neste processo',
    'Regra do FADA': 'BONUS-MULTIPLICATIVO',
    Fator: '1,2',
    'Base Legal do FADA': 'Portaria Unifesspa nº 2514/2023',
    'Quem recebe o acréscimo': 'PEDE_O_ACRESCIMO',
  },
  Desempate: { 'Regra do critério': 'DESEMPATE_MAIOR_IDADE — Costume administrativo' },
  Eliminação: {
    'Regra de eliminação 1': 'ELIMINACAO_ZERO_EM_AREA — Resolução 805/2020, art. 5º',
    'Regra de eliminação 2': 'ELIMINACAO_AUSENCIA_NA_ETAPA — Edital do processo',
    Etapa: 'Entrevista',
  },
};

export const PROCESSO_DESEMPATE_POR_AREA_ID = '01960000-0000-7000-0000-000000000900';

/**
 * O mesmo processo publicado, classificado pelo ENEM com o quadro de Peso por Área congelado e
 * um critério de desempate pela ordem das áreas: é o cartão que quebrava no celular.
 */
export const DETALHE_DESEMPATE_POR_AREA = {
  ...DETALHE_PUBLICADO,
  id: PROCESSO_DESEMPATE_POR_AREA_ID,
  criteriosDesempate: [
    {
      ...DETALHE_PUBLICADO.criteriosDesempate[0],
      regra: referencia('DESEMPATE_MAIOR_NOTA_AREA_ENEM'),
      parametros: {
        ...PARAMETROS_DO_DESEMPATE_SEM_VALOR,
        areas: AREAS_ENEM.map((area) => area.codigo),
      },
    },
  ],
  classificacao: {
    ...DETALHE_PUBLICADO.classificacao,
    baseadoEmEnem: true,
    escalaNotaFinal: 100,
    resolucaoPesoAreaEnem: RESOLUCAO_PESO_AREA,
    quadroPesoAreaEnem: PESOS_AREA_ENEM.map((linha) => ({
      grupoAreaEnem: linha.grupoCurso,
      baseLegal: linha.baseLegal,
      areas: linha.areas,
    })),
  },
};

export const PROCESSO_AUSENCIA_ID = '01960000-0000-7000-0000-000000000920';
export const PROCESSO_EDICOES_ENEM_ID = '01960000-0000-7000-0000-000000000910';
