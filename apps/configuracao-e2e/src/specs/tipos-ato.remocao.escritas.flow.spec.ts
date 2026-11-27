import { expect, test } from '@playwright/test';
import { ERRO_INTERNO } from '../support/escritas-retidas';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import {
  abrirRemocao,
  lixeira,
  mockApi,
  PROBLEMA_404,
  SALVO,
  titulo,
} from '../support/tipos-ato-escritas';

test.describe('Tipo de ato — escritas', () => {
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

  test('remoção concluída com a linha ainda na recarga devolve o foco à lixeira da linha', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [SALVO], 'com-o-item');
    const { dialogo, remover } = await abrirRemocao(page);
    await remover.click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(lixeira(page)).toBeEnabled();
    await expect(lixeira(page)).toBeFocused();
  });

  for (const recusa of [
    { status: 404, corpo: PROBLEMA_404 },
    { status: 500, corpo: ERRO_INTERNO },
  ]) {
    test(`remoção recusada (${recusa.status}) mantém o diálogo, a mensagem e o foco no botão, que volta a aceitar o clique`, async ({
      page,
    }) => {
      const { liberar, envios } = await mockApi(page, [recusa, SALVO], 'sem-o-item');
      const { dialogo, remover } = await abrirRemocao(page);
      await remover.click();
      liberar();
      const mensagem = dialogo.locator('.field__error');
      await expect(mensagem).toContainText(recusa.corpo.title);
      await expect(remover).not.toHaveAttribute('aria-disabled', 'true');
      await expect(remover).toBeFocused();
      await expect(dialogo.getByRole('status')).toContainText('Não foi possível remover');
      await remover.click();
      await expect(mensagem).toBeHidden();
      await expect(dialogo).toBeHidden();
      expect(envios).toEqual(['DELETE', 'DELETE']);
    });
  }

  test('cancelar a confirmação devolve o foco à lixeira da linha', async ({ page }) => {
    await mockApi(page, [], 'sem-o-item');
    const { dialogo } = await abrirRemocao(page);
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(lixeira(page)).toBeFocused();
  });
});
