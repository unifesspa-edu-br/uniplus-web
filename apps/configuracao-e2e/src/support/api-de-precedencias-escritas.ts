import { expect, type Locator, type Page, type Route } from '@playwright/test';
import { mockCatalogoDeFases } from './api-de-fases-canonicas';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const ARESTA = {
  id: '01960000-0000-7000-0000-0000000000a1',
  antecessoraCodigo: 'INSCRICAO',
  sucessoraCodigo: 'HOMOLOGACAO_INSCRICOES',
  permiteSobreposicao: false,
  criadoEm: '2026-07-15T12:00:00Z',
};

/** Atraso da recarga da lista após a escrita: o botão da linha ainda está indisponível quando o diálogo fecha. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

export const PROBLEMA_409_PROCESSANDO = {
  type: 'about:blank',
  title: 'Escrita em processamento',
  status: 409,
  code: 'uniplus.idempotency.processing_conflict',
};
export const PROBLEMA_422_DUPLICADA = {
  type: 'about:blank',
  title: 'Já existe uma aresta de precedência viva com este par de fases',
  status: 422,
  code: 'uniplus.configuracao.precedencia_fase.aresta_duplicada',
};
export const PROBLEMA_403_REMOCAO = {
  type: 'about:blank',
  title: 'Acesso negado',
  status: 403,
  code: 'uniplus.auth.forbidden',
};
export const PROBLEMA_404 = {
  type: 'about:blank',
  title: 'Aresta de precedência não encontrada',
  status: 404,
  code: 'uniplus.configuracao.precedencia_fase.nao_encontrada',
};
export const PROBLEMA_500 = {
  type: 'about:blank',
  title: 'Erro interno',
  status: 500,
  code: 'uniplus.internal.unexpected',
};
export const RECUSA_DE_SUCESSORA = {
  type: 'about:blank',
  title: 'Código da fase sucessora em formato inválido',
  status: 422,
  code: 'uniplus.configuracao.precedencia_fase.sucessora_codigo_formato_invalido',
  errors: [
    {
      field: 'sucessoraCodigo',
      code: 'uniplus.configuracao.precedencia_fase.sucessora_codigo_formato_invalido',
      message: 'Sucessora fora do padrão.',
    },
  ],
};

export type Recarga = 'com-o-item' | 'sem-o-item' | 'com-falha';
export type Resposta = { status: number; corpo?: unknown };
export const CRIADO: Resposta = { status: 201 };
export const SALVO: Resposta = { status: 204 };

interface Estado {
  gravou: boolean;
  consultas: number;
}

const problema = (route: Route, corpo: unknown, status: number) =>
  route.fulfill({
    status,
    headers: CORS_HEADERS,
    contentType: 'application/problem+json',
    body: JSON.stringify(corpo),
  });

async function responderLista(route: Route, recarga: Recarga | 'inicial') {
  if (recarga === 'com-falha') {
    await problema(route, PROBLEMA_500, 500);
    return;
  }
  const itens = { inicial: [ARESTA], 'com-o-item': [ARESTA], 'sem-o-item': [] };
  await route.fulfill({ status: 200, headers: CORS_HEADERS, json: itens[recarga] });
}

const esperarRecarga = () => new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));

async function responderConsulta(
  route: Route,
  estado: Estado,
  recarga: Recarga,
  primeiraConsulta: 'ok' | 'falha',
) {
  estado.consultas += 1;
  if (primeiraConsulta === 'falha' && estado.consultas === 1) {
    await problema(route, PROBLEMA_500, 500);
    return;
  }
  if (estado.gravou || estado.consultas > 1) await esperarRecarga();
  await responderLista(route, estado.gravou ? recarga : 'inicial');
}

async function mockLeituras(
  page: Page,
  estado: Estado,
  recarga: Recarga,
  primeiraConsulta: 'ok' | 'falha',
) {
  await page.route(/\/api\/configuracao\/fases-canonicas(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, headers: CORS_HEADERS, json: [] }),
  );
  await page.route(/\/api\/configuracao\/precedencias-fase(\?.*)?$/, (route) =>
    responderConsulta(route, estado, recarga, primeiraConsulta),
  );
}

function corpoDaEscrita({ status, corpo }: Resposta) {
  if (corpo !== undefined) {
    return { contentType: 'application/problem+json', body: JSON.stringify(corpo) };
  }
  if (status === 201) {
    return { contentType: 'application/json', body: JSON.stringify('nova-aresta-id') };
  }
  return {};
}

const responderEscrita = (route: Route, resposta: Resposta) =>
  route.fulfill({ status: resposta.status, headers: CORS_HEADERS, ...corpoDaEscrita(resposta) });

const responderPreflight = (route: Route) => route.fulfill({ status: 204, headers: CORS_HEADERS });

async function registrarEscrita(
  route: Route,
  resposta: Resposta,
  estado: Estado,
  retida: Promise<void>,
) {
  await retida;
  if (resposta.status < 300 || resposta.status === 404) estado.gravou = true;
  await responderEscrita(route, resposta);
}

function tratarEscrita(
  respostas: readonly Resposta[],
  estado: Estado,
  retida: Promise<void>,
  envios: string[],
) {
  return async (route: Route) => {
    if (route.request().method() === 'OPTIONS') return responderPreflight(route);
    const resposta = respostas[envios.length];
    envios.push(route.request().method());
    await registrarEscrita(route, resposta, estado, retida);
  };
}

async function mockEscritas(page: Page, respostas: readonly Resposta[], estado: Estado) {
  let liberar: () => void = () => undefined;
  const retida = new Promise<void>((resolve) => (liberar = resolve));
  const envios: string[] = [];
  const escrita = tratarEscrita(respostas, estado, retida, envios);
  await page.route(/\/api\/configuracao\/admin\/precedencias-fase\/[^/?]+$/, escrita);
  await page.route(/\/api\/configuracao\/admin\/precedencias-fase(\?.*)?$/, escrita);
  return { liberar, envios };
}

/** Cada POST, PUT ou DELETE consome a próxima resposta e fica retido até `liberar`. */
export async function mockApi(
  page: Page,
  respostas: readonly Resposta[],
  recarga: Recarga,
  primeiraConsulta: 'ok' | 'falha' = 'ok',
) {
  const estado: Estado = { gravou: false, consultas: 0 };
  await mockCatalogoDeFases(page);
  await mockLeituras(page, estado, recarga, primeiraConsulta);
  return mockEscritas(page, respostas, estado);
}

const NOME_DO_PAR = `precedência entre ${ARESTA.antecessoraCodigo} e ${ARESTA.sucessoraCodigo}`;
export const titulo = (page: Page): Locator =>
  page.getByRole('heading', { name: 'Arestas de precedência', level: 2 });
export const novo = (page: Page): Locator => page.locator('#cfg-precedencias-fase-nova');
export const editar = (page: Page): Locator =>
  page.getByRole('button', { name: `Editar ${NOME_DO_PAR}` });
export const lixeira = (page: Page): Locator =>
  page.getByRole('button', { name: `Remover ${NOME_DO_PAR}` });
export const drawer = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Formulário de aresta de precedência' });
const confirmacao = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Remover aresta de precedência' });

export async function abrirCadastro(page: Page): Promise<Locator> {
  await page.goto('/precedencias-fase');
  await novo(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  await formulario.locator('select[formcontrolname="antecessoraCodigo"]').selectOption('AVALIACAO');
  await formulario
    .locator('select[formcontrolname="sucessoraCodigo"]')
    .selectOption('CLASSIFICACAO');
  return formulario;
}

export async function abrirEdicao(page: Page): Promise<Locator> {
  await page.goto('/precedencias-fase');
  await editar(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  return formulario;
}

export async function abrirRemocao(page: Page) {
  await page.goto('/precedencias-fase');
  await lixeira(page).click();
  const dialogo = confirmacao(page);
  return { dialogo, remover: dialogo.getByRole('button', { name: 'Remover', exact: true }) };
}
