import { FASES_CANONICAS, UNIDADE_RESPONSAVEL_DA_FASE } from './processo-publicado-completo';

export const UNIDADE_CEPS = {
  id: UNIDADE_RESPONSAVEL_DA_FASE.origemId,
  nome: UNIDADE_RESPONSAVEL_DA_FASE.nome,
  alias: null,
  slug: 'ceps',
  sigla: 'CEPS',
  codigo: 'CEPS',
  unidadeSuperiorId: null,
  tipo: 'PROREITORIA',
  unidadeAcademica: false,
  vigenciaInicio: '2020-01-01',
  vigenciaFim: null,
  criadoEm: '2020-01-01T00:00:00Z',
  cidadeCodigoIbge: null,
  cidadeNome: null,
  cidadeUf: null,
};

export const UNIDADE_CGA = {
  ...UNIDADE_CEPS,
  id: '01a0d640-0000-7000-8000-0000000000a4',
  nome: 'Centro de Gestão Acadêmica',
  slug: 'cga',
  sigla: 'CGA',
  codigo: 'CGA',
};

export const ID_DA_ADMINISTRADORA = '01a07d6a-a0b2-7448-89a6-a2c7867a0e38';

export const UNIDADE_ADMINISTRADORA = {
  ...UNIDADE_CEPS,
  id: ID_DA_ADMINISTRADORA,
  sigla: 'CEPS-ADM',
  slug: 'ceps-adm',
  codigo: 'CEPS-ADM',
};

export const TIPOS_DE_ATO = ['RESULTADO_PRELIMINAR', 'RESULTADO_FINAL'].map((codigo, i) => ({
  id: `01a0d640-0000-7000-8000-0000000000b${i + 5}`,
  codigo,
  nome: codigo,
  congelaConfiguracao: false,
  unicoPorObjeto: false,
  efeitoIrreversivel: false,
  ehResultado: true,
  vigenciaInicio: '2020-01-01',
  vigenciaFim: null,
  baseLegal: null,
}));

const FATO_DECLARADO_NA_INSCRICAO = {
  descricao: null,
  origem: { codigo: 'DECLARADO', rotulo: 'Declarado' },
  cardinalidade: { codigo: 'VALOR_UNICO', rotulo: 'Valor único' },
  valoresDominio: null,
  pontoResolucao: 'INSCRICAO',
  binding: 'CAMPO',
  valoresDominioDeclarados: null,
  fonteValores: null,
  ativo: true,
  formato: null,
  escopo: 'CANDIDATO',
};

const IGUALDADE = [
  { codigo: 'IGUAL', rotulo: 'é' },
  { codigo: 'DIFERENTE', rotulo: 'não é' },
];

/** Texto e data não são citáveis em regra: a API devolve a lista de operadores vazia. */
function fatoDoCandidato([codigo, nome, dominio]: readonly string[], i: number) {
  return {
    fato: {
      id: `01a0d640-0000-7000-8000-0000000000f${i + 1}`,
      codigo,
      nome,
      dominio: { codigo: dominio, rotulo: dominio },
      ...FATO_DECLARADO_NA_INSCRICAO,
    },
    operadoresAdmitidos: dominio === 'SIM_OU_NAO' ? IGUALDADE : [],
  };
}

export const FATOS_DO_CANDIDATO = [
  ['MODALIDADE', 'Modalidade', 'TEXTO'],
  ['DATA_NASCIMENTO', 'Data de nascimento', 'DATA'],
  ['OPTOU_PELAS_COTAS_DA_LEI', 'Optou pelas cotas da Lei', 'SIM_OU_NAO'],
].map(fatoDoCandidato);

export const FASES_DO_CATALOGO = [
  ...FASES_CANONICAS,
  ...[
    [
      'HABILITACAO',
      'Habilitação',
      { origemId: UNIDADE_CGA.id, sigla: 'CGA', slug: 'cga', nome: UNIDADE_CGA.nome },
    ],
    ['MATRICULA', 'Matrícula', null],
  ].map(([codigo, nome, unidadeSugerida], i) => ({
    ...FASES_CANONICAS[0],
    id: `01a0d640-0000-7000-8000-0000000000e${i + 1}`,
    codigo,
    nome,
    unidadeSugerida,
    agrupaEtapas: false,
    admiteAgruparEtapas: false,
    coletaInscricao: false,
  })),
];
