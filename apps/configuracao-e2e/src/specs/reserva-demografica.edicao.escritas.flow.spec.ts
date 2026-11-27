import { expect, test } from '@playwright/test';
import { ERRO_INTERNO } from '../support/escritas-retidas';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import {
  abrirEdicao,
  campo,
  editar,
  mockApi,
  PROBLEMA_422,
  salvarReferencia,
  titulo,
} from '../support/reserva-demografica-escritas';

test.describe('Reserva demográfica — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('edição pendente preserva foco e valores, recusa reenvio e a recusa foca o campo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 422, corpo: PROBLEMA_422 }],
      'com-o-censo',
    );
    const drawer = await abrirEdicao(page);
    const ppi = campo(drawer, 'ppiPercentual');
    await ppi.fill('80');
    await salvarReferencia(drawer).click();
    const salvar = drawer.getByRole('button', { name: 'Salvando...' });
    await expect(ppi).toBeDisabled();
    await expect(ppi).toHaveValue('80');
    await expect(campo(drawer, 'baseLegal')).toBeDisabled();
    await expect(salvar).toBeFocused();
    await expect(salvar).toHaveAttribute('aria-disabled', 'true');
    await expect(salvar).toHaveAttribute('aria-busy', 'true');
    await expect(salvar).toHaveCSS('cursor', 'not-allowed');
    await expect(drawer.getByRole('status').filter({ hasText: 'Salvando' })).toHaveCount(1);
    await expect(drawer.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await salvar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(envios).toEqual(['PUT']);
    liberar();
    await expect(ppi).toBeEnabled();
    await expect(ppi).toBeFocused();
    await expect(ppi).toHaveAttribute('aria-invalid', 'true');
    await expect(drawer.getByText('Percentual recusado.')).toBeVisible();
  });

  test('Enter no campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível com a mesma chave', async ({
    page,
  }) => {
    const { liberar, envios, chaves } = await mockApi(
      page,
      [{ status: 500, corpo: ERRO_INTERNO }, { status: 204 }],
      'com-o-censo',
    );
    const drawer = await abrirEdicao(page);
    const base = campo(drawer, 'baseLegal');
    await base.focus();
    await page.keyboard.press('Enter');
    await expect(base).toBeDisabled();
    await expect(drawer.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar(0);
    await expect(drawer.getByText('Erro interno')).toBeVisible();
    await expect(base).toBeEnabled();
    const salvar = salvarReferencia(drawer);
    await expect(salvar).toBeFocused();
    await salvar.click();
    liberar(1);
    await expect(drawer).toBeHidden();
    expect(envios).toEqual(['PUT', 'PUT']);
    expect(chaves[1]).toBe(chaves[0]);
  });

  test('o censo fica desabilitado na edição', async ({ page }) => {
    await mockApi(page, [], 'com-o-censo');
    const drawer = await abrirEdicao(page);
    await expect(campo(drawer, 'censoReferencia')).toBeDisabled();
    await expect(campo(drawer, 'ppiPercentual')).toBeEnabled();
  });

  test('edição concluída devolve o foco ao botão da linha depois da recarga', async ({ page }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'com-o-censo');
    const drawer = await abrirEdicao(page);
    await salvarReferencia(drawer).click();
    liberar();
    await expect(drawer).toBeHidden();
    await expect(editar(page)).toBeDisabled();
    await expect(editar(page)).toBeEnabled();
    await expect(editar(page)).toBeFocused();
  });

  test('edição concluída, com falha na recarga, leva o foco ao título da lista', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'com-falha');
    const drawer = await abrirEdicao(page);
    await salvarReferencia(drawer).click();
    liberar();
    await expect(drawer).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  test('cancelar a edição devolve o foco ao botão da linha', async ({ page }) => {
    await mockApi(page, [], 'com-o-censo');
    const drawer = await abrirEdicao(page);
    await drawer.getByRole('button', { name: 'Cancelar' }).click();
    await expect(drawer).toBeHidden();
    await expect(editar(page)).toBeFocused();
  });

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, [], 'com-o-censo', 'falha');
    await page.goto('/reserva-demografica');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(editar(page)).toBeVisible();
    await expect(titulo(page)).toBeFocused();
  });
});
