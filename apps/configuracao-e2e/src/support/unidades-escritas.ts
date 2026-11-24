import { expect, type Locator, type Page, type Route } from '@playwright/test';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

interface Item {
  id: string;
  nome: string;
  alias: string | null;
  slug: string;
  sigla: string;
  codigo: string;
  unidadeSuperiorId: string | null;
  tipo: string;
  unidadeAcademica: boolean;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  criadoEm: string;
  cidadeCodigoIbge: string | null;
  cidadeNome: string | null;
  cidadeUf: string | null;
}

const REITORIA: Item = {
  id: '01960000-0000-7000-0000-0000000000a1',
  nome: 'Reitoria',
  alias: null,
  slug: 'reitoria',
  sigla: 'REIT',
  codigo: '001',
  unidadeSuperiorId: null,
  tipo: 'REITORIA',
  unidadeAcademica: false,
  vigenciaInicio: '2020-01-01',
  vigenciaFim: null,
  criadoEm: '2020-01-01T00:00:00Z',
  cidadeCodigoIbge: null,
  cidadeNome: null,
  cidadeUf: null,
};
const INSTITUTO: Item = {
  ...REITORIA,
  id: '01960000-0000-7000-0000-0000000000a2',
  nome: 'Instituto de Ciências Exatas',
  slug: 'ice',
  sigla: 'ICE',
  codigo: '002',
  tipo: 'INSTITUTO',
};

/** Atraso da recarga da lista após a escrita: o botão da linha ainda está indisponível quando o diálogo fecha. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

const problema = (status: number, code: string, title: string) => ({
  type: 'about:blank',
  title,
  status,
  code,
});
export const PROBLEMA_409_PROCESSANDO = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'Escrita em processamento',
);
export const PROBLEMA_409_SIGLA = problema(
  409,
  'uniplus.organizacao.unidade.sigla_ja_existe',
  'Sigla já está em uso por outra unidade',
);
export const PROBLEMA_409_SUBORDINADAS = problema(
  409,
  'uniplus.organizacao.unidade.remocao_bloqueada_por_subordinadas',
  'Unidade possui subordinadas vivas',
);
export const PROBLEMA_500 = problema(500, 'uniplus.internal.unexpected', 'Erro interno');
const CODIGO_NOME_TAMANHO = 'uniplus.organizacao.unidade.nome_tamanho';
export const RECUSA_DE_NOME = {
  type: 'about:blank',
  title: 'Nome fora do padrão',
  status: 422,
  code: CODIGO_NOME_TAMANHO,
  errors: [{ field: 'nome', code: CODIGO_NOME_TAMANHO, message: 'Nome fora do padrão.' }],
};

/** O que a lista devolve depois da escrita bem-sucedida: os itens, ou a falha da recarga. */
type Recarga = readonly Item[] | 'falha';
type Resposta = { status: number; corpo?: unknown };
export const CRIADO: Resposta = { status: 201 };
export const SALVO: Resposta = { status: 204 };

export const COM_AMBAS: readonly Item[] = [REITORIA, INSTITUTO];
export const SEM_A_REITORIA: readonly Item[] = [INSTITUTO];

const respostaDeProblema = (route: Route, status: number, corpo: unknown) =>
  route.fulfill({
    status,
    headers: CORS_HEADERS,
    contentType: 'application/problem+json',
    body: JSON.stringify(corpo),
  });

/** Cada POST, PUT ou DELETE consome a próxima resposta e fica retido até `liberar`. */
type Estado = {
  gravou: boolean;
  consultas: number;
  envios: string[];
  retida: Promise<void>;
  respostas: readonly Resposta[];
  recarga: Recarga;
  primeiraConsulta: 'ok' | 'falha';
};

async function responderLista(route: Route, estado: Estado) {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
    return;
  }
  estado.consultas += 1;
  if (estado.primeiraConsulta === 'falha' && estado.consultas === 1) {
    await respostaDeProblema(route, 500, PROBLEMA_500);
    return;
  }
  if (estado.gravou || (estado.primeiraConsulta === 'falha' && estado.consultas > 1)) {
    await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
  }
  await responderRecarga(route, estado);
}

async function responderRecarga(route: Route, estado: Estado) {
  if (!estado.gravou) await route.fulfill({ status: 200, headers: CORS_HEADERS, json: COM_AMBAS });
  else if (estado.recarga === 'falha') await respostaDeProblema(route, 500, PROBLEMA_500);
  else await route.fulfill({ status: 200, headers: CORS_HEADERS, json: estado.recarga });
}

async function responderEscrita(route: Route, estado: Estado) {
  const metodo = route.request().method();
  if (metodo === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
    return;
  }
  const resposta = estado.respostas[estado.envios.length];
  estado.envios.push(metodo);
  await estado.retida;
  if (resposta.status < 300) estado.gravou = true;
  await concluirEscrita(route, resposta);
}

async function concluirEscrita(route: Route, resposta: Resposta) {
  if (resposta.corpo !== undefined) {
    await respostaDeProblema(route, resposta.status, resposta.corpo);
    return;
  }
  await route.fulfill({
    status: resposta.status,
    headers: CORS_HEADERS,
    ...(resposta.status === 201
      ? { contentType: 'application/json', body: JSON.stringify('novo-id') }
      : {}),
  });
}

async function rotaLeitura(page: Page, estado: Estado) {
  await page.route(/\/api\/organizacao\/unidades(\?.*)?$/, (route) =>
    responderLista(route, estado),
  );
}

async function rotaEscrita(page: Page, estado: Estado) {
  await page.route(/\/api\/organizacao\/admin\/unidades(\/[^?]*)?$/, (route) =>
    responderEscrita(route, estado),
  );
}

function criarEstado(
  respostas: readonly Resposta[],
  recarga: Recarga,
  primeiraConsulta: 'ok' | 'falha',
  retida: Promise<void>,
): Estado {
  return { gravou: false, consultas: 0, envios: [], retida, respostas, recarga, primeiraConsulta };
}

export async function mockApi(
  page: Page,
  respostas: readonly Resposta[],
  recarga: Recarga,
  primeiraConsulta: 'ok' | 'falha' = 'ok',
) {
  let liberar: () => void = () => undefined;
  const retida = new Promise<void>((resolve) => (liberar = resolve));
  const estado = criarEstado(respostas, recarga, primeiraConsulta, retida);
  await rotaLeitura(page, estado);
  await rotaEscrita(page, estado);
  return { liberar, envios: estado.envios };
}

export const titulo = (page: Page): Locator =>
  page.getByRole('heading', { name: 'Unidades', level: 2, exact: true });
export const novo = (page: Page): Locator => page.getByRole('button', { name: 'Nova unidade' });
export const editar = (page: Page): Locator =>
  page.getByRole('button', { name: `Editar unidade ${REITORIA.sigla}` });
export const lixeira = (page: Page): Locator =>
  page.getByRole('button', { name: `Remover unidade ${REITORIA.sigla}` });
const drawer = (page: Page): Locator => page.getByRole('dialog', { name: 'Formulário de unidade' });
const confirmacao = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Remover unidade', exact: true });

export async function abrirCadastro(page: Page): Promise<Locator> {
  await page.goto('/unidades');
  await novo(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  await formulario.locator('input[formcontrolname="sigla"]').fill('NTEC');
  await formulario.locator('input[formcontrolname="slug"]').fill('ntec');
  await formulario.locator('input[formcontrolname="codigo"]').fill('500');
  await formulario.locator('input[formcontrolname="nome"]').fill('Núcleo de Tecnologia');
  return formulario;
}

export async function abrirEdicao(page: Page): Promise<Locator> {
  await page.goto('/unidades');
  await editar(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  return formulario;
}

export async function abrirConfirmacao(page: Page) {
  await page.goto('/unidades');
  await lixeira(page).click();
  const dialogo = confirmacao(page);
  return { dialogo, confirmar: dialogo.getByRole('button', { name: 'Remover', exact: true }) };
}
