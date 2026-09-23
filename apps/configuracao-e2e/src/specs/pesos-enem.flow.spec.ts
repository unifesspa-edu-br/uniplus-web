import { expect, test, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * E2E funcional do cadastro de Pesos do ENEM por grupo de curso (issue #395).
 * Convenção do repo: runtime-config e API mockados por `page.route`; autenticação
 * real (Keycloak) via projeto `fluxo-chromium` (auth-setup + storageState).
 * Cada resolução materializa 4 linhas — os mocks capturam as 4 chamadas
 * concorrentes por operação (criar/atualizar/inativar).
 */

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const RESOLUCAO = 'Res. 805/2024';

/** As cinco áreas como a API as devolve (código, rótulo oficial, ordem canônica). */
const AREAS = [
  { codigo: 'REDACAO', rotulo: 'Redação' },
  { codigo: 'CIENCIAS_DA_NATUREZA', rotulo: 'Ciências da Natureza e suas Tecnologias' },
  { codigo: 'CIENCIAS_HUMANAS', rotulo: 'Ciências Humanas e suas Tecnologias' },
  { codigo: 'LINGUAGENS', rotulo: 'Linguagens e suas Tecnologias' },
  { codigo: 'MATEMATICA', rotulo: 'Matemática e suas Tecnologias' },
] as const;

function linha(id: string, grupoCurso: string): Record<string, unknown> {
  return {
    id,
    resolucao: RESOLUCAO,
    grupoCurso,
    areas: AREAS.map((area) => ({
      codigo: area.codigo,
      rotulo: area.rotulo,
      peso: area.codigo === 'MATEMATICA' ? 2.5 : 1,
      corte: area.codigo === 'REDACAO' ? 400 : null,
    })),
    baseLegal: 'Res. 805/2024 Anexo I',
    criadoEm: '2026-06-24T12:00:00Z',
  };
}

const SEED = [
  linha('01960000-0000-7000-0000-0000000000a1', 'Tecnológica'),
  linha('01960000-0000-7000-0000-0000000000a2', 'Humanística I'),
  linha('01960000-0000-7000-0000-0000000000a3', 'Humanística II'),
  linha('01960000-0000-7000-0000-0000000000a4', 'Saúde e Biológicas'),
];

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
  readonly deletedIds: string[];
}

function novoCapturado(): Capturado {
  return { posts: [], puts: [], deletedIds: [] };
}

async function mockApi(page: Page, capturado: Capturado, lista: readonly unknown[]): Promise<void> {
  let sequencial = 0;
  await page.route(/\/api\/configuracao\/admin\/pesos-area-enem\/[^/?]+$/, async (route) => {
    const method = route.request().method();
    if (method === 'DELETE') {
      const partes = route.request().url().split('/');
      capturado.deletedIds.push(partes[partes.length - 1] ?? '');
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    if (method === 'PUT') {
      capturado.puts.push(route.request().postDataJSON());
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
  });
  await page.route(/\/api\/configuracao\/admin\/pesos-area-enem$/, async (route) => {
    if (route.request().method() === 'POST') {
      capturado.posts.push(route.request().postDataJSON());
      sequencial += 1;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify(`novo-id-${sequencial}`),
      });
      return;
    }
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
  });
  await page.route(/\/api\/configuracao\/pesos-area-enem\/areas$/, (route) => jsonRoute(route, AREAS));
  await page.route(/\/api\/configuracao\/pesos-area-enem(\?.*)?$/, (route) => jsonRoute(route, lista));
}

async function abrirPagina(page: Page): Promise<void> {
  await page.goto('/pesos-por-area');
  await expect(
    page.getByRole('heading', { name: 'Peso por Área', level: 1 }),
  ).toBeVisible();
}

test.describe('Peso ENEM — CRUD (#395)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('CA-01: lista agrupa por resolução e exibe tag Vigente', async ({ page }) => {
    await mockApi(page, novoCapturado(), SEED);
    await abrirPagina(page);

    await expect(page.getByText(`Pesos — ${RESOLUCAO}`)).toBeVisible();
    await expect(page.getByText('Vigente')).toBeVisible();
    await expect(page.getByText('Chave composta: resolução + grupo de curso')).toBeVisible();
  });

  test('colunas usam o rótulo oficial das áreas vindo da API e o corte aparece abaixo do peso', async ({
    page,
  }) => {
    await mockApi(page, novoCapturado(), SEED);
    await abrirPagina(page);

    await expect(page.getByLabel('Peso de Matemática e suas Tecnologias — Tecnológica')).toHaveValue('2.5');
    await expect(page.getByText('Corte: 400').first()).toBeVisible();
    await expect(page.getByText('Corte de redação')).toHaveCount(0);
  });

  test('CA-05: cria nova resolução coordenando 4 commands', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, []);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Cadastrar nova resolução' }).first().click();
    await page.locator('[formControlName="resolucao"]').fill('Res. 900/2026');
    await page.locator('[formControlName="baseLegalGlobal"]').fill('Res. 900/2026 Anexo I');

    await page.getByLabel('Peso de Matemática e suas Tecnologias — Tecnológica').fill('2.5');
    await page.getByLabel('Corte de Redação — Tecnológica').fill('450');

    await page.getByRole('button', { name: 'Criar resolução' }).click();

    await expect.poll(() => capturado.posts.length).toBe(4);
    const posts = capturado.posts as ReadonlyArray<{
      resolucao: string;
      grupoCurso: string;
      baseLegal: string;
      areas: ReadonlyArray<{ codigo: string; peso: number; corte: number | null }>;
    }>;
    expect(posts.map((post) => post.resolucao)).toEqual(Array(4).fill('Res. 900/2026'));
    expect(posts.map((post) => post.baseLegal)).toEqual(Array(4).fill('Res. 900/2026 Anexo I'));
    const tecnologica = posts.find((post) => post.grupoCurso === 'Tecnológica');
    expect(tecnologica?.areas).toEqual([
      { codigo: 'REDACAO', peso: 0, corte: 450 },
      { codigo: 'CIENCIAS_DA_NATUREZA', peso: 0, corte: null },
      { codigo: 'CIENCIAS_HUMANAS', peso: 0, corte: null },
      { codigo: 'LINGUAGENS', peso: 0, corte: null },
      { codigo: 'MATEMATICA', peso: 2.5, corte: null },
    ]);
  });

  test('CA-07: inativar resolução remove o panel após confirmação', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, SEED);
    await abrirPagina(page);

    await page.getByRole('button', { name: `Inativar ${RESOLUCAO}` }).click();
    await page
      .locator('dialog.uni-dialog')
      .getByRole('button', { name: 'Confirmar inativação' })
      .click();

    await expect.poll(() => capturado.deletedIds.length).toBe(4);
  });
});

test.describe('Peso por Área — reflow em 320 px (WCAG 1.4.10)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  /** Largura que sobra além da área visível, no documento e em cada painel e linha da
   *  grade: zero quando nada transborda na horizontal. */
  async function medirTransbordo(page: Page): Promise<{ documento: number; paineis: number; linhas: number }> {
    return page.evaluate(() => {
      const excesso = (el: Element): number => el.scrollWidth - el.clientWidth;
      const maximo = (seletor: string): number =>
        Math.max(0, ...[...document.querySelectorAll(seletor)].map(excesso));
      return {
        documento: excesso(document.documentElement),
        paineis: maximo('section.panel'),
        linhas: maximo('.pe-grid .num-grid__row'),
      };
    });
  }

  test('cartão empilhado não transborda na horizontal, na leitura e na edição', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await mockApi(page, novoCapturado(), SEED);
    await abrirPagina(page);
    await expect(page.getByText(`Pesos — ${RESOLUCAO}`)).toBeVisible();

    const leitura = await medirTransbordo(page);
    console.log(`transbordo em 320 px, leitura: ${JSON.stringify(leitura)}`);
    expect(leitura).toEqual({ documento: 0, paineis: 0, linhas: 0 });

    await page.getByRole('button', { name: 'Editar parâmetros' }).click();
    await expect(page.getByRole('button', { name: 'Salvar' })).toBeVisible();
    const edicao = await medirTransbordo(page);
    console.log(`transbordo em 320 px, edição: ${JSON.stringify(edicao)}`);
    expect(edicao).toEqual({ documento: 0, paineis: 0, linhas: 0 });
  });
});

test.describe('Peso por Área — identificação (#689)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('breadcrumb exibe "Peso por Área"', async ({ page }) => {
    await mockApi(page, novoCapturado(), SEED);
    await abrirPagina(page);

    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(breadcrumb.getByText('Peso por Área', { exact: true })).toBeVisible();
  });
});
