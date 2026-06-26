import { expect, test, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * E2E funcional do cadastro de Referência de reserva demográfica (story #394).
 * Convenção do repo: runtime-config e API mockados por `page.route`; autenticação
 * real (Keycloak) via projeto `fluxo-chromium` (auth-setup + storageState).
 */

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const SEED = {
  id: '01960000-0000-7000-0000-0000000000e1',
  censoReferencia: '2022',
  ppiPercentual: 78.5,
  quilombolaPercentual: 1.2,
  pcdPercentual: 8.4,
  baseLegal: 'Lei 12.711/2012, art. 10, III',
  criadoEm: '2026-06-10T12:00:00Z',
};

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

async function mockApi(
  page: Page,
  capturado: { post?: unknown; deleted?: boolean },
  lista: readonly unknown[],
): Promise<void> {
  await page.route(/\/api\/configuracao\/admin\/referencias-reserva-demografica\/[^/]+$/, async (route) => {
    if (route.request().method() === 'DELETE') {
      capturado.deleted = true;
    }
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
  });
  await page.route(/\/api\/configuracao\/admin\/referencias-reserva-demografica$/, async (route) => {
    if (route.request().method() === 'POST') {
      capturado.post = route.request().postDataJSON();
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      headers: CORS_HEADERS,
      body: '"new-id"',
    });
  });
  await page.route(/\/api\/configuracao\/referencias-reserva-demografica(\?.*)?$/, (route) =>
    jsonRoute(route, lista),
  );
}

async function abrirPagina(page: Page): Promise<void> {
  await page.goto('/reserva-demografica');
  await expect(page.getByRole('heading', { name: 'Reserva demográfica', level: 1 })).toBeVisible();
}

test.describe('Reserva demográfica — CRUD (#394)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('CA-01: lista exibe Censo, percentuais e nota de imunidade', async ({ page }) => {
    await mockApi(page, {}, [SEED]);
    await abrirPagina(page);

    await expect(page.getByText('congelamento por snapshot')).toBeVisible();
    await expect(page.getByRole('cell', { name: '2022' })).toBeVisible();
    await expect(page.getByText('78.50')).toBeVisible();
  });

  test('CA-02: cria referência válida enviando o command', async ({ page }) => {
    const capturado: { post?: unknown } = {};
    await mockApi(page, capturado, []);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Novo censo' }).first().click();
    await page.locator('[formControlName="censoReferencia"]').fill('2022');
    await page.locator('[formControlName="ppiPercentual"]').fill('78.5');
    await page.locator('[formControlName="quilombolaPercentual"]').fill('1.2');
    await page.locator('[formControlName="pcdPercentual"]').fill('8.4');
    await page.locator('[formControlName="baseLegal"]').fill('Lei 12.711/2012, art. 10, III');
    await page.getByRole('button', { name: 'Criar referência' }).click();

    await expect.poll(() => capturado.post).toMatchObject({
      censoReferencia: '2022',
      ppiPercentual: 78.5,
      quilombolaPercentual: 1.2,
      pcdPercentual: 8.4,
      baseLegal: 'Lei 12.711/2012, art. 10, III',
    });
  });

  test('CA-07: inativar faz soft-delete após confirmação', async ({ page }) => {
    const capturado: { deleted?: boolean } = {};
    await mockApi(page, capturado, [SEED]);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Inativar' }).first().click();
    // confirma no dialog (escopo ao <dialog> para não pegar o botão da linha)
    await page.locator('dialog.uni-dialog').getByRole('button', { name: 'Inativar' }).click();

    await expect.poll(() => capturado.deleted).toBe(true);
  });
});
