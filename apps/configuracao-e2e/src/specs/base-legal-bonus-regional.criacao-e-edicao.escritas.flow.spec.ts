import { expect, test } from '@playwright/test';
import {
  CRIADO,
  mockApi,
  PROBLEMA_409_PROCESSANDO,
  PROBLEMA_500,
  RECUSA_DE_IDENTIFICACAO,
  SALVO,
} from '../support/api-da-base-legal-bonus-regional';
import {
  abrirCadastro,
  abrirEdicao,
  busca,
  editar,
  campoDaIdentificacao,
  novo,
  titulo,
} from '../support/passos-da-base-legal-bonus-regional';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

test.describe('Base legal de bônus regional — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('criação pendente preserva foco e valores, recusa reenvio, Esc e X; a recusa foca o campo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 422, corpo: RECUSA_DE_IDENTIFICACAO }],
      { recarga: 'com-o-item' },
    );
    const formulario = await abrirCadastro(page);
    const identificacao = campoDaIdentificacao(formulario);
    await formulario.getByRole('button', { name: 'Criar base legal' }).click();
    const salvar = formulario.getByRole('button', { name: 'Salvando...' });
    await expect(identificacao).toBeDisabled();
    await expect(identificacao).toHaveValue('Nova portaria');
    await expect(busca(formulario)).toBeDisabled();
    await expect(formulario.getByRole('button', { name: 'Remover Marabá' })).toBeDisabled();
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
    await expect(identificacao).toBeEnabled();
    await expect(identificacao).toBeFocused();
    await expect(identificacao).toHaveAttribute('aria-invalid', 'true');
    await expect(formulario.getByText('Identificação fora do padrão.')).toBeVisible();
  });

  test('conflito de processamento aparece no alerta e deixa o envio disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_409_PROCESSANDO }, CRIADO],
      { recarga: 'com-o-item' },
    );
    const formulario = await abrirCadastro(page);
    const enviar = formulario.getByRole('button', { name: 'Criar base legal' });
    await enviar.click();
    liberar();
    await expect(formulario.locator('.alert__msg')).toContainText('Escrita em processamento');
    await expect(formulario.locator('.field.is-error')).toHaveCount(0);
    await expect(enviar).not.toHaveAttribute('aria-disabled', 'true');
    await enviar.click();
    await expect(formulario).toBeHidden();
    expect(envios).toEqual(['POST', 'POST']);
  });

  test('Enter no campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 500, corpo: PROBLEMA_500 }], {
      recarga: 'com-o-item',
    });
    const formulario = await abrirEdicao(page);
    const identificacao = campoDaIdentificacao(formulario);
    await identificacao.focus();
    await page.keyboard.press('Enter');
    await expect(identificacao).toBeDisabled();
    await expect(formulario.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar();
    await expect(formulario.locator('.alert__msg')).toBeVisible();
    await expect(identificacao).toBeEnabled();
    await expect(formulario.getByRole('button', { name: 'Salvar base legal' })).toBeFocused();
    expect(envios).toEqual(['PUT']);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, [SALVO], { recarga: 'com-o-item' });
    const formulario = await abrirEdicao(page);
    const identificacao = campoDaIdentificacao(formulario);
    await identificacao.fill('');
    await formulario.getByRole('button', { name: 'Salvar base legal' }).focus();
    await page.keyboard.press('Enter');
    await expect(identificacao).toBeFocused();
    await expect(identificacao).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('sem município o envio é barrado e o foco vai à busca', async ({ page }) => {
    const { envios } = await mockApi(page, [SALVO], { recarga: 'com-o-item' });
    const formulario = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Remover Marabá' }).click();
    await formulario.getByRole('button', { name: 'Salvar base legal' }).click();
    await expect(formulario.getByText('Adicione ao menos um município.')).toBeVisible();
    await expect(busca(formulario)).toBeFocused();
    await expect(busca(formulario)).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('edição concluída devolve o foco ao acionador depois da recarga', async ({ page }) => {
    const { liberar } = await mockApi(page, [SALVO], { recarga: 'com-o-item' });
    const formulario = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Salvar base legal' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(editar(page)).toBeDisabled();
    await expect(editar(page)).toBeEnabled();
    await expect(editar(page)).toBeFocused();
  });

  test('criação concluída devolve o foco ao botão de cadastro', async ({ page }) => {
    const { liberar } = await mockApi(page, [CRIADO], { recarga: 'com-o-item' });
    const formulario = await abrirCadastro(page);
    await formulario.getByRole('button', { name: 'Criar base legal' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(novo(page)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(novo(page)).toBeFocused();
  });

  test('cancelar a edição devolve o foco ao acionador', async ({ page }) => {
    await mockApi(page, [], { recarga: 'com-o-item' });
    const formulario = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Cancelar' }).click();
    await expect(formulario).toBeHidden();
    await expect(editar(page)).toBeFocused();
  });

  for (const recarga of ['sem-o-item', 'com-falha'] as const) {
    test(`edição concluída, com a recarga ${recarga}, leva o foco ao título da lista`, async ({
      page,
    }) => {
      const { liberar } = await mockApi(page, [SALVO], { recarga });
      const formulario = await abrirEdicao(page);
      await formulario.getByRole('button', { name: 'Salvar base legal' }).click();
      liberar();
      await expect(formulario).toBeHidden();
      await expect(titulo(page)).toBeFocused();
    });
  }
});
