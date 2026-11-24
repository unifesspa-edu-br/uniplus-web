import { expect, test } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import {
  PROBLEMA_409_SUBORDINADAS,
  PROBLEMA_500,
  SALVO,
  COM_AMBAS,
  SEM_A_REITORIA,
  mockApi,
  titulo,
  lixeira,
  abrirConfirmacao,
} from '../support/unidades-escritas';

test.describe('Unidade — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('remoção pendente mantém o foco no botão, recusa reenvio, Esc, X e Cancelar e anuncia o andamento', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [SALVO], SEM_A_REITORIA);
    const { dialogo, confirmar } = await abrirConfirmacao(page);
    await confirmar.click();
    await expect(confirmar).toBeFocused();
    await expect(confirmar).toHaveAttribute('aria-disabled', 'true');
    await expect(confirmar).toHaveAttribute('aria-busy', 'true');
    await expect(confirmar).toHaveCSS('cursor', 'not-allowed');
    await expect(dialogo.getByRole('status')).toContainText('Removendo');
    await expect(dialogo.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
    await confirmar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(envios).toEqual(['DELETE']);
    liberar();
    await expect(dialogo).toBeHidden();
  });

  test('remoção concluída, com a unidade ainda na lista, leva o foco ao botão de remover da linha', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [SALVO], COM_AMBAS);
    const { dialogo, confirmar } = await abrirConfirmacao(page);
    await confirmar.click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(lixeira(page)).toBeEnabled();
    await expect(lixeira(page)).toBeFocused();
  });

  for (const recarga of [SEM_A_REITORIA, 'falha'] as const) {
    const situacaoDaRecarga = recarga === 'falha' ? 'com falha' : 'sem o item';
    test(`remoção concluída, com a recarga ${situacaoDaRecarga}, leva o foco ao título da lista`, async ({
      page,
    }) => {
      const { liberar } = await mockApi(page, [SALVO], recarga);
      const { dialogo, confirmar } = await abrirConfirmacao(page);
      await confirmar.click();
      liberar();
      await expect(dialogo).toBeHidden();
      await expect(titulo(page)).toBeFocused();
    });
  }

  for (const recusa of [
    { status: 409, corpo: PROBLEMA_409_SUBORDINADAS },
    { status: 500, corpo: PROBLEMA_500 },
  ]) {
    test(`remoção recusada (${recusa.status}) mantém o diálogo, a mensagem e o foco no botão, que volta a aceitar o clique`, async ({
      page,
    }) => {
      const { liberar, envios } = await mockApi(page, [recusa, SALVO], SEM_A_REITORIA);
      const { dialogo, confirmar } = await abrirConfirmacao(page);
      await confirmar.click();
      liberar();
      const mensagem = dialogo.locator('.field__error');
      await expect(mensagem).toContainText(recusa.corpo.title);
      await expect(confirmar).not.toHaveAttribute('aria-disabled', 'true');
      await expect(confirmar).toBeFocused();
      await expect(dialogo.getByRole('status')).toContainText('Não foi possível remover');
      await confirmar.click();
      await expect(mensagem).toBeHidden();
      await expect(dialogo).toBeHidden();
      expect(envios).toEqual(['DELETE', 'DELETE']);
    });
  }

  test('cancelar a confirmação devolve o foco ao botão de remover da linha', async ({ page }) => {
    await mockApi(page, [], SEM_A_REITORIA);
    const { dialogo } = await abrirConfirmacao(page);
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(lixeira(page)).toBeFocused();
  });
});
