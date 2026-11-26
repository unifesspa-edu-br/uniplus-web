import type { Page, Route } from '@playwright/test';

const REITORIA_ID = '01960000-0000-7000-0000-000000000001';
const INSTITUICAO_ID = '01960000-0000-7000-0000-0000000000a1';

const REITORIAS = [
  {
    id: REITORIA_ID,
    nome: 'Reitoria',
    alias: null,
    slug: 'reitoria',
    sigla: 'REITORIA',
    codigo: 'REITORIA',
    unidadeSuperiorId: null,
    tipo: 'REITORIA',
    unidadeAcademica: false,
    vigenciaInicio: '2026-01-01',
    vigenciaFim: null,
    criadoEm: '2026-06-10T12:00:00Z',
  },
] as const;

export const INSTITUICAO = {
  id: INSTITUICAO_ID,
  codigoEmec: '3990',
  nome: 'Universidade Federal do Sul e Sudeste do Pará',
  sigla: 'Unifesspa',
  organizacaoAcademica: 'Universidade',
  categoriaAdministrativa: 'Pública Federal',
  cnpj: null,
  mantenedora: null,
  codigoMantenedoraEmec: null,
  situacao: null,
  atoCredenciamento: null,
  atoRecredenciamento: null,
  conceitoInstitucional: null,
  igc: null,
  website: null,
  cidade: null,
  endereco: null,
  unidadeRaizId: REITORIA_ID,
  criadoEm: '2026-06-10T12:00:00Z',
} as const;

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

function comoJson(status: number, corpo: unknown) {
  return {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  };
}

/** Responde ao preflight e deixa passar o que não é do método esperado; devolve se a rota deve responder. */
async function ehDoMetodo(route: Route, metodo: string): Promise<boolean> {
  const requisicao = route.request();
  if (requisicao.method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
    return false;
  }
  if (requisicao.method() === metodo) return true;
  await route.continue();
  return false;
}

export async function mockReitoriasApi(page: Page): Promise<void> {
  await page.route(/\/api\/organizacao\/unidades(\?.*)?$/, async (route) => {
    if (await ehDoMetodo(route, 'GET')) await route.fulfill(comoJson(200, REITORIAS));
  });
}

async function rotaDaLeituraDaInstituicao(page: Page, existe: () => boolean): Promise<void> {
  await page.route(/\/api\/organizacao\/instituicao$/, async (route) => {
    if (!(await ehDoMetodo(route, 'GET'))) return;
    if (existe()) await route.fulfill(comoJson(200, INSTITUICAO));
    else await route.fulfill({ status: 404, headers: CORS_HEADERS });
  });
}

async function rotaDoCadastroDaInstituicao(page: Page, cadastrar: () => void): Promise<void> {
  await page.route(/\/api\/organizacao\/admin\/instituicao$/, async (route) => {
    if (!(await ehDoMetodo(route, 'POST'))) return;
    cadastrar();
    await route.fulfill(comoJson(201, INSTITUICAO_ID));
  });
}

/** GET do singleton: 200 quando existe, 404 quando não; o POST de criação faz a ficha passar a existir. */
export async function mockInstituicaoApi(page: Page, options: { existe: boolean }): Promise<void> {
  let existe = options.existe;
  await rotaDaLeituraDaInstituicao(page, () => existe);
  await rotaDoCadastroDaInstituicao(page, () => {
    existe = true;
  });
}
