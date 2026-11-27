import { expect, test } from '@playwright/test';
import {
  RECUSA_DO_ENDERECO,
  abrirCadastro,
  buscarOCep,
  mockApi,
  preencherCadastroComCep,
  preencherSiglaENome,
} from '../support/escritas-dos-campi';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

test.describe('Campus — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, [{ status: 201, corpo: 'novo-id' }]);
    const formulario = await abrirCadastro(page);
    await formulario.locator('[formControlName="nome"]').fill('Campus de Parauapebas');
    await formulario.getByRole('button', { name: 'Criar campus' }).focus();
    await page.keyboard.press('Enter');
    await expect(formulario.locator('[formControlName="sigla"]')).toBeFocused();
    expect(envios).toEqual([]);
  });

  test('cadastro novo com o CEP pendente leva o foco ao CEP e não afirma que falta a cidade', async ({
    page,
  }) => {
    const { envios } = await mockApi(page, [{ status: 201, corpo: 'novo-id' }]);
    const formulario = await abrirCadastro(page);
    await preencherSiglaENome(formulario);
    await page.locator('#campus-endereco-cep').fill('68507');
    await formulario.getByRole('button', { name: 'Criar campus' }).click();
    await expect(page.locator('#campus-endereco-cep')).toBeFocused();
    await expect(formulario.getByText('Selecione a cidade do endereço')).toHaveCount(0);
    expect(envios).toEqual([]);
  });

  test('a pendência da cidade sai da tela quando a busca do CEP preenche a cidade', async ({
    page,
  }) => {
    await mockApi(page, [{ status: 201, corpo: 'novo-id' }]);
    const formulario = await abrirCadastro(page);
    await preencherSiglaENome(formulario);
    await formulario.getByRole('button', { name: 'Criar campus' }).click();
    await expect(formulario.getByText('Selecione a cidade do endereço')).toBeVisible();
    await buscarOCep(page);
    await expect(formulario.getByText('Selecione a cidade do endereço')).toHaveCount(0);
  });

  test('cadastro concluído devolve o foco ao botão que abriu o formulário', async ({ page }) => {
    const { liberar } = await mockApi(page, [{ status: 201, corpo: 'novo-id' }]);
    const formulario = await preencherCadastroComCep(page);
    await formulario.getByRole('button', { name: 'Criar campus' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(page.getByRole('button', { name: 'Novo campus' })).toBeFocused();
  });

  test('recusa só do endereço leva o foco à mensagem no bloco do endereço', async ({ page }) => {
    const { liberar } = await mockApi(page, [{ status: 422, corpo: RECUSA_DO_ENDERECO }]);
    const formulario = await preencherCadastroComCep(page);
    await formulario.getByRole('button', { name: 'Criar campus' }).click();
    liberar();
    const mensagem = formulario.locator('ui-endereco-geo .field__error');
    await expect(mensagem).toHaveText('A cidade não corresponde ao CEP informado.');
    await expect(mensagem).toBeFocused();
    await expect(formulario.locator('ui-endereco-geo fieldset')).toHaveAttribute(
      'aria-describedby',
      (await mensagem.getAttribute('id')) ?? '',
    );
  });
});
