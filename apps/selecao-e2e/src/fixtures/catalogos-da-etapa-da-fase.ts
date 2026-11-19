import type { Page } from '@playwright/test';
import {
  responderCatalogos,
  responderRegrasDoCatalogo,
  type CatalogoMockado,
} from '../support/responder';

const CORS_DA_ETAPA = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, accept, content-type, idempotency-key',
};

const TIPOS_PROCESSO = [
  {
    id: '01960000-0000-7000-0000-000000000515',
    codigo: 'SISU',
    nome: 'SISU',
    descricao: null,
    ativo: true,
    criadoEm: '2026-08-11T00:00:00Z',
  },
] as const;

/** Habilitação: uma fase que o cadastro NÃO marca como agrupadora de etapas. */
const FASES_CANONICAS = [
  {
    id: '01960000-0000-7000-0000-0000000000d1',
    codigo: 'HABILITACAO',
    nome: 'Habilitação',
    descricao: null,
    unidadeSugerida: null,
    agrupaEtapas: false,
    permiteComplementacao: false,
    admiteAgruparEtapas: false,
    admiteComplementacao: false,
    baseLegal: null,
    coletaInscricao: false,
    origemData: 'NO_EDITAL',
    criadoEm: '2026-08-30T12:00:00Z',
  },
] as const;

const TIPOS_ETAPA = [
  {
    id: '01960000-0000-7000-0000-0000000000e1',
    codigo: 'ANALISE_DOCUMENTAL',
    nome: 'Análise Documental',
    descricao: null,
    ativo: true,
    admitePontuacao: false,
    admiteEliminacao: true,
  },
  {
    id: '01960000-0000-7000-0000-0000000000e2',
    codigo: 'PROVA_OBJETIVA',
    nome: 'Prova Objetiva',
    descricao: null,
    ativo: true,
    admitePontuacao: true,
    admiteEliminacao: true,
  },
] as const;

const TIPOS_ATO = [
  {
    id: '01960000-0000-7000-0000-0000000000a1',
    codigo: 'RESULTADO_PRELIMINAR',
    nome: 'Resultado preliminar',
    congelaConfiguracao: false,
    unicoPorObjeto: false,
    efeitoIrreversivel: false,
    ehResultado: true,
    vigenciaInicio: '2020-01-01',
    vigenciaFim: null,
    baseLegal: null,
  },
  {
    id: '01960000-0000-7000-0000-0000000000a2',
    codigo: 'RESULTADO_FINAL',
    nome: 'Resultado final',
    congelaConfiguracao: false,
    unicoPorObjeto: false,
    efeitoIrreversivel: false,
    ehResultado: true,
    vigenciaInicio: '2020-01-01',
    vigenciaFim: null,
    baseLegal: null,
  },
] as const;

const TIPOS_BANCA = [
  {
    id: '01960000-0000-7000-0000-0000000000a9',
    codigo: 'ANALISE_DOCUMENTAL',
    nome: 'Banca de análise documental',
    faseTipica: 'HABILITACAO',
    descricao: null,
    criadoEm: '2026-08-30T12:00:00Z',
  },
] as const;

const CATEGORIAS_DOCUMENTO = [
  {
    id: '01960000-0000-7000-0000-0000000000c1',
    codigo: 'RENDA',
    nome: 'Comprovação de renda',
    descricao: null,
    ativo: true,
  },
] as const;

const TIPOS_DOCUMENTO = [
  {
    id: '01960000-0000-7000-0000-0000000000b1',
    codigo: 'CONTRACHEQUE',
    nome: 'Contracheque',
    descricao: null,
    categoria: 'RENDA',
    tipoEquivalente: null,
    ativo: true,
    formatosAceitos: null,
    protecaoAprovada: true,
    criadoEm: '2026-08-30T12:00:00Z',
  },
] as const;

const REGRAS_RECURSO = [
  {
    codigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
    versao: 'v1',
    tipo: 'regra_prazo_recurso',
    declaracaoDaRegra: {},
    invariantes: {},
    baseLegal: 'Lei 9.784/1999, art. 59',
    hash: 'abc',
    modalidadesAdmitidas: null,
  },
] as const;

const REGRAS_CONSOLIDACAO = [
  {
    codigo: 'CONSOLIDACAO-AVALIACAO-UNICA',
    versao: 'v1',
    tipo: 'regra_consolidacao',
    declaracaoDaRegra: {},
    invariantes: ['um só avaliador lança a nota de cada candidato na etapa'],
    baseLegal: 'Decisão institucional da Unifesspa',
    hash: 'u1',
    modalidadesAdmitidas: null,
  },
  {
    codigo: 'CONSOLIDACAO-CORRECAO-INDEPENDENTE',
    versao: 'v1',
    tipo: 'regra_consolidacao',
    declaracaoDaRegra: {},
    invariantes: ['mais de um avaliador corrige cada candidato sem conhecer a nota do outro'],
    baseLegal: 'Decisão institucional da Unifesspa',
    hash: 'c1',
    modalidadesAdmitidas: null,
  },
] as const;

const CATALOGOS: readonly CatalogoMockado[] = [
  ['configuracao/tipos-processo', TIPOS_PROCESSO],
  ['configuracao/fases-canonicas', FASES_CANONICAS],
  ['configuracao/precedencias-fase', []],
  ['organizacao/unidades', []],
  ['configuracao/tipos-banca', TIPOS_BANCA],
  ['configuracao/categorias-documento', CATEGORIAS_DOCUMENTO],
  ['configuracao/tipos-etapa', TIPOS_ETAPA],
  ['configuracao/tipos-documento', TIPOS_DOCUMENTO],
  ['configuracao/fatos-candidato', []],
  ['publicacoes/tipos-ato', TIPOS_ATO],
];

export async function mockarCatalogos(page: Page): Promise<void> {
  await responderCatalogos(page, CATALOGOS, CORS_DA_ETAPA);
  await responderRegrasDoCatalogo(
    page,
    { regra_prazo_recurso: REGRAS_RECURSO, regra_consolidacao: REGRAS_CONSOLIDACAO },
    CORS_DA_ETAPA,
  );
}
