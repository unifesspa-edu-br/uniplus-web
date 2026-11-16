import { expect, type Page, type Route, type TestInfo } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import {
  CURSOS_DA_MEDICINA,
  MODALIDADES_DA_MEDICINA,
  OFERTAS_DA_MEDICINA,
  REFERENCIAS_DEMOGRAFICAS_DA_MEDICINA,
  REGRAS_DE_AJUSTE_DA_MEDICINA,
  REGRAS_DE_CASCATA_DA_MEDICINA,
  REGRAS_DE_DISTRIBUICAO_DA_MEDICINA,
} from '../fixtures/medicina/catalogos-da-medicina';
import { PROCESSO_DA_MEDICINA } from '../fixtures/vagas-da-medicina';
import { PERMISSOES_DO_LEANDRO } from './permissoes';
import { irAoPasso } from './navega-passo';
import { responder, responderCom } from './responder';
import { instalarPreferencia, temaDoProject } from './tema';

export type Status = 'rascunho' | 'publicado';
export type Catalogos = 'ok' | 'falha';

export interface OpcoesDoPassoDeVagas {
  readonly status?: Status;
  readonly catalogos?: Catalogos;
  /** O que o servidor devolve ao simular o quadro: uma distribuição calculada por oferta. */
  readonly simulacao?: readonly unknown[];
}

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, accept, content-type',
};

const ROTA_DE_SIMULACAO = '/distribuicao-vagas/simulacao';

const CATALOGOS_DE_CONFIGURACAO: readonly (readonly [RegExp, readonly unknown[]])[] = [
  [/\/api\/configuracao\/ofertas-curso(\?.*)?$/, OFERTAS_DA_MEDICINA],
  [/\/api\/configuracao\/cursos(\?.*)?$/, CURSOS_DA_MEDICINA],
  [/\/api\/configuracao\/modalidades(\?.*)?$/, MODALIDADES_DA_MEDICINA],
  [
    /\/api\/configuracao\/referencias-reserva-demografica(\?.*)?$/,
    REFERENCIAS_DEMOGRAFICAS_DA_MEDICINA,
  ],
];

/** Cada regra do catálogo é lida pelo tipo; devolver a mesma lista a qualquer tipo mascararia um filtro quebrado. */
const REGRAS_POR_TIPO: Record<string, readonly unknown[]> = {
  regra_distribuicao_vagas: REGRAS_DE_DISTRIBUICAO_DA_MEDICINA,
  regra_ajuste_distribuicao_vagas: REGRAS_DE_AJUSTE_DA_MEDICINA,
  criterio_remanejamento: REGRAS_DE_CASCATA_DA_MEDICINA,
};

/**
 * Abre o passo Vagas do processo da Medicina 2027. O CI do frontend sobe Keycloak, mas não a API:
 * o processo, os catálogos e a simulação são servidos por rota, e toda outra consulta responde
 * vazia.
 */
export async function abrirVagas(
  page: Page,
  testInfo: TestInfo,
  opcoes: OpcoesDoPassoDeVagas = {},
): Promise<void> {
  const { catalogos = 'ok' } = opcoes;
  await mockarApi(page, opcoes);
  await instalarPreferencia(page, temaDoProject(testInfo.project.name));
  await page.goto(`/processo-seletivo/${PROCESSO_DA_MEDICINA.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await irAoPasso(page, 'Vagas', testInfo);
  await esperarOPasso(page, catalogos);
}

async function esperarOPasso(page: Page, catalogos: Catalogos): Promise<void> {
  if (catalogos === 'falha') {
    // Sem as regras do catálogo a matriz da cascata não se monta: o que há para ler é o padrão.
    await expect(page.getByRole('heading', { name: 'Padrão desta distribuição' })).toBeVisible();
    return;
  }
  await expect(page.getByRole('heading', { name: 'Cascata de remanejamento' })).toBeVisible();
  await expect(page.locator('.cascata-matriz tbody tr')).toHaveCount(8);
}

/** A rota genérica vai primeiro: o Playwright consulta as rotas da mais recente para a mais antiga. */
async function mockarApi(page: Page, opcoes: OpcoesDoPassoDeVagas): Promise<void> {
  await responder(page, /\/api\//, [], CORS_HEADERS);
  await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);
  for (const [rota, corpo] of CATALOGOS_DE_CONFIGURACAO) {
    await responder(page, rota, corpo, CORS_HEADERS);
  }
  await mockarRegrasCatalogo(page);
  if (opcoes.catalogos === 'falha') await falharCatalogos(page);
  await mockarProcesso(page, opcoes);
}

async function mockarProcesso(page: Page, opcoes: OpcoesDoPassoDeVagas): Promise<void> {
  const processo = new RegExp(`/api/selecao/processos-seletivos/${PROCESSO_DA_MEDICINA.id}`);
  await page.route(processo, (route) => aoProcesso(route, opcoes));
}

async function aoProcesso(route: Route, opcoes: OpcoesDoPassoDeVagas): Promise<void> {
  const requisicao = route.request();
  if (requisicao.method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
    return;
  }
  const corpo = corpoDoProcesso(requisicao.method(), new URL(requisicao.url()).pathname, opcoes);
  if (corpo === undefined) {
    await route.fulfill({ status: 404, headers: CORS_HEADERS });
    return;
  }
  await responderCom(route, corpo, CORS_HEADERS);
}

function corpoDoProcesso(
  metodo: string,
  caminho: string,
  { status = 'publicado', simulacao = [] }: OpcoesDoPassoDeVagas,
): unknown {
  if (caminho.endsWith(PROCESSO_DA_MEDICINA.id)) return { ...PROCESSO_DA_MEDICINA, status };
  if (caminho.endsWith('/documentos-a-publicar')) return [];
  if (metodo === 'POST' && caminho.endsWith(ROTA_DE_SIMULACAO)) return simulacao;
  return undefined;
}

async function mockarRegrasCatalogo(page: Page): Promise<void> {
  await page.route(/\/api\/selecao\/regras-catalogo(\?.*)?$/, async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    const tipo = new URL(route.request().url()).searchParams.get('tipo') ?? '';
    await responderCom(route, REGRAS_POR_TIPO[tipo] ?? [], CORS_HEADERS);
  });
}

const CATALOGOS_EM_FALHA =
  /\/api\/(configuracao\/(ofertas-curso|cursos|modalidades|referencias-reserva-demografica)|selecao\/regras-catalogo)(\/.*|\?.*)?$/;

async function recusarCatalogo(route: Route): Promise<void> {
  const falha = { status: 503, contentType: 'application/json', body: '{}' };
  const preflight = route.request().method() === 'OPTIONS';
  await route.fulfill({ ...(preflight ? { status: 204 } : falha), headers: CORS_HEADERS });
}

/** Registrada depois das rotas dos catálogos, porque o Playwright consulta da mais recente. */
async function falharCatalogos(page: Page): Promise<void> {
  await page.route(CATALOGOS_EM_FALHA, recusarCatalogo);
}
