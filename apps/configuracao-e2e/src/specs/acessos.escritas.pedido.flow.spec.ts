import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockPermissoesEfetivas } from '@uniplus/shared-e2e';
import { PERMISSOES_DO_DIOGO } from '../support/permissoes';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import { mockApiDeAcesso, pedidoSeed } from '../support/api-de-acesso';

test.describe('Acessos — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
    await mockPermissoesEfetivas(page, PERMISSOES_DO_DIOGO);
  });

  test.describe('decisão do pedido', () => {
    const PEDIDO_ID = '01960000-0000-7000-0000-00000000cc01';
    const tituloDoPedido = (page: Page): Locator =>
      page.getByRole('heading', { name: 'Pedido de acesso', level: 1 });

    test('aprovar leva o foco ao título quando o botão some com a recarga do pedido', async ({
      page,
    }) => {
      await mockApiDeAcesso(page, [pedidoSeed()]);
      await page.goto(`/acessos/pedidos/${PEDIDO_ID}`);
      await page.getByRole('button', { name: 'Aprovar' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Aprovar' }).click();

      await expect(
        page.getByText('Aguardando o Representante do controlador').first(),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Aprovar' })).toHaveCount(0);
      await expect(tituloDoPedido(page)).toBeFocused();
    });

    test('recusar leva o foco ao título quando o botão some com a recarga do pedido', async ({
      page,
    }) => {
      await mockApiDeAcesso(page, [pedidoSeed()]);
      await page.goto(`/acessos/pedidos/${PEDIDO_ID}`);
      await page.getByRole('button', { name: 'Recusar', exact: true }).click();
      const caixa = page.getByRole('dialog', { name: 'Recusar o pedido' });
      await caixa.getByLabel('Motivo').fill('Sem necessidade funcional.');
      await caixa.getByRole('button', { name: 'Recusar pedido' }).click();

      await expect(page.getByRole('button', { name: 'Recusar', exact: true })).toHaveCount(0);
      await expect(tituloDoPedido(page)).toBeFocused();
    });
  });
});
