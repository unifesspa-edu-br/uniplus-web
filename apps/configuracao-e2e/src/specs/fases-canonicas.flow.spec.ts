import { expect, test, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * E2E funcional do cadastro de Fase canônica (issue #393). Convenção do repo:
 * runtime-config e API mockados por `page.route`; autenticação real (Keycloak)
 * via projeto `fluxo-chromium` (auth-setup + storageState).
 */

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const FASE_ID = '01960000-0000-7000-0000-0000000000f1';

const faseSeed = {
  id: FASE_ID,
  codigo: 'AVALIACAO',
  nome: 'Avaliação',
  descricao: null,
  donoTipico: 'CEPS',
  agrupaEtapas: true,
  permiteComplementacao: false,
  baseLegal: null,
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

interface Capturado {
  readonly posts: unknown[];
  readonly puts: unknown[];
  readonly deletedIds: string[];
}

function novoCapturado(): Capturado {
  return { posts: [], puts: [], deletedIds: [] };
}

async function mockApi(
  page: Page,
  capturado: Capturado,
  lista: readonly unknown[],
  opcoes: { readonly criarStatus?: number; readonly criarBody?: unknown } = {},
): Promise<void> {
  await page.route(/\/api\/configuracao\/admin\/fases-canonicas\/[^/?]+$/, async (route) => {
    if (route.request().method() === 'DELETE') {
      const partes = route.request().url().split('/');
      capturado.deletedIds.push(partes[partes.length - 1] ?? '');
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    if (route.request().method() === 'PUT') {
      capturado.puts.push(route.request().postDataJSON());
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
  });
  await page.route(/\/api\/configuracao\/admin\/fases-canonicas(\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      capturado.posts.push(route.request().postDataJSON());
      const status = opcoes.criarStatus ?? 201;
      await route.fulfill({
        status,
        contentType: status >= 400 ? 'application/problem+json' : 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify(opcoes.criarBody ?? 'nova-fase-id'),
      });
      return;
    }
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
  });
  await page.route(/\/api\/configuracao\/fases-canonicas(\?.*)?$/, (route) => jsonRoute(route, lista));
}

async function abrirPagina(page: Page): Promise<void> {
  await page.goto('/fases-canonicas');
  await expect(page.getByRole('heading', { name: 'Fase Canônica', level: 1 })).toBeVisible();
}

test.describe('Fase canônica — CRUD (#393)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('CA-01 / CA-10: lista fases vivas e mantém o banner de código imutável', async ({ page }) => {
    await mockApi(page, novoCapturado(), [faseSeed]);
    await abrirPagina(page);

    // Escopado à tabela: o código também aparece como <option> no select
    // (fechado) do drawer de criação, sempre presente no DOM (modo() inicia
    // em 'criar'), o que tornaria `page.getByText('AVALIACAO')` ambíguo.
    await expect(page.locator('table').getByText('AVALIACAO')).toBeVisible();
    await expect(page.getByText('Código imutável após criação')).toBeVisible();
  });

  test('CA-03: cria fase canônica com código, nome e dono típico válidos', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, []);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Nova fase canônica' }).first().click();
    await page.locator('[formControlName="codigo"]').selectOption('CLASSIFICACAO');
    await page.locator('[formControlName="nome"]').fill('Classificação');
    await page.locator('[formControlName="donoTipico"]').selectOption('CEPS');
    await page.getByRole('button', { name: 'Criar fase canônica' }).click();

    await expect.poll(() => capturado.posts.length).toBe(1);
    expect(capturado.posts[0]).toMatchObject({ codigo: 'CLASSIFICACAO', nome: 'Classificação' });
  });

  test('CA-05: grupos condicionais aparecem e somem conforme o código selecionado', async ({
    page,
  }) => {
    await mockApi(page, novoCapturado(), []);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Nova fase canônica' }).first().click();

    await page.locator('[formControlName="codigo"]').selectOption('AVALIACAO');
    await expect(page.locator('#cfg-fase-grupo-agrupa')).toBeVisible();
    await expect(page.locator('#cfg-fase-grupo-compl')).toBeHidden();

    await page.locator('[formControlName="codigo"]').selectOption('HOMOLOGACAO');
    await expect(page.locator('#cfg-fase-grupo-compl')).toBeVisible();
    await expect(page.locator('#cfg-fase-grupo-agrupa')).toBeHidden();

    await page.locator('[formControlName="codigo"]').selectOption('MATRICULA');
    await expect(page.locator('#cfg-fase-grupo-agrupa')).toBeHidden();
    await expect(page.locator('#cfg-fase-grupo-compl')).toBeHidden();
  });

  test('CA-06 / CA-11: código é readonly na edição e o payload de atualização não inclui codigo', async ({
    page,
  }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [faseSeed]);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Editar' }).first().click();
    const codigoInput = page.locator('[formControlName="codigo"]');
    await expect(codigoInput).toHaveAttribute('readonly', '');
    await expect(codigoInput).toHaveValue('AVALIACAO');

    await page.locator('[formControlName="nome"]').fill('Avaliação (revisada)');
    await page.getByRole('button', { name: 'Salvar fase canônica' }).click();

    await expect.poll(() => capturado.puts.length).toBe(1);
    expect(capturado.puts[0]).not.toHaveProperty('codigo');
    expect(capturado.puts[0]).toMatchObject({ nome: 'Avaliação (revisada)' });
  });

  test('CA-07: código duplicado (409) é rejeitado com erro inline sem fechar o drawer', async ({
    page,
  }) => {
    await mockApi(page, novoCapturado(), [], {
      criarStatus: 409,
      criarBody: {
        type: 'https://uniplus.dev/erros/uniplus.configuracao.fase_canonica.codigo_ja_existe',
        title: 'Já existe uma fase canônica ativa com este código',
        status: 409,
        code: 'uniplus.configuracao.fase_canonica.codigo_ja_existe',
      },
    });
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Nova fase canônica' }).first().click();
    await page.locator('[formControlName="codigo"]').selectOption('AVALIACAO');
    await page.locator('[formControlName="nome"]').fill('Avaliação (dup)');
    await page.locator('[formControlName="donoTipico"]').selectOption('CEPS');
    await page.getByRole('button', { name: 'Criar fase canônica' }).click();

    const codigoField = page.locator('[formControlName="codigo"]').locator('..');
    await expect(codigoField.getByText('Já existe uma fase canônica ativa com este código')).toBeVisible();
    await expect(page.locator('#cfg-fase-canonica-form')).toBeVisible();
  });

  test('CA-08: inativa uma fase canônica após confirmação', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [faseSeed]);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Inativar' }).first().click();
    const dialog = page.locator('dialog.uni-dialog');
    await dialog.getByRole('button', { name: 'Inativar' }).click();

    await expect.poll(() => capturado.deletedIds.length).toBe(1);
    expect(capturado.deletedIds[0]).toBe(FASE_ID);
  });
});
