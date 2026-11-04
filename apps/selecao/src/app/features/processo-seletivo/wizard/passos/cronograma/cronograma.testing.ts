export const BASE = 'http://localhost:5000';
export const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
export const ROTA_ETAPAS = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/etapas`;
export const ROTA_FASES = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/cronograma-fases`;
export const ROTA_ALGORITMO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/algoritmo-contagem-prazo`;
export const ROTA_PROCESSO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}`;
export const ROTA_DOCUMENTOS = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/documentos-exigidos`;
export const ID_ETAPA_GRAVADA = '01960000-0000-7000-0000-0000000000ee';

/** O interceptor só lê o corpo como ProblemDetails sob este media type. */
export const PROBLEM_JSON = { 'content-type': 'application/problem+json' };

/** A recusa do servidor quando a nova ordem fecha ciclo entre fases existentes. */
export const CICLO_DE_ORDEM = {
  type: 'about:blank',
  title: 'A redefinição do cronograma troca a Ordem entre fases já existentes',
  status: 422,
  code: 'uniplus.selecao.fase_cronograma.permutacao_de_ordem_nao_suportada',
  traceId: '00000000000000000000000000000002',
};

export const ID_INSCRICAO = '01960000-0000-7000-0000-0000000000c1';
export const ID_AVALIACAO = '01960000-0000-7000-0000-0000000000c2';
export const ID_RESULTADO = '01960000-0000-7000-0000-0000000000c3';
export const TIPO_ETAPA = '01960000-0000-7000-0000-0000000000e1';
/** Fase que o processo congelou e que não está mais no catálogo. */
export const FASE_SUMIDA = '01960000-0000-7000-0000-0000000000cf';
export const ID_BANCA_HETERO = '01960000-0000-7000-0000-0000000000b1';
export const ID_CATEGORIA_RACA = '01960000-0000-7000-0000-0000000000d1';
export const ID_CATEGORIA_RENDA = '01960000-0000-7000-0000-0000000000d2';

export const FASES_CANONICAS = [
  {
    id: ID_INSCRICAO,
    codigo: 'COLETA_INSCRICAO',
    nome: 'Inscrição',
    unidadeSugerida: null,
    agrupaEtapas: false,
    permiteComplementacao: false,
    coletaInscricao: true,
    origemData: 'NO_EDITAL',
  },
  {
    id: ID_AVALIACAO,
    codigo: 'AVALIACAO',
    nome: 'Avaliação',
    unidadeSugerida: null,
    agrupaEtapas: true,
    permiteComplementacao: false,
    coletaInscricao: false,
    origemData: 'NO_EDITAL',
  },
  {
    id: ID_RESULTADO,
    codigo: 'RESULTADO_FINAL',
    nome: 'Resultado final',
    unidadeSugerida: null,
    agrupaEtapas: false,
    permiteComplementacao: false,
    coletaInscricao: false,
    origemData: 'NA_EXECUCAO',
  },
];

export const TIPO_ETAPA_SO_ELIMINA = '01960000-0000-7000-0000-0000000000e2';
export const TIPO_ETAPA_NOTA_ENEM = '01960000-0000-7000-0000-0000000000e3';

export const TIPOS_ETAPA = [
  {
    id: TIPO_ETAPA,
    codigo: 'PROVA_OBJETIVA',
    nome: 'Prova objetiva',
    ativo: true,
    admitePontuacao: true,
    admiteEliminacao: true,
  },
  {
    id: TIPO_ETAPA_SO_ELIMINA,
    codigo: 'ANALISE_DOCUMENTAL',
    nome: 'Análise documental',
    ativo: true,
    admitePontuacao: false,
    admiteEliminacao: true,
  },
  {
    id: TIPO_ETAPA_NOTA_ENEM,
    codigo: 'NOTA_ENEM',
    nome: 'Nota do ENEM',
    ativo: true,
    admitePontuacao: true,
    admiteEliminacao: true,
    notaDeOrigemNoEnem: true,
  },
];

/** O catálogo não tem `nome` nem `descricao` — só `codigo` e `baseLegal` são legíveis. */
export const REGRAS_CONTAGEM = [
  {
    codigo: 'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL',
    versao: 'v1',
    tipo: 'algoritmo_contagem_prazo',
    esquemaArgs: {},
    // O catálogo publica os invariantes como lista de prosa — é deles que sai a descrição
    // do que a convenção faz, e é o que separa uma convenção da outra.
    invariantes: [
      'o dia da âncora não conta',
      'em horas, a contagem começa no primeiro dia útil seguinte',
    ],
    baseLegal: 'Lei 9.784/1999, art. 66',
    hash: 'xyz',
    modalidadesAdmitidas: null,
  },
  {
    codigo: 'SEM-INVARIANTE',
    versao: 'v1',
    tipo: 'algoritmo_contagem_prazo',
    esquemaArgs: {},
    // O contrato tipa o campo como JSON solto: o que não for lista de texto é descartado.
    invariantes: {},
    baseLegal: 'Lei 9.784/1999, art. 66',
    hash: 'abc',
    modalidadesAdmitidas: null,
  },
];

/** O catálogo de consolidação traz os invariantes em prosa: é a descrição que a tela mostra. */
export const REGRAS_CONSOLIDACAO = [
  {
    codigo: 'CONSOLIDACAO-AVALIACAO-UNICA',
    versao: 'v1',
    tipo: 'regra_consolidacao',
    esquemaArgs: {},
    invariantes: ['um só avaliador lança a nota de cada candidato'],
    baseLegal: 'Decisão institucional da Unifesspa',
    hash: 'u1',
    modalidadesAdmitidas: null,
  },
  {
    codigo: 'CONSOLIDACAO-CORRECAO-INDEPENDENTE',
    versao: 'v1',
    tipo: 'regra_consolidacao',
    esquemaArgs: {},
    invariantes: ['mais de um avaliador corrige cada candidato sem conhecer a nota do outro'],
    baseLegal: 'Decisão institucional da Unifesspa',
    hash: 'c1',
    modalidadesAdmitidas: null,
  },
];

/**
 * O processo como o servidor o devolve depois de gravar: a etapa que subiu sem
 * `id` volta com o que ele atribuiu.
 */
export const PROCESSO_COM_ETAPA_GRAVADA = {
  id: PROCESSO_ID,
  nome: 'Vestibular 2026.1',
  tipoProcesso: {
    origemId: '01960000-0000-7000-0000-0000000000t1',
    codigo: 'VESTIBULAR',
    nome: 'Vestibular',
  },
  status: 'rascunho',
  origemCandidatos: 'inscricaoPropria',
  unidadeAdministradora: {
    origemId: '01960000-0000-7000-0000-0000000000u1',
    sigla: 'IGE',
    slug: 'ige',
    nome: 'Instituto de Geociências e Engenharias',
  },
  localidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  etapas: [
    {
      id: ID_ETAPA_GRAVADA,
      nome: 'Prova objetiva',
      carater: 'classificatoria',
      tipoEtapa: { origemId: TIPO_ETAPA, codigo: 'PROVA_OBJETIVA', nome: 'Prova objetiva' },
      peso: 1,
      notaMinima: null,
      ordem: 1,
    },
  ],
  ofertaAtendimento: null,
  distribuicaoVagas: [],
  bonusRegional: null,
  cascata: null,
  criteriosDesempate: [],
  classificacao: null,
  cronogramaFases: [],
  documentosExigidos: [],
  raizesExigencia: [],
  referenciaTemporalFatos: null,
  configuracaoTaxaInscricao: { cobra: false, valor: null, fundamentos: [] },
};
