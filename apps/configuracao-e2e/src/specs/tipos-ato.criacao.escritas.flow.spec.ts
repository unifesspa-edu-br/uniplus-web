import { expect, test } from '@playwright/test';
import { PROBLEMA_409_PROCESSANDO } from '../support/mock-de-lista-com-escritas';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import {
  abrirCadastro,
  campoNome,
  CRIADO,
  mockApi,
  novo,
  PROBLEMA_409_SOBREPOSICAO,
  RECUSA_DE_NOME,
  salvarTipo,
} from '../support/tipos-ato-escritas';

test.describe('Tipo de ato — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('criação pendente preserva foco e valores, recusa reenvio, Esc e X; a recusa foca o campo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 422, corpo: RECUSA_DE_NOME }],
      'com-o-item',
    );
    const formulario = await abrirCadastro(page);
    const nome = campoNome(formulario);
    await salvarTipo(formulario).click();
    const salvar = formulario.getByRole('button', { name: 'Salvando...' });
    await expect(nome).toBeDisabled();
    await expect(nome).toHaveValue('Nova vigência');
    await expect(formulario.getByRole('radio', { name: 'Não' }).first()).toBeDisabled();
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
    await expect(nome).toBeEnabled();
    await expect(nome).toBeFocused();
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
    await expect(formulario.getByText('Nome fora do padrão.')).toBeVisible();
  });

  test('a sobreposição de vigência orienta no alerta, sem marcar campo, e deixa o envio disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_409_SOBREPOSICAO }, CRIADO],
      'com-o-item',
    );
    const formulario = await abrirCadastro(page);
    const enviar = salvarTipo(formulario);
    await enviar.click();
    liberar();
    await expect(formulario.locator('.alert__msg')).toContainText(
      'Encerre a anterior ou escolha outro início',
    );
    await expect(formulario.locator('.field.is-error')).toHaveCount(0);
    await expect(enviar).not.toHaveAttribute('aria-disabled', 'true');
    await enviar.click();
    await expect(formulario).toBeHidden();
    expect(envios).toEqual(['POST', 'POST']);
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
    const enviar = salvarTipo(formulario);
    await enviar.click();
    liberar();
    await expect(formulario.locator('.alert__msg')).toContainText('Escrita em processamento');
    await expect(formulario.locator('.field.is-error')).toHaveCount(0);
    await expect(enviar).not.toHaveAttribute('aria-disabled', 'true');
    await enviar.click();
    await expect(formulario).toBeHidden();
    expect(envios).toEqual(['POST', 'POST']);
  });

  test('criação concluída devolve o foco ao botão de cadastro', async ({ page }) => {
    const { liberar } = await mockApi(page, [CRIADO], 'com-o-item');
    const formulario = await abrirCadastro(page);
    await salvarTipo(formulario).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(novo(page)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(novo(page)).toBeFocused();
  });
});
