import { expect, test, type Page } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * Botão global "Voltar ao topo" do shell compartilhado (`ui-app-shell` →
 * `ui-back-to-top`), issue #695.
 *
 * Contrato exercitado:
 * - o botão fica oculto abaixo de 30% do intervalo rolável de `main.page` e
 *   visível a partir daí (`scrollTop / (scrollHeight - clientHeight) >= 0,30`);
 * - acioná-lo devolve `main.page` ao topo e oculta o botão;
 * - rolar um contêiner auxiliar (a barra lateral) não apresenta o botão;
 * - trocar de rota recalcula a visibilidade para o novo conteúdo.
 *
 * Convenção do repo: runtime-config e API mockados por `page.route`; auth real
 * (Keycloak) via projeto `fluxo-chromium`. Viewport fixada por teste — por isso
 * `.flow.spec.ts`.
 */

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

/** Campi suficientes para `main.page` ultrapassar qualquer viewport testada. */
const CAMPI = Array.from({ length: 40 }, (_, i) => ({
  id: `01960000-0000-7000-0000-0000000${String(i + 100).padStart(5, '0')}`,
  sigla: `CAMP${String(i + 1).padStart(2, '0')}`,
  nome: `Campus de Teste ${i + 1}`,
  codigoEmec: `${1000 + i}`,
  cidade: { nome: 'Marabá', uf: 'PA' },
  endereco: null,
}));

async function mockCampiApi(page: Page): Promise<void> {
  await page.route(/\/api\/configuracao\/campi(\?.*)?$/u, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS_HEADERS,
      body: JSON.stringify(CAMPI),
    });
  });
}

/** Respostas vazias para qualquer outro endpoint de configuração — evita que uma
 * rota de destino da navegação quebre por falta de mock. */
async function mockConfiguracaoVazia(page: Page): Promise<void> {
  await page.route(/\/api\/(configuracao|geo)\/.*/u, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS_HEADERS,
      body: '[]',
    });
  });
}

async function irParaCampi(page: Page): Promise<void> {
  await mockConfiguracaoRuntimeConfig(page);
  // Playwright dá precedência ao handler registrado por último: a rede vazia
  // vem primeiro (fallback), o mock específico de `campi` depois.
  await mockConfiguracaoVazia(page);
  await mockCampiApi(page);
  await page.goto('/campi');
  await expect(page.getByRole('heading', { name: 'Campi', level: 1 })).toBeVisible();
}

const botao = (page: Page) => page.getByRole('button', { name: 'Voltar ao topo do conteúdo' });

/** Rola `main.page` para a fração dada do seu intervalo rolável. */
async function rolarConteudo(page: Page, fracao: number): Promise<void> {
  await page.locator('main.page').evaluate((el, f) => {
    el.scrollTo({ top: (el.scrollHeight - el.clientHeight) * f, behavior: 'auto' });
  }, fracao);
}

test.describe('Shell — botão Voltar ao topo', () => {
  test('CA-02/CA-03/CA-06: aparece aos 30%, some abaixo e devolve o conteúdo ao topo', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await irParaCampi(page);

    await expect(botao(page)).toBeHidden();

    await rolarConteudo(page, 0.2);
    await expect(botao(page)).toBeHidden();

    await rolarConteudo(page, 0.35);
    await expect(botao(page)).toBeVisible();

    await botao(page).click();
    await expect
      .poll(() => page.locator('main.page').evaluate((el) => el.scrollTop))
      .toBeLessThan(4);
    await expect(botao(page)).toBeHidden();
  });

  test('CA-09: rolar a barra lateral não apresenta o botão', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await irParaCampi(page);

    await page.locator('aside.sidebar nav').evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await expect(botao(page)).toBeHidden();
  });

  test('CA-10: a troca de rota recalcula a visibilidade para o novo conteúdo', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await irParaCampi(page);

    await rolarConteudo(page, 0.5);
    await expect(botao(page)).toBeVisible();

    // Rota curta, posicionada no início: o botão não herda a posição anterior.
    await page.getByRole('link', { name: 'Instituição' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(botao(page)).toBeHidden();
  });

  test('CA-12: acionável por teclado, com nome acessível e foco visível', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await irParaCampi(page);

    await rolarConteudo(page, 0.4);
    await botao(page).focus();
    await expect(botao(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect
      .poll(() => page.locator('main.page').evaluate((el) => el.scrollTop))
      .toBeLessThan(4);
  });
});
