import { expect, test, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * E2E funcional do cadastro de Tipo de banca (issue #393). Convenção do repo:
 * runtime-config e API mockados por `page.route`; autenticação real (Keycloak)
 * via projeto `fluxo-chromium` (auth-setup + storageState).
 */

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const BANCA_ID = '01960000-0000-7000-0000-0000000000b2';

const bancaSeed = {
  id: BANCA_ID,
  codigo: 'BANCA_ENTREVISTA',
  nome: 'Banca de Entrevista',
  faseTipica: 'Avaliação',
  descricao: null,
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
  fasesCanonicas: readonly unknown[] = [],
): Promise<void> {
  await page.route(/\/api\/configuracao\/admin\/tipos-banca\/[^/?]+$/, async (route) => {
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
  await page.route(/\/api\/configuracao\/admin\/tipos-banca(\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      capturado.posts.push(route.request().postDataJSON());
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify('novo-tipo-banca-id'),
      });
      return;
    }
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
  });
  await page.route(/\/api\/configuracao\/tipos-banca(\?.*)?$/, (route) => jsonRoute(route, lista));
  await page.route(/\/api\/configuracao\/fases-canonicas(\?.*)?$/, (route) =>
    jsonRoute(route, fasesCanonicas),
  );
}

async function abrirPagina(page: Page): Promise<void> {
  await page.goto('/tipos-banca');
  await expect(page.getByRole('heading', { name: 'Tipo de Banca', level: 1 })).toBeVisible();
}

test.describe('Tipo de banca — CRUD (#393)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('CA-01 / CA-10: lista tipos de banca vivos e mantém o banner de código imutável', async ({
    page,
  }) => {
    await mockApi(page, novoCapturado(), [bancaSeed]);
    await abrirPagina(page);

    await expect(page.getByText('BANCA_ENTREVISTA')).toBeVisible();
    await expect(page.getByText('Código imutável após criação')).toBeVisible();
  });

  test('CA-04: cria tipo de banca com código canônico válido e nome', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, []);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Novo tipo de banca' }).first().click();
    await page.locator('[formControlName="codigo"]').selectOption('BANCA_ANALISE_DOCUMENTAL');
    await page.locator('[formControlName="nome"]').fill('Banca de Análise Documental');
    await page.getByRole('button', { name: 'Criar tipo de banca' }).click();

    await expect.poll(() => capturado.posts.length).toBe(1);
    expect(capturado.posts[0]).toMatchObject({
      codigo: 'BANCA_ANALISE_DOCUMENTAL',
      nome: 'Banca de Análise Documental',
    });
  });

  test('Fase típica aceita texto livre sem corresponder a nenhuma fase canônica', async ({
    page,
  }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [], [{ id: 'f1', codigo: 'AVALIACAO', nome: 'Avaliação' }]);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Novo tipo de banca' }).first().click();
    await page.locator('[formControlName="codigo"]').selectOption('BANCA_CORRECAO_REDACOES');
    await page.locator('[formControlName="nome"]').fill('Banca de Correção');
    await page.locator('[formControlName="faseTipica"]').fill('Uma fase qualquer sem correspondência');
    await page.getByRole('button', { name: 'Criar tipo de banca' }).click();

    await expect.poll(() => capturado.posts.length).toBe(1);
    expect(capturado.posts[0]).toMatchObject({
      faseTipica: 'Uma fase qualquer sem correspondência',
    });
  });

  test('CA-06 / CA-11: código é readonly na edição e o payload de atualização não inclui codigo', async ({
    page,
  }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [bancaSeed]);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Editar' }).first().click();
    const codigoInput = page.locator('[formControlName="codigo"]');
    await expect(codigoInput).toHaveAttribute('readonly', '');
    await expect(codigoInput).toHaveValue('BANCA_ENTREVISTA');

    await page.locator('[formControlName="nome"]').fill('Banca de Entrevista (revisada)');
    await page.getByRole('button', { name: 'Salvar tipo de banca' }).click();

    await expect.poll(() => capturado.puts.length).toBe(1);
    expect(capturado.puts[0]).not.toHaveProperty('codigo');
    expect(capturado.puts[0]).toMatchObject({ nome: 'Banca de Entrevista (revisada)' });
  });

  test('CA-09: inativa um tipo de banca após confirmação', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [bancaSeed]);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Inativar' }).first().click();
    const dialog = page.locator('dialog.uni-dialog');
    await dialog.getByRole('button', { name: 'Inativar' }).click();

    await expect.poll(() => capturado.deletedIds.length).toBe(1);
    expect(capturado.deletedIds[0]).toBe(BANCA_ID);
  });
});
