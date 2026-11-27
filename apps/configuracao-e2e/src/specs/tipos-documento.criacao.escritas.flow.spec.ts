import { expect, test } from '@playwright/test';
import { PROBLEMA_409_PROCESSANDO } from '../support/mock-de-lista-com-escritas';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import {
  abrirCadastro,
  campo,
  CRIADO,
  mockApi,
  novo,
  PROBLEMA_409_DUPLICADO,
  RECUSA_DE_NOME,
  salvarDe,
} from '../support/tipos-documento-escritas';

test.describe('Tipo de documento — escritas', () => {
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
    const nome = campo(formulario, 'nome');
    await salvarDe(formulario).click();
    const salvar = formulario.getByRole('button', { name: 'Salvando...' });
    await expect(nome).toBeDisabled();
    await expect(nome).toHaveValue('Declaração de renda');
    await expect(campo(formulario, 'categoria')).toBeDisabled();
    await expect(salvar).toBeFocused();
    await expect(salvar).toHaveAttribute('aria-disabled', 'true');
    await expect(salvar).toHaveAttribute('aria-busy', 'true');
    await expect(salvar).toHaveCSS('cursor', 'not-allowed');
    await expect(formulario.locator('[role="status"]').filter({ hasText: 'Salvando' })).toHaveCount(
      1,
    );
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

  test('o código duplicado marca o campo Código, mantém o formulário e deixa o envio disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_409_DUPLICADO }, CRIADO],
      'com-o-item',
    );
    const formulario = await abrirCadastro(page);
    await salvarDe(formulario).click();
    liberar();
    const codigo = campo(formulario, 'codigo');
    await expect(codigo).toHaveAttribute('aria-invalid', 'true');
    await expect(codigo).toBeFocused();
    await expect(formulario.getByText(PROBLEMA_409_DUPLICADO.title)).toBeVisible();
    await codigo.fill('DECL_RENDA_2');
    await salvarDe(formulario).click();
    await expect(formulario).toBeHidden();
    expect(envios).toEqual(['POST', 'POST']);
  });

  test('conflito de processamento aparece no alerta, sem marcar campo, e deixa o envio disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_409_PROCESSANDO }, CRIADO],
      'com-o-item',
    );
    const formulario = await abrirCadastro(page);
    const enviar = salvarDe(formulario);
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
    await salvarDe(formulario).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(novo(page)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(novo(page)).toBeFocused();
  });
});
