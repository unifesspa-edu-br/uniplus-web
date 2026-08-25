import { expect, test, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * E2E funcional do cadastro de Oferta de Curso (issue #389). Convenção do
 * repo: runtime-config e API mockados por `page.route`; autenticação real
 * (Keycloak) via projeto `fluxo-chromium` (auth-setup + storageState).
 */

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const CURSO_ID = '01960000-0000-7000-0000-0000000000c1';
const LOCAL_ID = '01960000-0000-7000-0000-0000000000e1';
const UNIDADE_ID = '01960000-0000-7000-0000-0000000000f1';
const OFERTA_ID = '01960000-0000-7000-0000-0000000000d1';

const cursoSeed = {
  id: CURSO_ID,
  codigo: 'ENG-CIV',
  nome: 'Engenharia Civil',
  grau: 'Bacharelado',
  nivelEnsino: 'Graduação',
  grupoAreaEnem: 'Tecnológica',
  criadoEm: '2026-06-10T12:00:00Z',
};

const localSeed = {
  id: LOCAL_ID,
  tipo: 'campusSede',
  campusResponsavelId: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  codigoEmec: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

const unidadeSeed = {
  id: UNIDADE_ID,
  nome: 'Instituto de Geociências e Engenharias',
  alias: null,
  slug: 'ige',
  sigla: 'IGE',
  codigo: 'IGE',
  unidadeSuperiorId: null,
  tipo: 'Instituto',
  unidadeAcademica: true,
  vigenciaInicio: '2020-01-01',
  vigenciaFim: null,
};

const ofertaSeed = {
  id: OFERTA_ID,
  cursoId: CURSO_ID,
  localOfertaId: LOCAL_ID,
  unidadeOfertante: {
    origemId: UNIDADE_ID,
    sigla: 'IGE',
    nome: 'Instituto de Geociências e Engenharias',
    tipo: 'Instituto',
  },
  programaDeOferta: 'REGULAR',
  formatoPedagogico: 'PRESENCIAL',
  regimeDeTurno: 'REGULAR',
  turnos: ['MATUTINO'],
  eMecCodigo: '123456',
  codigoSga: null,
  vagasAnuaisAutorizadas: 40,
  baseLegal: null,
  atoAutorizacaoMec: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

/**
 * Marca um turno pelo gesto real do operador: o clique no rótulo. O
 * `input[type=checkbox]` do design system é visualmente oculto
 * (`opacity: 0; pointer-events: none`) e quem recebe o clique é o `label`,
 * então `check()` no input esperaria actionability indefinidamente.
 */
async function marcarTurno(page: Page, rotulo: string): Promise<void> {
  await page.locator('label.checkbox', { hasText: rotulo }).click();
  await expect(page.getByRole('checkbox', { name: rotulo })).toBeChecked();
}

async function jsonRoute(route: Route, body: unknown, status = 200): Promise<void> {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
    return;
  }
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  });
}

interface Capturado {
  readonly posts: unknown[];
  readonly puts: unknown[];
}

function novoCapturado(): Capturado {
  return { posts: [], puts: [] };
}

async function mockApi(
  page: Page,
  capturado: Capturado,
  ofertas: readonly unknown[],
): Promise<void> {
  await page.route(/\/api\/configuracao\/admin\/ofertas-curso\/[^/?]+$/, async (route) => {
    if (route.request().method() === 'PUT') {
      capturado.puts.push(route.request().postDataJSON());
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
  });
  await page.route(/\/api\/configuracao\/admin\/ofertas-curso(\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      capturado.posts.push(route.request().postDataJSON());
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify(OFERTA_ID),
      });
      return;
    }
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
  });
  await page.route(/\/api\/configuracao\/ofertas-curso(\?.*)?$/, (route) =>
    jsonRoute(route, ofertas),
  );
  await page.route(/\/api\/configuracao\/cursos(\?.*)?$/, (route) => jsonRoute(route, [cursoSeed]));
  await page.route(/\/api\/configuracao\/locais-oferta(\?.*)?$/, (route) =>
    jsonRoute(route, [localSeed]),
  );
  await page.route(/\/api\/organizacao\/unidades(\?.*)?$/, (route) =>
    jsonRoute(route, [unidadeSeed]),
  );
}

async function abrirPagina(page: Page): Promise<void> {
  await page.goto('/ofertas-curso');
  await expect(page.getByRole('heading', { name: 'Oferta de curso', level: 1 })).toBeVisible();
}

test.describe('Oferta de Curso — CRUD (#389)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('CA-01/04: lista resolve rótulos de Curso e Local via lookup', async ({ page }) => {
    await mockApi(page, novoCapturado(), [ofertaSeed]);
    await abrirPagina(page);

    await expect(page.getByRole('cell', { name: 'ENG-CIV — Engenharia Civil' })).toBeVisible();
    await expect(
      page.getByRole('cell', { name: 'IGE — Instituto de Geociências e Engenharias' }),
    ).toBeVisible();
  });

  test('CA-04: cria oferta com os 3 vínculos e programa Regular (sem base legal)', async ({
    page,
  }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, []);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Nova oferta de curso' }).first().click();
    await page.locator('[formControlName="cursoId"]').selectOption(CURSO_ID);
    await page.locator('[formControlName="localOfertaId"]').selectOption(LOCAL_ID);
    await page.locator('[formControlName="unidadeOfertanteOrigemId"]').selectOption(UNIDADE_ID);
    await marcarTurno(page, 'Matutino');
    await page.getByRole('button', { name: 'Criar oferta' }).click();

    await expect.poll(() => capturado.posts.length).toBe(1);
    expect(capturado.posts[0]).toMatchObject({
      cursoId: CURSO_ID,
      localOfertaId: LOCAL_ID,
      unidadeOfertanteOrigemId: UNIDADE_ID,
      regimeDeTurno: 'REGULAR',
      turnos: ['MATUTINO'],
    });
  });

  test('CA-06: programa não-Regular exige base legal antes de salvar', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, []);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Nova oferta de curso' }).first().click();
    await page.locator('[formControlName="cursoId"]').selectOption(CURSO_ID);
    await page.locator('[formControlName="localOfertaId"]').selectOption(LOCAL_ID);
    await page.locator('[formControlName="unidadeOfertanteOrigemId"]').selectOption(UNIDADE_ID);
    await page.locator('[formControlName="programaDeOferta"]').selectOption('PARFOR');
    await marcarTurno(page, 'Matutino');

    await expect(page.locator('[formControlName="baseLegal"]')).toBeVisible();

    await page.getByRole('button', { name: 'Criar oferta' }).click();
    expect(capturado.posts.length).toBe(0);

    await page.locator('[formControlName="baseLegal"]').fill('Convênio Forma Pará nº 004/2020');
    await page.getByRole('button', { name: 'Criar oferta' }).click();

    await expect.poll(() => capturado.posts.length).toBe(1);
    expect(capturado.posts[0]).toMatchObject({ baseLegal: 'Convênio Forma Pará nº 004/2020' });
  });

  test('regime integral exige dois turnos, e o grupo é operável por teclado', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, []);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Nova oferta de curso' }).first().click();
    await page.locator('[formControlName="cursoId"]').selectOption(CURSO_ID);
    await page.locator('[formControlName="localOfertaId"]').selectOption(LOCAL_ID);
    await page.locator('[formControlName="unidadeOfertanteOrigemId"]').selectOption(UNIDADE_ID);
    await page.locator('[formControlName="regimeDeTurno"]').selectOption('INTEGRAL');

    // Marcação por teclado: foco no checkbox e barra de espaço — sem clique.
    const matutino = page.getByRole('checkbox', { name: 'Matutino' });
    await matutino.focus();
    await page.keyboard.press('Space');
    await expect(matutino).toBeChecked();

    await page.getByRole('button', { name: 'Criar oferta' }).click();
    expect(capturado.posts.length).toBe(0);
    await expect(page.getByText(/exige exatamente 2 turnos/i)).toBeVisible();

    const vespertino = page.getByRole('checkbox', { name: 'Vespertino' });
    await vespertino.focus();
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: 'Criar oferta' }).click();

    await expect.poll(() => capturado.posts.length).toBe(1);
    expect(capturado.posts[0]).toMatchObject({
      regimeDeTurno: 'INTEGRAL',
      turnos: ['MATUTINO', 'VESPERTINO'],
    });
  });

  test('o grupo de turnos tem rótulo acessível e não estoura a largura em 320 px', async ({
    page,
  }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, []);
    await page.setViewportSize({ width: 320, height: 900 });
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Nova oferta de curso' }).first().click();

    await expect(page.getByRole('group', { name: /turnos/i })).toBeVisible();

    const estouraLargura = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(estouraLargura).toBe(false);
  });

  test('edição: os 3 vínculos aparecem como texto (sem select) e o payload não os inclui', async ({
    page,
  }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [ofertaSeed]);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Editar' }).first().click();

    await expect(page.locator('[formControlName="cursoId"]')).toHaveCount(0);
    await expect(page.getByText('Bacharelado · Graduação')).toBeVisible();

    await page.locator('[formControlName="eMecCodigo"]').fill('999999');
    await page.getByRole('button', { name: 'Salvar oferta' }).click();

    await expect.poll(() => capturado.puts.length).toBe(1);
    const put = capturado.puts[0] as Record<string, unknown>;
    expect(put['cursoId']).toBeUndefined();
    expect(put['localOfertaId']).toBeUndefined();
    expect(put['unidadeOfertanteOrigemId']).toBeUndefined();
    expect(put['eMecCodigo']).toBe('999999');
  });
});
