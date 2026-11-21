import { expect, test } from '@playwright/test';
import {
  PROBLEMA_403_REMOCAO,
  PROBLEMA_404,
  PROBLEMA_500,
  SALVO,
  abrirRemocao,
  lixeira,
  mockApi,
  novo,
  titulo,
} from '../support/api-de-precedencias-escritas';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

test.describe('Precedência de fase — remoção', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('remoção pendente mantém o foco no botão, recusa reenvio, Esc, X e Cancelar e anuncia o andamento', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [SALVO], 'sem-o-item');
    const { dialogo, remover } = await abrirRemocao(page);
    await remover.click();
    await expect(remover).toBeFocused();
    await expect(remover).toHaveAttribute('aria-disabled', 'true');
    await expect(remover).toHaveAttribute('aria-busy', 'true');
    await expect(remover).toHaveCSS('cursor', 'not-allowed');
    await expect(dialogo.getByRole('status')).toContainText('Removendo');
    await expect(dialogo.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
    await remover.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(envios).toEqual(['DELETE']);
    liberar();
    await expect(dialogo).toBeHidden();
  });

  for (const recarga of ['sem-o-item', 'com-falha'] as const) {
    test(`remoção concluída, com a recarga ${recarga}, leva o foco ao título da lista`, async ({
      page,
    }) => {
      const { liberar } = await mockApi(page, [SALVO], recarga);
      const { dialogo, remover } = await abrirRemocao(page);
      await remover.click();
      liberar();
      await expect(dialogo).toBeHidden();
      await expect(titulo(page)).toBeFocused();
    });
  }

  test('remoção recusada (403) leva à página de acesso negado', async ({ page }) => {
    const { liberar } = await mockApi(
      page,
      [{ status: 403, corpo: PROBLEMA_403_REMOCAO }],
      'sem-o-item',
    );
    const { dialogo, remover } = await abrirRemocao(page);
    await remover.click();
    liberar();
    await expect(page).toHaveURL(/\/acesso-negado$/);
    await expect(dialogo).toBeHidden();
  });

  test('remoção recusada (500) mantém o diálogo, a mensagem e o foco no botão, que volta a aceitar o clique', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 500, corpo: PROBLEMA_500 }, SALVO],
      'sem-o-item',
    );
    const { dialogo, remover } = await abrirRemocao(page);
    await remover.click();
    liberar();
    const mensagem = dialogo.locator('.field__error');
    await expect(mensagem).toContainText(PROBLEMA_500.title);
    await expect(remover).not.toHaveAttribute('aria-disabled', 'true');
    await expect(remover).toBeFocused();
    await expect(dialogo.getByRole('status')).toContainText('Não foi possível remover');
    await remover.click();
    await expect(mensagem).toBeHidden();
    await expect(dialogo).toBeHidden();
    expect(envios).toEqual(['DELETE', 'DELETE']);
  });

  test('aresta já removida por outra pessoa (404) mantém a mensagem no diálogo, que ainda pode ser cancelado', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 404, corpo: PROBLEMA_404 }], 'sem-o-item');
    const { dialogo, remover } = await abrirRemocao(page);
    await remover.click();
    liberar();
    await expect(dialogo.locator('.field__error')).toContainText(PROBLEMA_404.title);
    await expect(remover).not.toHaveAttribute('aria-disabled', 'true');
    await expect(novo(page)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(lixeira(page)).toHaveCount(0);
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  test('cancelar a confirmação devolve o foco ao botão de remover da linha', async ({ page }) => {
    await mockApi(page, [], 'sem-o-item');
    const { dialogo } = await abrirRemocao(page);
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(lixeira(page)).toBeFocused();
  });
});
