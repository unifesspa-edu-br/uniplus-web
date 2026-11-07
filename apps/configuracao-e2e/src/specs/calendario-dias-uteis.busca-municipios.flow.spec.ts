import { expect, test, type Page } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept',
};

const CALENDARIO_ID = '019ff7ee-3c00-7976-860c-eb2f61c9b2d1';
const CALENDARIO = {
  id: CALENDARIO_ID,
  versaoDataset: '2026.1',
  vigente: true,
  criadoEm: '2026-08-13T12:00:00Z',
  diasNaoUteis: [],
};

const MARABA = { id: 'cidade-1504208', codigoIbge: '1504208', nome: 'Marabá', uf: 'PA', ddd: '94' };
const ERRO_INTERNO = {
  type: 'about:blank',
  title: 'Erro interno',
  status: 500,
  code: 'uniplus.internal.unexpected',
};

/** Atraso da nova tentativa: o andamento só é observável com a resposta ainda pendente. */
const ATRASO_DA_NOVA_TENTATIVA_EM_MS = 800;

/** A primeira busca de municípios falha; a segunda demora e dá certo. */
async function simularBuscas(page: Page): Promise<void> {
  let buscas = 0;
  await page.route(/\/api\/configuracao\/calendarios-dias-uteis(\/[^/?]+)?(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      headers: CORS_HEADERS,
      json: route.request().url().includes(CALENDARIO_ID)
        ? CALENDARIO
        : { items: [], nextCursor: null },
    }),
  );
  await page.route(/\/api\/cidades(\?.*)?$/, async (route) => {
    buscas += 1;
    if (buscas === 1) {
      await route.fulfill({
        status: 500,
        headers: CORS_HEADERS,
        contentType: 'application/problem+json',
        body: JSON.stringify(ERRO_INTERNO),
      });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_NOVA_TENTATIVA_EM_MS));
    await route.fulfill({ status: 200, headers: CORS_HEADERS, json: [MARABA] });
  });
}

test.describe('Calendário de dias úteis — nova tentativa da busca de município', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('falha, nova tentativa pelo teclado e sucesso devolvem o foco ao campo de busca', async ({
    page,
  }) => {
    await simularBuscas(page);
    await page.goto(`/calendario-dias-uteis/${CALENDARIO_ID}`);
    await page.getByRole('button', { name: /^8 de setembro de 2026/ }).click();
    await page.getByRole('button', { name: 'Adicionar feriado' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Adicionar novo feriado ao calendário' });
    await dialogo.locator('#abrangencia-novo').selectOption('MUNICIPAL');
    await dialogo.locator('#uf-novo').selectOption('PA');
    const busca = dialogo.locator('#busca-municipio-novo');
    await busca.fill('Mar');

    const tentar = dialogo.getByRole('button', { name: 'Tentar novamente' });
    await expect(tentar).toBeVisible();
    await tentar.focus();
    await page.keyboard.press('Enter');

    await expect(
      dialogo.getByRole('status').filter({ hasText: 'Recarregando municípios…' }),
    ).toBeVisible();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(tentar).toBeFocused();

    await expect(tentar).toBeHidden();
    await expect(dialogo.locator('#codigo-municipio-novo')).toContainText('Marabá');
    await expect(busca).toBeFocused();
  });

  test('falha, nova tentativa pelo mouse e sucesso devolvem o foco ao campo de busca', async ({
    page,
  }) => {
    await simularBuscas(page);
    await page.goto(`/calendario-dias-uteis/${CALENDARIO_ID}`);
    await page.getByRole('button', { name: /^8 de setembro de 2026/ }).click();
    await page.getByRole('button', { name: 'Adicionar feriado' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Adicionar novo feriado ao calendário' });
    await dialogo.locator('#abrangencia-novo').selectOption('MUNICIPAL');
    await dialogo.locator('#uf-novo').selectOption('PA');
    const busca = dialogo.locator('#busca-municipio-novo');
    await busca.fill('Mar');

    const tentar = dialogo.getByRole('button', { name: 'Tentar novamente' });
    await expect(tentar).toBeVisible();
    await tentar.click();

    await expect(
      dialogo.getByRole('status').filter({ hasText: 'Recarregando municípios…' }),
    ).toBeVisible();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(tentar).toBeFocused();

    await expect(tentar).toBeHidden();
    await expect(dialogo.locator('#codigo-municipio-novo')).toContainText('Marabá');
    await expect(busca).toBeFocused();
  });
});
