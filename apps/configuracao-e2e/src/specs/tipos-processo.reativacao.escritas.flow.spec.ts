import { expect, test } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import { PROBLEMA_409_PROCESSANDO } from '../support/mock-de-lista-com-escritas';
import {
  abrirConfirmacao,
  desativarAposReativar,
  DESATIVADO_ATIVADO,
  mockApi,
  PROBLEMA_422_JA_ATIVO,
  reativar,
  SALVO,
} from '../support/tipos-processo-escritas';

test.describe('Tipo de processo — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('reativação pendente mantém o foco no botão, recusa reenvio, Esc e Cancelar e anuncia o andamento', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [SALVO], DESATIVADO_ATIVADO);
    const { dialogo, confirmar } = await abrirConfirmacao(page, 'reativar');
    await confirmar.click();
    await expect(confirmar).toBeFocused();
    await expect(confirmar).toHaveAttribute('aria-disabled', 'true');
    await expect(confirmar).toHaveCSS('cursor', 'not-allowed');
    await expect(dialogo.getByRole('status')).toContainText('Reativando');
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
    await confirmar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    expect(envios).toEqual(['POST']);
    liberar();
    await expect(dialogo).toBeHidden();
  });

  test('reativação concluída leva o foco ao botão de desativar da linha', async ({ page }) => {
    const { liberar } = await mockApi(page, [SALVO], DESATIVADO_ATIVADO);
    const { dialogo, confirmar } = await abrirConfirmacao(page, 'reativar');
    await confirmar.click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(desativarAposReativar(page)).toBeFocused();
  });

  for (const recusa of [
    { status: 422, corpo: PROBLEMA_422_JA_ATIVO },
    { status: 409, corpo: PROBLEMA_409_PROCESSANDO },
  ]) {
    test(`reativação recusada (${recusa.status}) mantém o diálogo, a mensagem e o foco no botão`, async ({
      page,
    }) => {
      const { liberar, envios } = await mockApi(page, [recusa, SALVO], DESATIVADO_ATIVADO);
      const { dialogo, confirmar } = await abrirConfirmacao(page, 'reativar');
      await confirmar.click();
      liberar();
      await expect(dialogo.locator('.field__error')).toContainText(recusa.corpo.title);
      await expect(confirmar).not.toHaveAttribute('aria-disabled', 'true');
      await expect(confirmar).toBeFocused();
      await expect(dialogo.getByRole('status')).toContainText('Não foi possível reativar');
      await confirmar.click();
      await expect(dialogo).toBeHidden();
      expect(envios).toEqual(['POST', 'POST']);
    });
  }

  test('cancelar a confirmação de reativação devolve o foco ao botão de reativar da linha', async ({
    page,
  }) => {
    await mockApi(page, [], DESATIVADO_ATIVADO);
    const { dialogo } = await abrirConfirmacao(page, 'reativar');
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(reativar(page)).toBeFocused();
  });
});
