import { expect, test } from '@playwright/test';
import { ERRO_INTERNO } from '../support/escritas-retidas';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import {
  abrirConfirmacao,
  ATIVO_DESATIVADO,
  lixeira,
  mockApi,
  PROBLEMA_409_CONCORRENCIA_NA_REMOCAO,
  PROBLEMA_422_JA_DESATIVADO,
  reativarAposDesativar,
  SALVO,
  SEM_O_ATIVO,
  situacaoDaRecarga,
  titulo,
} from '../support/tipos-processo-escritas';

test.describe('Tipo de processo — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('desativação pendente mantém o foco no botão, recusa reenvio, Esc, X e Cancelar e anuncia o andamento', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [SALVO], SEM_O_ATIVO);
    const { dialogo, confirmar } = await abrirConfirmacao(page, 'desativar');
    await confirmar.click();
    await expect(confirmar).toBeFocused();
    await expect(confirmar).toHaveAttribute('aria-disabled', 'true');
    await expect(confirmar).toHaveAttribute('aria-busy', 'true');
    await expect(confirmar).toHaveCSS('cursor', 'not-allowed');
    await expect(dialogo.getByRole('status')).toContainText('Desativando');
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

  test('desativação concluída, com o tipo ainda na lista, leva o foco ao botão de reativar da linha', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [SALVO], ATIVO_DESATIVADO);
    const { dialogo, confirmar } = await abrirConfirmacao(page, 'desativar');
    await confirmar.click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(reativarAposDesativar(page)).toBeFocused();
  });

  for (const recarga of [SEM_O_ATIVO, 'falha'] as const) {
    test(`desativação concluída, com a recarga ${situacaoDaRecarga(recarga)}, leva o foco ao título da lista`, async ({
      page,
    }) => {
      const { liberar } = await mockApi(page, [SALVO], recarga);
      const { dialogo, confirmar } = await abrirConfirmacao(page, 'desativar');
      await confirmar.click();
      liberar();
      await expect(dialogo).toBeHidden();
      await expect(titulo(page)).toBeFocused();
    });
  }

  for (const recusa of [
    { status: 422, corpo: PROBLEMA_422_JA_DESATIVADO },
    { status: 409, corpo: PROBLEMA_409_CONCORRENCIA_NA_REMOCAO },
    { status: 500, corpo: ERRO_INTERNO },
  ]) {
    test(`desativação recusada (${recusa.status}) mantém o diálogo, a mensagem e o foco no botão, que volta a aceitar o clique`, async ({
      page,
    }) => {
      const { liberar, envios } = await mockApi(page, [recusa, SALVO], SEM_O_ATIVO);
      const { dialogo, confirmar } = await abrirConfirmacao(page, 'desativar');
      await confirmar.click();
      liberar();
      const mensagem = dialogo.locator('.field__error');
      await expect(mensagem).toContainText(recusa.corpo.title);
      await expect(confirmar).not.toHaveAttribute('aria-disabled', 'true');
      await expect(confirmar).toBeFocused();
      await expect(dialogo.getByRole('status')).toContainText('Não foi possível desativar');
      await confirmar.click();
      await expect(mensagem).toBeHidden();
      await expect(dialogo).toBeHidden();
      expect(envios).toEqual(['DELETE', 'DELETE']);
    });
  }

  test('cancelar a confirmação devolve o foco ao botão de desativar da linha', async ({ page }) => {
    await mockApi(page, [], SEM_O_ATIVO);
    const { dialogo } = await abrirConfirmacao(page, 'desativar');
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(lixeira(page)).toBeFocused();
  });
});
