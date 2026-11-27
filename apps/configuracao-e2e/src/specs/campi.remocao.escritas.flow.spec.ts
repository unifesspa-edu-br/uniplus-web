import { expect, test } from '@playwright/test';
import {
  ERRO_INTERNO,
  REMOCAO_BLOQUEADA,
  abrirConfirmacao,
  mockApi,
  titulo,
} from '../support/escritas-dos-campi';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

test.describe('Campus — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('remoção pendente mantém o botão focado e indisponível; o segundo clique não envia', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 204 }], 'sem-o-campus');
    const { dialogo } = await abrirConfirmacao(page);
    const remover = dialogo.getByRole('button', { name: 'Remover', exact: true });
    await remover.click();
    await expect(remover).toBeFocused();
    await expect(remover).toHaveAttribute('aria-disabled', 'true');
    await expect(remover).toHaveAttribute('aria-busy', 'true');
    await expect(remover).toHaveCSS('cursor', 'not-allowed');
    await expect(dialogo.getByRole('status')).toContainText('Removendo o campus MARABA.');
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await expect(dialogo.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
    await remover.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(envios).toEqual(['DELETE']);
    liberar();
    await expect(dialogo).toBeHidden();
  });

  test('remoção concluída, com o campus ausente da recarga, anuncia e leva o foco ao título', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'sem-o-campus');
    const { dialogo } = await abrirConfirmacao(page);
    await dialogo.getByRole('button', { name: 'Remover', exact: true }).click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(page.locator('.panel-head .sr-only[role="status"]')).toHaveText(
      'Campus MARABA removido.',
    );
    await expect(titulo(page)).toBeFocused();
  });

  test('remoção concluída, com o campus ainda na recarga, devolve o foco à lixeira da linha', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'com-o-campus');
    const { acionador, dialogo } = await abrirConfirmacao(page);
    await dialogo.getByRole('button', { name: 'Remover', exact: true }).click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(acionador).toBeDisabled();
    await expect(acionador).toBeEnabled();
    await expect(acionador).toBeFocused();
  });

  test('remoção concluída, com falha na recarga, leva o foco ao título da lista', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'com-falha');
    const { dialogo } = await abrirConfirmacao(page);
    await dialogo.getByRole('button', { name: 'Remover', exact: true }).click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  for (const [rotulo, recusa] of [
    ['conflito (409)', { status: 409, corpo: REMOCAO_BLOQUEADA }],
    ['falha (500)', { status: 500, corpo: ERRO_INTERNO }],
  ] as const) {
    test(`remoção recusada por ${rotulo} mantém o diálogo, o foco no botão e aceita nova tentativa`, async ({
      page,
    }) => {
      const { liberar, envios } = await mockApi(page, [recusa, { status: 204 }], 'sem-o-campus');
      const { dialogo } = await abrirConfirmacao(page);
      const remover = dialogo.getByRole('button', { name: 'Remover', exact: true });
      await remover.click();
      liberar();
      await expect(dialogo.locator('.field__error')).toHaveText(recusa.corpo.title);
      await expect(dialogo.getByRole('status')).toContainText('Não foi possível remover');
      await expect(remover).not.toHaveAttribute('aria-disabled', 'true');
      await expect(remover).toBeFocused();
      await remover.click();
      await expect(dialogo).toBeHidden();
      expect(envios).toEqual(['DELETE', 'DELETE']);
    });
  }

  test('cancelar a confirmação devolve o foco à lixeira da linha', async ({ page }) => {
    const { envios } = await mockApi(page, [{ status: 204 }]);
    const { acionador, dialogo } = await abrirConfirmacao(page);
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(acionador).toBeFocused();
    expect(envios).toEqual([]);
  });
});
