import { expect, test, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * E2E funcional do cadastro de Base Legal de Bônus Regional (issue #754).
 * Convenção do repo: runtime-config e API mockados por `page.route`;
 * autenticação real (Keycloak) via projeto `fluxo-chromium`.
 *
 * Nomeado `.flow.spec.ts` para casar com `testMatch: /.*\.flow\.spec\.ts$/`
 * do `playwright.config.ts`, mesmo padrão de `tipos-documento.flow.spec.ts`.
 */

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const TIPOS_INSTRUMENTO = [
  { codigo: 'PORTARIA', nome: 'Portaria', descricao: 'Ato administrativo de autoridade pública.' },
  { codigo: 'LEI', nome: 'Lei', descricao: 'Ato normativo de maior hierarquia.' },
];

const MARABA = { id: 'cidade-1504208', codigoIbge: '1504208', nome: 'Marabá', uf: 'PA', ddd: '94' };

const portariaSeed = {
  id: 'ba5e0000-0000-7000-8000-000000000001',
  tipoInstrumento: 'PORTARIA',
  identificacao: 'Portaria Unifesspa nº 2514/2023',
  descricao: 'Institui inclusão regional.',
  municipios: [{ codigoIbge: MARABA.codigoIbge, nome: MARABA.nome, uf: MARABA.uf }],
  criadoEm: '2026-01-01T00:00:00Z',
};

interface Capturado {
  readonly posts: unknown[];
  readonly deletedIds: string[];
}

function novoCapturado(): Capturado {
  return { posts: [], deletedIds: [] };
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

async function mockApi(page: Page, capturado: Capturado, lista: readonly unknown[]): Promise<void> {
  await page.route(
    /\/api\/configuracao\/admin\/base-legal-bonus-regional\/[^/?]+$/,
    async (route) => {
      if (route.request().method() === 'DELETE') {
        const partes = route.request().url().split('/');
        capturado.deletedIds.push(partes[partes.length - 1] ?? '');
        await route.fulfill({ status: 204, headers: CORS_HEADERS });
        return;
      }
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
    },
  );
  await page.route(
    /\/api\/configuracao\/admin\/base-legal-bonus-regional(\?.*)?$/,
    async (route) => {
      if (route.request().method() === 'POST') {
        capturado.posts.push(route.request().postDataJSON());
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          headers: CORS_HEADERS,
          body: JSON.stringify('nova-base-legal-id'),
        });
        return;
      }
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
    },
  );
  await page.route(/\/api\/configuracao\/base-legal-bonus-regional(\?.*)?$/, (route) =>
    jsonRoute(route, lista),
  );
  await page.route(
    /\/api\/configuracao\/vocabularios\/tipos-instrumento-normativo(\?.*)?$/,
    (route) => jsonRoute(route, TIPOS_INSTRUMENTO),
  );
  await page.route(/\/api\/cidades(\?.*)?$/, (route) => jsonRoute(route, [MARABA]));
}

async function abrirPagina(page: Page): Promise<void> {
  await page.goto('/base-legal-bonus-regional');
  await expect(
    page.getByRole('heading', { name: 'Base Legal de Bônus Regional', level: 1 }),
  ).toBeVisible();
}

test.describe('Base Legal de Bônus Regional — CRUD (#754)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('CA-01/CA-02: cadastra uma nova Base Legal escolhendo tipo, identificação e município buscado', async ({
    page,
  }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, []);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Nova base legal' }).click();
    await page.locator('[formControlName="tipoInstrumento"]').selectOption('PORTARIA');
    await page.locator('[formControlName="identificacao"]').fill('Portaria Unifesspa nº 2514/2023');
    await page.locator('[formControlName="descricao"]').fill('Institui inclusão regional.');

    await page.getByPlaceholder('Digite o nome completo do município…').fill('Marabá');
    await page.getByRole('button', { name: /Marabá — PA/ }).click();
    await expect(page.getByRole('button', { name: 'Remover Marabá' })).toBeVisible();

    await page.getByRole('button', { name: 'Criar base legal' }).click();

    await expect.poll(() => capturado.posts.length).toBe(1);
    expect(capturado.posts[0]).toMatchObject({
      tipoInstrumento: 'PORTARIA',
      identificacao: 'Portaria Unifesspa nº 2514/2023',
      municipios: [{ codigoIbge: MARABA.codigoIbge, nome: MARABA.nome, uf: MARABA.uf }],
    });
  });

  test('CA-03: tentativa de salvar sem município é bloqueada na própria tela', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, []);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Nova base legal' }).click();
    await page.locator('[formControlName="tipoInstrumento"]').selectOption('PORTARIA');
    await page.locator('[formControlName="identificacao"]').fill('Portaria de teste');
    await page.locator('[formControlName="descricao"]').fill('Descrição de teste válida.');

    await page.getByRole('button', { name: 'Criar base legal' }).click();

    await expect(page.getByText('Adicione ao menos um município.')).toBeVisible();
    expect(capturado.posts).toHaveLength(0);
  });

  test('CA-05: desativar uma Base Legal exige confirmação antes do soft-delete', async ({
    page,
  }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [portariaSeed]);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Desativar' }).click();
    const dialog = page.locator('dialog.uni-dialog');
    await expect(dialog).toBeVisible();
    expect(capturado.deletedIds).toHaveLength(0);

    await dialog.getByRole('button', { name: 'Desativar' }).click();

    await expect.poll(() => capturado.deletedIds).toEqual([portariaSeed.id]);
  });
});
