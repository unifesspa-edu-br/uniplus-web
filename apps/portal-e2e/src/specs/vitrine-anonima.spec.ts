import { expect, test, type Request } from '@playwright/test';

/**
 * Quem não entrou vê a lista pública de processos: os pedidos à API seguem sem credencial e a
 * página carrega. Contra a API e o provedor de login reais, só quando o ambiente os traz.
 */
test.describe('Lista pública de processos, sem login', () => {
  test.skip(!process.env['E2E_BACKEND_REAL'], 'Precisa da API e do provedor de login reais.');

  test('carrega e pede a lista de certames sem credencial', async ({ page }) => {
    const pedidosDaApi: Request[] = [];
    page.on('request', (pedido) => {
      if (pedido.url().includes('/api/')) pedidosDaApi.push(pedido);
    });
    const resposta = page.waitForResponse(
      (r) => r.url().includes('/api/selecao/certames') && r.request().method() === 'GET',
    );

    await page.goto('/processos');

    expect((await resposta).ok()).toBe(true);
    await expect(
      page.getByRole('heading', { name: 'Processos seletivos', level: 1 }),
    ).toBeVisible();
    await expect(page.locator('.certames-loading')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(pedidosDaApi.length).toBeGreaterThan(0);
    for (const pedido of pedidosDaApi) {
      expect(await pedido.headerValue('authorization')).toBeNull();
    }
  });
});
