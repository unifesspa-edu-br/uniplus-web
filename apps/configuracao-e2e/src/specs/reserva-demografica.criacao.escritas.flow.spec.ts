import { expect, test } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import {
  abrirCadastro,
  campo,
  criarReferencia,
  mockApi,
  novo,
  preencherCadastro,
  PROBLEMA_DUPLICADO,
  PROBLEMA_PROCESSANDO,
} from '../support/reserva-demografica-escritas';

test.describe('Reserva demográfica — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, [{ status: 201, corpo: 'id' }], 'com-o-censo');
    const drawer = await abrirCadastro(page);
    await criarReferencia(drawer).focus();
    await page.keyboard.press('Enter');
    await expect(campo(drawer, 'censoReferencia')).toBeFocused();
    await expect(campo(drawer, 'censoReferencia')).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('censo duplicado marca o campo do censo e foca nele', async ({ page }) => {
    const { liberar } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_DUPLICADO }],
      'com-o-censo',
    );
    const drawer = await abrirCadastro(page);
    await preencherCadastro(drawer);
    await criarReferencia(drawer).click();
    liberar();
    await expect(campo(drawer, 'censoReferencia')).toBeFocused();
    await expect(campo(drawer, 'censoReferencia')).toHaveAttribute('aria-invalid', 'true');
    await expect(drawer.getByText(PROBLEMA_DUPLICADO.title)).toBeVisible();
  });

  test('conflito de processamento mostra a mensagem geral e não marca o censo', async ({
    page,
  }) => {
    const { liberar } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_PROCESSANDO }],
      'com-o-censo',
    );
    const drawer = await abrirCadastro(page);
    await preencherCadastro(drawer);
    await criarReferencia(drawer).click();
    liberar();
    await expect(drawer.getByText(PROBLEMA_PROCESSANDO.title)).toBeVisible();
    await expect(campo(drawer, 'censoReferencia')).not.toHaveAttribute('aria-invalid', 'true');
    await expect(criarReferencia(drawer)).toBeEnabled();
  });

  test('cadastro concluído devolve o foco ao botão de novo censo depois da recarga', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 201, corpo: 'novo-id' }], 'com-o-censo');
    const drawer = await abrirCadastro(page);
    await preencherCadastro(drawer);
    await criarReferencia(drawer).click();
    liberar();
    await expect(drawer).toBeHidden();
    await expect(novo(page)).toBeDisabled();
    await expect(novo(page)).toBeEnabled();
    await expect(novo(page)).toBeFocused();
  });

  test('cancelar o cadastro devolve o foco ao botão de novo censo', async ({ page }) => {
    await mockApi(page, [], 'com-o-censo');
    const drawer = await abrirCadastro(page);
    await drawer.getByRole('button', { name: 'Cancelar' }).click();
    await expect(drawer).toBeHidden();
    await expect(novo(page)).toBeFocused();
  });
});
