import { expect, test, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * E2E funcional da tela de Fase canônica (issues #393, #698). Convenção do repo:
 * runtime-config e API mockados por `page.route`; autenticação real (Keycloak)
 * via projeto `fluxo-chromium` (auth-setup + storageState).
 *
 * Issue #698: a interface comum não cria fase canônica — só lista, filtra,
 * edita e inativa. O endpoint de criação continua existindo na API, mas a tela
 * nunca o aciona.
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
  coletaInscricao: false,
  coletaSolicitacaoIsencao: false,
  origemData: 'PROPRIA',
  criadoEm: '2026-06-10T12:00:00Z',
};

const faseIsencaoSeed = {
  ...faseSeed,
  id: '01960000-0000-7000-0000-0000000000f2',
  codigo: 'SOLICITACAO_ISENCAO',
  nome: 'Solicitação de isenção',
  agrupaEtapas: false,
  coletaInscricao: false,
  coletaSolicitacaoIsencao: true,
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

async function mockApi(page: Page, capturado: Capturado, lista: readonly unknown[]): Promise<void> {
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
    // A tela não deve criar fases (issue #698); a rota existe só para flagrar
    // uma regressão que volte a emitir o POST.
    if (route.request().method() === 'POST') {
      capturado.posts.push(route.request().postDataJSON());
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify('nova-fase-id'),
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

test.describe('Fase canônica — sem criação pela interface (#698)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('CA-12 / CA-10: lista fases vivas e mantém o aviso do catálogo institucional', async ({
    page,
  }) => {
    await mockApi(page, novoCapturado(), [faseSeed]);
    await abrirPagina(page);

    // O drawer inicia fechado e não há mais `<select>` de código: o código só
    // aparece na tabela.
    await expect(page.locator('table').getByText('AVALIACAO')).toBeVisible();
    await expect(page.getByText('Códigos definidos pelo catálogo institucional')).toBeVisible();
  });

  test('CA-01 / CA-03 / CA-04: não há ação para criar uma fase canônica', async ({ page }) => {
    await mockApi(page, novoCapturado(), [faseSeed]);
    await abrirPagina(page);

    await expect(page.getByRole('button', { name: 'Nova fase canônica' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Nova fase canônica' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Criar fase canônica' })).toHaveCount(0);
  });

  test('CA-02 / CA-16: estado vazio informa sem sugerir cadastrar a primeira fase', async ({
    page,
  }) => {
    await mockApi(page, novoCapturado(), []);
    await abrirPagina(page);

    await expect(page.getByText('catálogo de fases é definido institucionalmente')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nova fase canônica' })).toHaveCount(0);
  });

  test('CA-05 / CA-06 / CA-07 / CA-14: edição abre o drawer, código é readonly e salva via PUT', async ({
    page,
  }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [faseSeed]);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Editar' }).first().click();
    await expect(page.getByText('Editar fase canônica')).toBeVisible();

    const codigoInput = page.locator('[formControlName="codigo"]');
    await expect(codigoInput).toHaveAttribute('readonly', '');
    await expect(codigoInput).toHaveValue('AVALIACAO');

    await page.locator('[formControlName="nome"]').fill('Avaliação (revisada)');
    await page.getByRole('button', { name: 'Salvar fase canônica' }).click();

    await expect.poll(() => capturado.puts.length).toBe(1);
    expect(capturado.puts[0]).not.toHaveProperty('codigo');
    expect(capturado.puts[0]).toMatchObject({ nome: 'Avaliação (revisada)' });
    expect(capturado.posts).toHaveLength(0);
  });

  test('editar a fase de isenção deriva a marca de isenção e esconde a coleta de inscrição', async ({
    page,
  }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [faseIsencaoSeed]);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Editar' }).first().click();

    // A marca de isenção pertence a essa fase e só a ela, e as duas janelas são
    // exclusivas — o formulário deriva ambas do código.
    await expect(page.getByTestId('cfg-fase-coleta-isencao')).toHaveValue('Sim');
    await expect(page.locator('[formControlName="coletaInscricao"]')).toBeHidden();

    await page.getByRole('button', { name: 'Salvar fase canônica' }).click();

    await expect.poll(() => capturado.puts.length).toBe(1);
    expect(capturado.puts[0]).toMatchObject({
      coletaSolicitacaoIsencao: true,
      coletaInscricao: false,
    });
    expect(capturado.posts).toHaveLength(0);
  });

  test('CA-15: inativa uma fase canônica após confirmação', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [faseSeed]);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Inativar' }).first().click();
    const dialog = page.locator('dialog.uni-dialog');
    await dialog.getByRole('button', { name: 'Inativar' }).click();

    await expect.poll(() => capturado.deletedIds.length).toBe(1);
    expect(capturado.deletedIds[0]).toBe(FASE_ID);
    expect(capturado.posts).toHaveLength(0);
  });
});
