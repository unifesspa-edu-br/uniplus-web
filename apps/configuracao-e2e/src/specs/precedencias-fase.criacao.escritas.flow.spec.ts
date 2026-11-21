import { expect, test } from '@playwright/test';
import {
  CRIADO,
  PROBLEMA_409_PROCESSANDO,
  PROBLEMA_422_DUPLICADA,
  RECUSA_DE_SUCESSORA,
  abrirCadastro,
  drawer,
  mockApi,
  novo,
} from '../support/api-de-precedencias-escritas';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

test.describe('Precedência de fase — criação', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('criação pendente preserva foco e valores, recusa reenvio, Esc e X; a recusa foca o campo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 422, corpo: RECUSA_DE_SUCESSORA }],
      'com-o-item',
    );
    const formulario = await abrirCadastro(page);
    const sucessora = formulario.locator('select[formcontrolname="sucessoraCodigo"]');
    await formulario.getByRole('button', { name: 'Criar aresta' }).click();
    const salvar = formulario.getByRole('button', { name: 'Salvando...' });
    await expect(sucessora).toBeDisabled();
    await expect(sucessora).toHaveValue('CLASSIFICACAO');
    await expect(salvar).toBeFocused();
    await expect(salvar).toHaveAttribute('aria-disabled', 'true');
    await expect(salvar).toHaveAttribute('aria-busy', 'true');
    await expect(salvar).toHaveCSS('cursor', 'not-allowed');
    await expect(formulario.locator('[role="status"]').first()).toContainText('Salvando');
    await expect(formulario.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(formulario).toBeVisible();
    await expect(formulario.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await salvar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(envios).toEqual(['POST']);
    liberar();
    await expect(sucessora).toBeEnabled();
    await expect(sucessora).toBeFocused();
    await expect(sucessora).toHaveAttribute('aria-invalid', 'true');
    await expect(formulario.getByText('Sucessora fora do padrão.')).toBeVisible();
  });

  test('aresta duplicada marca a sucessora e a foca', async ({ page }) => {
    const { liberar } = await mockApi(
      page,
      [{ status: 422, corpo: PROBLEMA_422_DUPLICADA }],
      'com-o-item',
    );
    const formulario = await abrirCadastro(page);
    await formulario.getByRole('button', { name: 'Criar aresta' }).click();
    liberar();
    const sucessora = formulario.locator('select[formcontrolname="sucessoraCodigo"]');
    await expect(sucessora).toBeFocused();
    await expect(sucessora).toHaveAttribute('aria-invalid', 'true');
    await expect(formulario.getByText(PROBLEMA_422_DUPLICADA.title)).toBeVisible();
  });

  test('conflito de processamento aparece no alerta e deixa o envio disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_409_PROCESSANDO }, CRIADO],
      'com-o-item',
    );
    const formulario = await abrirCadastro(page);
    const enviar = formulario.getByRole('button', { name: 'Criar aresta' });
    await enviar.click();
    liberar();
    await expect(formulario.locator('.alert__msg')).toBeVisible();
    await expect(formulario.locator('.field.is-error')).toHaveCount(0);
    await expect(enviar).not.toHaveAttribute('aria-disabled', 'true');
    await enviar.click();
    await expect(formulario).toBeHidden();
    expect(envios).toEqual(['POST', 'POST']);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, [CRIADO], 'com-o-item');
    await page.goto('/precedencias-fase');
    await novo(page).click();
    const formulario = drawer(page);
    await formulario.getByRole('button', { name: 'Criar aresta' }).focus();
    await page.keyboard.press('Enter');
    const antecessora = formulario.locator('select[formcontrolname="antecessoraCodigo"]');
    await expect(antecessora).toBeFocused();
    await expect(antecessora).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('criação concluída devolve o foco ao botão de cadastro', async ({ page }) => {
    const { liberar } = await mockApi(page, [CRIADO], 'com-o-item');
    const formulario = await abrirCadastro(page);
    await formulario.getByRole('button', { name: 'Criar aresta' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(novo(page)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(novo(page)).toBeFocused();
  });
});
