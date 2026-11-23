import type { Page } from '@playwright/test';
import { CORS_DE_LEITURA } from '../support/processo-mockado';
import { OPCOES_DO_RECURSO } from './opcoes-do-recurso';
import { TIPOS_DE_BANCA } from './tipos-de-banca';
import { TIPOS_DE_DECISAO_DA_API } from '../support/vocabulario-de-tipos-de-decisao';
import { VOCABULARIOS_DA_COMPROVACAO } from './vocabularios-da-comprovacao';
import {
  responderCatalogos,
  responderRegrasDoCatalogo,
  type CatalogoMockado,
} from '../support/responder';

export const TIPOS_PROCESSO = [
  {
    id: '01960000-0000-7000-0000-000000000515',
    codigo: 'SISU',
    nome: 'SISU',
    descricao: 'Seleção unificada pelo ENEM.',
    ativo: true,
    criadoEm: '2026-08-11T00:00:00Z',
  },
] as const;

export const FASES_CANONICAS = [
  {
    id: '01960000-0000-7000-0000-0000000000c1',
    codigo: 'COLETA_INSCRICAO',
    nome: 'Inscrição',
    descricao: null,
    unidadeSugerida: null,
    agrupaEtapas: false,
    permiteComplementacao: false,
    admiteAgruparEtapas: false,
    admiteComplementacao: false,
    baseLegal: null,
    coletaInscricao: true,
    origemData: 'NO_EDITAL',
    criadoEm: '2026-08-30T12:00:00Z',
  },
  {
    id: '01960000-0000-7000-0000-0000000000c2',
    codigo: 'AVALIACAO',
    nome: 'Avaliação',
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

export const CATEGORIAS_DE_DOCUMENTO = [
  {
    id: '01960000-0000-7000-0000-0000000000d1',
    codigo: 'RACA_ETNIA',
    nome: 'Raça e etnia',
    descricao: null,
    ordem: 1,
    criadoEm: '2026-08-30T12:00:00Z',
  },
  {
    id: '01960000-0000-7000-0000-0000000000d2',
    codigo: 'RENDA',
    nome: 'Renda',
    descricao: null,
    ordem: 2,
    criadoEm: '2026-08-30T12:00:00Z',
  },
] as const;

/**
 * Um documento de nome longo, com descrição: é o caso que espremia o título do card ao lado
 * da ação de remover numa tela estreita.
 */
export const NOME_DOCUMENTO = 'Requerimento de inclusão do nome social no registro acadêmico';
export const TIPOS_DOCUMENTO = [
  {
    id: '01960000-0000-7000-0000-0000000000f1',
    codigo: 'REQUERIMENTO_NOME_SOCIAL',
    nome: NOME_DOCUMENTO,
    descricao: 'Pedido de uso do nome social nos documentos emitidos pela universidade.',
    categoria: 'IDENTIFICACAO',
    formatosAceitos: 'pdf',
    tamanhoMaximoMb: 10,
    tipoEquivalente: null,
    protecaoAprovada: true,
    criadoEm: '2026-08-30T12:00:00Z',
  },
] as const;

/** O catálogo não tem `nome` nem `descricao` — só `codigo` e `baseLegal` são legíveis. */
export const REGRAS_CONTAGEM = [
  {
    codigo: 'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL',
    versao: 'v1',
    tipo: 'algoritmo_contagem_prazo',
    declaracaoDaRegra: {},
    invariantes: ['o dia da âncora não conta'],
    baseLegal: 'Lei 9.784/1999, art. 66',
    hash: 'xyz',
    modalidadesAdmitidas: null,
  },
] as const;

/**
 * A opção traz só o que identifica a convenção. A base legal saiu do rótulo porque as três
 * convenções de contagem do catálogo têm a MESMA, e repeti-la em cada linha empurrava o
 * código para fora da largura do campo; ela aparece uma vez, abaixo, junto do que a
 * convenção escolhida faz.
 */
export const ROTULO_CONVENCAO = 'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL (v1)';

const CATALOGOS: readonly CatalogoMockado[] = [
  ['configuracao/tipos-processo', TIPOS_PROCESSO],
  ['configuracao/fases-canonicas', FASES_CANONICAS],
  ['configuracao/precedencias-fase', []],
  ['organizacao/unidades', []],
  ['configuracao/tipos-banca', TIPOS_DE_BANCA],
  ['configuracao/categorias-documento', CATEGORIAS_DE_DOCUMENTO],
  ['configuracao/tipos-documento', TIPOS_DOCUMENTO],
  ['configuracao/tipos-etapa', []],
  ['configuracao/fatos-candidato', []],
  ['publicacoes/tipos-ato', []],
  ...OPCOES_DO_RECURSO,
  TIPOS_DE_DECISAO_DA_API,
  ...VOCABULARIOS_DA_COMPROVACAO,
];

/**
 * Os catálogos que a linha do tempo e o seletor de convenção consultam. Vazio
 * onde a tela não precisa da lista, com conteúdo onde ela é o que se exercita.
 *
 * `regras-catalogo` é filtrado por `tipo`: só `algoritmo_contagem_prazo`
 * devolve conteúdo — é a única dimensão que este passo exercita aqui, e
 * devolver a mesma lista para qualquer tipo mascararia um filtro quebrado.
 */
export async function mockarCatalogos(page: Page): Promise<void> {
  await responderCatalogos(page, CATALOGOS, CORS_DE_LEITURA);
  await responderRegrasDoCatalogo(
    page,
    { algoritmo_contagem_prazo: REGRAS_CONTAGEM },
    CORS_DE_LEITURA,
  );
}
