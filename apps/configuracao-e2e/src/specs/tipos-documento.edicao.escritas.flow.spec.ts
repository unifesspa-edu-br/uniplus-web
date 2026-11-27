import { expect, test } from '@playwright/test';
import { ERRO_INTERNO } from '../support/escritas-retidas';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import {
  abrirEdicao,
  campo,
  editar,
  mockApi,
  PROBLEMA_409_CONCORRENCIA_DO_TIPO,
  salvarDe,
  SALVO,
  titulo,
} from '../support/tipos-documento-escritas';

test.describe('Tipo de documento — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('o conflito de concorrência no salvamento vai ao alerta, sem marcar campo, e o reenvio usa chave nova', async ({
    page,
  }) => {
    const { liberar, envios, chaves } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_409_CONCORRENCIA_DO_TIPO }, SALVO],
      'com-o-item',
    );
    const formulario = await abrirEdicao(page);
    const enviar = salvarDe(formulario);
    await enviar.click();
    liberar();
    await expect(formulario.locator('.alert__msg')).toContainText('Conflito de concorrência');
    await expect(formulario.locator('.field.is-error')).toHaveCount(0);
    await expect(enviar).not.toHaveAttribute('aria-disabled', 'true');
    await enviar.click();
    await expect(formulario).toBeHidden();
    expect(envios).toEqual(['PUT', 'PUT']);
    expect(chaves[0]).toBeTruthy();
    expect(chaves[1]).toBeTruthy();
    expect(chaves[1]).not.toBe(chaves[0]);
  });

  test('Enter no campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 500, corpo: ERRO_INTERNO }],
      'com-o-item',
    );
    const formulario = await abrirEdicao(page);
    const nome = campo(formulario, 'nome');
    await nome.focus();
    await page.keyboard.press('Enter');
    await expect(nome).toBeDisabled();
    await expect(formulario.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar();
    await expect(formulario.locator('.alert__msg')).toBeVisible();
    await expect(nome).toBeEnabled();
    await expect(salvarDe(formulario)).toBeFocused();
    expect(envios).toEqual(['PUT']);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, [SALVO], 'com-o-item');
    const formulario = await abrirEdicao(page);
    const nome = campo(formulario, 'nome');
    await nome.fill('');
    await salvarDe(formulario).focus();
    await page.keyboard.press('Enter');
    await expect(nome).toBeFocused();
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, [], 'com-o-item', 'falha');
    await page.goto('/tipos-documento');
    const tentar = page
      .locator('ui-alert')
      .filter({ hasText: 'Não foi possível carregar os tipos de documento' })
      .getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(editar(page)).toBeVisible();
    await expect(titulo(page)).toBeFocused();
  });

  test('edição concluída devolve o foco ao acionador depois da recarga', async ({ page }) => {
    const { liberar } = await mockApi(page, [SALVO], 'com-o-item');
    const formulario = await abrirEdicao(page);
    await salvarDe(formulario).click();
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
      await salvarDe(formulario).click();
      liberar();
      await expect(formulario).toBeHidden();
      await expect(titulo(page)).toBeFocused();
    });
  }
});
