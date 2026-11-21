import { expect, test } from '@playwright/test';
import {
  PROBLEMA_404,
  PROBLEMA_500,
  SALVO,
  abrirEdicao,
  editar,
  mockApi,
  novo,
  titulo,
} from '../support/api-de-precedencias-escritas';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

test.describe('Precedência de fase — edição', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('Enter no campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 500, corpo: PROBLEMA_500 }],
      'com-o-item',
    );
    const formulario = await abrirEdicao(page);
    const antecessora = formulario.locator('input[formcontrolname="antecessoraCodigo"]');
    await antecessora.focus();
    await page.keyboard.press('Enter');
    await expect(antecessora).toBeDisabled();
    await expect(formulario.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar();
    await expect(formulario.locator('.alert__msg')).toBeVisible();
    await expect(formulario.getByRole('button', { name: 'Salvar aresta' })).toBeFocused();
    expect(envios).toEqual(['PUT']);
  });

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, [], 'com-o-item', 'falha');
    await page.goto('/precedencias-fase');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(editar(page)).toBeVisible();
    await expect(titulo(page)).toBeFocused();
  });

  test('edição concluída devolve o foco ao acionador depois da recarga', async ({ page }) => {
    const { liberar } = await mockApi(page, [SALVO], 'com-o-item');
    const formulario = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Salvar aresta' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(editar(page)).toBeDisabled();
    await expect(editar(page)).toBeEnabled();
    await expect(editar(page)).toBeFocused();
  });

  test('cancelar a edição devolve o foco ao acionador', async ({ page }) => {
    await mockApi(page, [], 'com-o-item');
    const formulario = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Cancelar' }).click();
    await expect(formulario).toBeHidden();
    await expect(editar(page)).toBeFocused();
  });

  for (const recarga of ['sem-o-item', 'com-falha'] as const) {
    test(`edição concluída, com a recarga ${recarga}, leva o foco ao título da lista`, async ({
      page,
    }) => {
      const { liberar } = await mockApi(page, [SALVO], recarga);
      const formulario = await abrirEdicao(page);
      await formulario.getByRole('button', { name: 'Salvar aresta' }).click();
      liberar();
      await expect(formulario).toBeHidden();
      await expect(titulo(page)).toBeFocused();
    });
  }

  test('aresta já removida por outra pessoa (404) ao salvar mantém o drawer, e cancelar leva o foco ao título', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 404, corpo: PROBLEMA_404 }], 'sem-o-item');
    const formulario = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Salvar aresta' }).click();
    liberar();
    await expect(formulario.locator('ui-alert')).toContainText(PROBLEMA_404.title);
    await expect(novo(page)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(editar(page)).toHaveCount(0);
    await formulario.getByRole('button', { name: 'Cancelar' }).click();
    await expect(formulario).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });
});
