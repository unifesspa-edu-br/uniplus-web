import { expect, test } from '@playwright/test';
import {
  PROBLEMA_500,
  SALVO,
  abrirRemocao,
  mockApi,
  remover,
  titulo,
} from '../support/pesos-enem-api';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

test.describe('Peso por Área — remoção', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('remoção pendente mantém o foco no botão, recusa reenvio, Esc, X e Cancelar e anuncia o andamento', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, { respostas: [SALVO], recarga: 'sem-o-item' });
    const { dialogo, confirmar } = await abrirRemocao(page);
    await confirmar.click();
    await expect(confirmar).toBeFocused();
    await expect(confirmar).toHaveAttribute('aria-disabled', 'true');
    await expect(confirmar).toHaveAttribute('aria-busy', 'true');
    await expect(confirmar).toHaveCSS('cursor', 'not-allowed');
    await expect(dialogo.getByRole('status').filter({ hasText: 'Removendo' })).toHaveCount(1);
    await expect(dialogo.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await expect(dialogo.getByRole('button', { name: 'Cancelar', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
    await confirmar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await expect.poll(() => envios.length).toBe(4);
    await liberar();
    await expect(dialogo).toBeHidden();
    expect(envios).toEqual(['DELETE', 'DELETE', 'DELETE', 'DELETE']);
  });

  for (const recarga of ['sem-o-item', 'com-falha'] as const) {
    test(`remoção concluída, com a recarga ${recarga}, leva o foco ao título da página`, async ({
      page,
    }) => {
      const { liberar } = await mockApi(page, { respostas: [SALVO], recarga });
      const { dialogo, confirmar } = await abrirRemocao(page);
      await confirmar.click();
      await liberar();
      await expect(dialogo).toBeHidden();
      await expect(titulo(page)).toBeFocused();
    });
  }

  test('remoção recusada (500) mantém o diálogo e o foco no botão, e a nova tentativa limpa a mensagem', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, {
      respostas: [{ status: 500, corpo: PROBLEMA_500 }, SALVO],
      recarga: 'sem-o-item',
    });
    const { dialogo, confirmar } = await abrirRemocao(page);
    await confirmar.click();
    await liberar();
    const mensagem = dialogo.locator('.field__error');
    await expect(mensagem).toContainText(PROBLEMA_500.title);
    await expect(confirmar).not.toHaveAttribute('aria-disabled', 'true');
    await expect(confirmar).toBeFocused();
    await expect(dialogo.getByRole('status')).toContainText('Não foi possível remover');
    await confirmar.click();
    await expect(confirmar).toHaveAttribute('aria-busy', 'true');
    await expect(mensagem).toBeHidden();
    await expect(dialogo).toBeVisible();
    await liberar();
    await expect(dialogo).toBeHidden();
    expect(envios).toHaveLength(8);
  });

  test('cancelar a confirmação devolve o foco ao botão de remover da resolução', async ({
    page,
  }) => {
    await mockApi(page, { respostas: [SALVO], recarga: 'sem-o-item' });
    const { dialogo } = await abrirRemocao(page);
    await dialogo.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(dialogo).toBeHidden();
    await expect(remover(page)).toBeFocused();
  });
});
