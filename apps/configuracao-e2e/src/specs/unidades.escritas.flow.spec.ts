import { expect, test } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import {
  PROBLEMA_409_PROCESSANDO,
  PROBLEMA_409_SIGLA,
  PROBLEMA_500,
  RECUSA_DE_NOME,
  CRIADO,
  SALVO,
  COM_AMBAS,
  SEM_A_REITORIA,
  mockApi,
  titulo,
  novo,
  editar,
  abrirCadastro,
  abrirEdicao,
} from '../support/unidades-escritas';

test.describe('Unidade — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('criação pendente preserva foco e valores, recusa reenvio, Esc e X; a recusa foca o campo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 422, corpo: RECUSA_DE_NOME }],
      COM_AMBAS,
    );
    const formulario = await abrirCadastro(page);
    const nome = formulario.locator('input[formcontrolname="nome"]');
    await formulario.getByRole('button', { name: 'Criar unidade' }).click();
    const salvar = formulario.getByRole('button', { name: 'Salvando...' });
    await expect(nome).toBeDisabled();
    await expect(nome).toHaveValue('Núcleo de Tecnologia');
    await expect(salvar).toBeFocused();
    await expect(salvar).toHaveAttribute('aria-disabled', 'true');
    await expect(salvar).toHaveAttribute('aria-busy', 'true');
    await expect(salvar).toHaveCSS('cursor', 'not-allowed');
    await expect(
      formulario.locator('[role="status"]').filter({ hasText: 'Salvando' }),
    ).toBeAttached();
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
    await expect(
      formulario.locator('[role="status"]').filter({ hasText: 'Revise os campos' }),
    ).toBeAttached();
  });

  test('sigla já em uso marca o campo de sigla e o foca', async ({ page }) => {
    const { liberar } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_409_SIGLA }],
      COM_AMBAS,
    );
    const formulario = await abrirCadastro(page);
    await formulario.getByRole('button', { name: 'Criar unidade' }).click();
    liberar();
    const sigla = formulario.locator('input[formcontrolname="sigla"]');
    await expect(sigla).toBeFocused();
    await expect(sigla).toHaveAttribute('aria-invalid', 'true');
    await expect(formulario.getByText(PROBLEMA_409_SIGLA.title)).toBeVisible();
  });

  test('conflito de processamento aparece no alerta e deixa o envio disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_409_PROCESSANDO }, CRIADO],
      COM_AMBAS,
    );
    const formulario = await abrirCadastro(page);
    const enviar = formulario.getByRole('button', { name: 'Criar unidade' });
    await enviar.click();
    liberar();
    await expect(
      formulario.locator('ui-alert').filter({ hasText: 'Escrita em processamento' }),
    ).toBeVisible();
    await expect(formulario.locator('.field.is-error')).toHaveCount(0);
    await expect(enviar).not.toHaveAttribute('aria-disabled', 'true');
    await enviar.click();
    await expect(formulario).toBeHidden();
    expect(envios).toEqual(['POST', 'POST']);
  });

  test('Enter no campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 500, corpo: PROBLEMA_500 }],
      COM_AMBAS,
    );
    const formulario = await abrirEdicao(page);
    const nome = formulario.locator('input[formcontrolname="nome"]');
    await nome.focus();
    await page.keyboard.press('Enter');
    await expect(nome).toBeDisabled();
    await expect(formulario.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar();
    await expect(formulario.locator('.alert__msg')).toBeVisible();
    await expect(nome).toBeEnabled();
    await expect(formulario.getByRole('button', { name: 'Salvar unidade' })).toBeFocused();
    expect(envios).toEqual(['PUT']);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, [SALVO], COM_AMBAS);
    const formulario = await abrirEdicao(page);
    const sigla = formulario.locator('input[formcontrolname="sigla"]');
    await sigla.fill('');
    await formulario.getByRole('button', { name: 'Salvar unidade' }).focus();
    await page.keyboard.press('Enter');
    await expect(sigla).toBeFocused();
    await expect(sigla).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, [], COM_AMBAS, 'falha');
    await page.goto('/unidades');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(editar(page)).toBeVisible();
    await expect(titulo(page)).toBeFocused();
  });

  test('edição concluída devolve o foco ao acionador depois da recarga', async ({ page }) => {
    const { liberar } = await mockApi(page, [SALVO], COM_AMBAS);
    const formulario = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Salvar unidade' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(editar(page)).toBeDisabled();
    await expect(editar(page)).toBeEnabled();
    await expect(editar(page)).toBeFocused();
  });

  test('criação concluída devolve o foco ao botão de cadastro', async ({ page }) => {
    const { liberar } = await mockApi(page, [CRIADO], COM_AMBAS);
    const formulario = await abrirCadastro(page);
    await formulario.getByRole('button', { name: 'Criar unidade' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(novo(page)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(novo(page)).toBeFocused();
  });

  test('cancelar a edição devolve o foco ao acionador', async ({ page }) => {
    await mockApi(page, [], COM_AMBAS);
    const formulario = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Cancelar' }).click();
    await expect(formulario).toBeHidden();
    await expect(editar(page)).toBeFocused();
  });

  for (const recarga of [SEM_A_REITORIA, 'falha'] as const) {
    const situacaoDaRecarga = recarga === 'falha' ? 'com falha' : 'sem o item';
    test(`edição concluída, com a recarga ${situacaoDaRecarga}, leva o foco ao título da lista`, async ({
      page,
    }) => {
      const { liberar } = await mockApi(page, [SALVO], recarga);
      const formulario = await abrirEdicao(page);
      await formulario.getByRole('button', { name: 'Salvar unidade' }).click();
      liberar();
      await expect(formulario).toBeHidden();
      await expect(titulo(page)).toBeFocused();
    });
  }
});
