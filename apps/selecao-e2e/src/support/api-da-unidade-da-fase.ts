import type { Page, Route } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import {
  FASES_DO_CATALOGO,
  FATOS_DO_CANDIDATO,
  TIPOS_DE_ATO,
  UNIDADE_ADMINISTRADORA,
  UNIDADE_CEPS,
  UNIDADE_CGA,
} from '../fixtures/cenario-da-unidade-da-fase';
import { TIPOS_DE_PROCESSO } from '../fixtures/consulta-da-medicina';
import {
  ATO_PUBLICADO,
  ID_DO_PROCESSO_COMPLETO,
  PROCESSO_PUBLICADO_COMPLETO,
  UNIDADE_RESPONSAVEL_DA_FASE,
} from '../fixtures/processo-publicado-completo';
import { leituraDoProcessoCompleto } from './leituras-do-processo-completo';
import { PERMISSOES_DO_LEANDRO } from './permissoes';
import { responder, responderCom } from './responder';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, accept, content-type, idempotency-key, if-match',
};

const PROBLEM_JSON = 'application/problem+json';
const SEM_CONTEUDO = { status: 204, headers: CORS };
const ROTA_DO_PROCESSO = new RegExp(`/api/selecao/processos-seletivos/${ID_DO_PROCESSO_COMPLETO}`);
const ROTA_DO_ATO_PUBLICADO = new RegExp(`/api/publicacoes/atos/${ATO_PUBLICADO.id}$`);
const PRODUTO_DEFINITIVO = {
  id: '01a0d640-0000-7000-8000-0000000000d2',
  atoCodigo: 'RESULTADO_FINAL',
  papel: 'DEFINITIVO',
};

type UnidadeDaFase = typeof UNIDADE_RESPONSAVEL_DA_FASE | null;

export interface Capturado {
  readonly cronogramas: { unidadeResponsavelId: string | null }[][];
  readonly publicacoes: unknown[];
  fase: Record<string, unknown>;
  publicado: boolean;
  recusaDeUnidade: boolean;
}

function faseDoProcesso(unidadeDaFase: UnidadeDaFase): Record<string, unknown> {
  const [primeira] = PROCESSO_PUBLICADO_COMPLETO.cronogramaFases;
  return {
    ...primeira,
    produtos: [...primeira.produtos, PRODUTO_DEFINITIVO],
    unidadeResponsavel: unidadeDaFase,
  };
}

export function novoCapturado(unidadeDaFase: UnidadeDaFase): Capturado {
  return {
    cronogramas: [],
    publicacoes: [],
    fase: faseDoProcesso(unidadeDaFase),
    publicado: false,
    recusaDeUnidade: false,
  };
}

function problema(status: number, code: string, title: string, errors?: unknown) {
  return {
    type: 'about:blank',
    title,
    status,
    code,
    traceId: '00000000000000000000000000000001',
    errors,
  };
}

async function recusar(route: Route, corpo: unknown): Promise<void> {
  await route.fulfill({
    status: 422,
    contentType: PROBLEM_JSON,
    headers: CORS,
    body: JSON.stringify(corpo),
  });
}

async function mockarCatalogos(page: Page): Promise<void> {
  const unidades = [UNIDADE_CEPS, UNIDADE_CGA, UNIDADE_ADMINISTRADORA];
  await responder(page, /\/api\//, [], CORS);
  await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);
  await responder(page, /\/api\/configuracao\/tipos-processo(\?.*)?$/, TIPOS_DE_PROCESSO, CORS);
  await responder(page, /\/api\/configuracao\/fases-canonicas(\?.*)?$/, FASES_DO_CATALOGO, CORS);
  await responder(page, /\/api\/configuracao\/fatos-candidato(\?.*)?$/, FATOS_DO_CANDIDATO, CORS);
  await responder(page, /\/api\/publicacoes\/tipos-ato(\?.*)?$/, TIPOS_DE_ATO, CORS);
  await responder(page, /\/api\/organizacao\/unidades(\?.*)?$/, unidades, CORS);
  await responder(page, ROTA_DO_ATO_PUBLICADO, ATO_PUBLICADO, CORS);
}

function detalheDoProcesso(capturado: Capturado) {
  return {
    ...PROCESSO_PUBLICADO_COMPLETO,
    status: capturado.publicado ? 'publicado' : 'rascunho',
    cronogramaFases: [capturado.fase],
    atendimentoEspecializado: null,
    raizesExigencia: PROCESSO_PUBLICADO_COMPLETO.raizesExigencia.slice(0, 1),
    classificacao: { ...PROCESSO_PUBLICADO_COMPLETO.classificacao, regrasEliminacao: [] },
  };
}

async function ler(route: Route, capturado: Capturado, caminho: string): Promise<void> {
  const corpo = caminho.endsWith(ID_DO_PROCESSO_COMPLETO)
    ? detalheDoProcesso(capturado)
    : leituraDoProcessoCompleto(caminho);
  if (corpo === undefined) await route.fulfill({ status: 404, headers: CORS });
  else await responderCom(route, corpo, CORS);
}

function unidadeEscolhida(cronograma: { unidadeResponsavelId: string | null }[]) {
  const [fase] = cronograma;
  const escolhida = [UNIDADE_CEPS, UNIDADE_CGA].find(
    (unidade) => unidade.id === fase?.unidadeResponsavelId,
  );
  if (!escolhida) return null;
  const { sigla, slug, nome } = escolhida;
  return { origemId: escolhida.id, sigla, slug, nome };
}

async function recusarUnidade(route: Route): Promise<void> {
  const erro = {
    field: 'fases[0].unidadeResponsavelId',
    code: 'uniplus.selecao.fase_cronograma.unidade_responsavel_nao_encontrada',
    message: 'x',
  };
  await recusar(route, problema(422, 'uniplus.validacao', 'Validação', [erro]));
}

async function gravarCronograma(
  route: Route,
  capturado: Capturado,
  cronograma: { unidadeResponsavelId: string | null }[],
): Promise<void> {
  capturado.cronogramas.push(cronograma);
  if (capturado.recusaDeUnidade) {
    await recusarUnidade(route);
    return;
  }
  capturado.fase = { ...capturado.fase, unidadeResponsavel: unidadeEscolhida(cronograma) };
  await route.fulfill(SEM_CONTEUDO);
}

async function publicar(route: Route, capturado: Capturado, comando: unknown): Promise<void> {
  capturado.publicacoes.push(comando);
  if (capturado.fase['unidadeResponsavel'] === null) {
    const titulo = 'A fase precisa de unidade responsável para publicar.';
    const code = 'uniplus.selecao.processo_seletivo.fase_sem_unidade_responsavel';
    await recusar(route, problema(422, code, titulo));
    return;
  }
  capturado.publicado = true;
  await route.fulfill(SEM_CONTEUDO);
}

async function escrever(route: Route, capturado: Capturado, caminho: string): Promise<void> {
  const corpo = route.request().postDataJSON();
  if (caminho.endsWith('/cronograma-fases')) return gravarCronograma(route, capturado, corpo);
  if (caminho.endsWith('/publicacao')) return publicar(route, capturado, corpo);
  if (caminho.endsWith('/distribuicao-vagas/simulacao')) {
    return responderCom(route, PROCESSO_PUBLICADO_COMPLETO.distribuicaoVagas, CORS);
  }
  return route.fulfill(SEM_CONTEUDO);
}

async function atenderOProcesso(route: Route, capturado: Capturado): Promise<void> {
  const request = route.request();
  const caminho = new URL(request.url()).pathname;
  if (request.method() === 'OPTIONS') return route.fulfill(SEM_CONTEUDO);
  if (request.method() === 'GET') return ler(route, capturado, caminho);
  return escrever(route, capturado, caminho);
}

export async function mockarApi(page: Page, capturado: Capturado): Promise<void> {
  await mockarCatalogos(page);
  await page.route(ROTA_DO_PROCESSO, (route: Route) => atenderOProcesso(route, capturado));
}
