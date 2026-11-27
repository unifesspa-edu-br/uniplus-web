import { expect, test } from '@playwright/test';
import { ERRO_INTERNO } from '../support/escritas-retidas';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import {
  abrirEdicao,
  campoNome,
  COM_AMBOS,
  editar,
  mockApi,
  PROBLEMA_409_CONCORRENCIA,
  salvarTipo,
  SALVO,
  SEM_O_ATIVO,
  situacaoDaRecarga,
  titulo,
} from '../support/tipos-processo-escritas';

test.describe('Tipo de processo — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('conflito de concorrência na edição aparece no alerta, sem marcar campo', async ({
    page,
  }) => {
    const { liberar } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_409_CONCORRENCIA }],
      COM_AMBOS,
    );
    const formulario = await abrirEdicao(page);
    await salvarTipo(formulario).click();
    liberar();
    await expect(formulario.locator('.alert__msg')).toContainText(PROBLEMA_409_CONCORRENCIA.title);
    await expect(formulario.locator('.field.is-error')).toHaveCount(0);
  });

  test('Enter no campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 500, corpo: ERRO_INTERNO }],
      COM_AMBOS,
    );
    const formulario = await abrirEdicao(page);
    const nome = campoNome(formulario);
    await nome.focus();
    await page.keyboard.press('Enter');
    await expect(nome).toBeDisabled();
    await expect(formulario.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar();
    await expect(formulario.locator('.alert__msg')).toBeVisible();
    await expect(nome).toBeEnabled();
    await expect(salvarTipo(formulario)).toBeFocused();
    expect(envios).toEqual(['PUT']);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, [SALVO], COM_AMBOS);
    const formulario = await abrirEdicao(page);
    const nome = campoNome(formulario);
    await nome.fill('');
    await salvarTipo(formulario).focus();
    await page.keyboard.press('Enter');
    await expect(nome).toBeFocused();
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, [], COM_AMBOS, 'falha');
    await page.goto('/tipos-processo');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(editar(page)).toBeVisible();
    await expect(titulo(page)).toBeFocused();
  });

  test('edição concluída devolve o foco ao acionador depois da recarga', async ({ page }) => {
    const { liberar } = await mockApi(page, [SALVO], COM_AMBOS);
    const formulario = await abrirEdicao(page);
    await salvarTipo(formulario).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(editar(page)).toBeDisabled();
    await expect(editar(page)).toBeEnabled();
    await expect(editar(page)).toBeFocused();
  });

  test('cancelar a edição devolve o foco ao acionador', async ({ page }) => {
    await mockApi(page, [], COM_AMBOS);
    const formulario = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Cancelar' }).click();
    await expect(formulario).toBeHidden();
    await expect(editar(page)).toBeFocused();
  });

  for (const recarga of [SEM_O_ATIVO, 'falha'] as const) {
    test(`edição concluída, com a recarga ${situacaoDaRecarga(recarga)}, leva o foco ao título da lista`, async ({
      page,
    }) => {
      const { liberar } = await mockApi(page, [SALVO], recarga);
      const formulario = await abrirEdicao(page);
      await salvarTipo(formulario).click();
      liberar();
      await expect(formulario).toBeHidden();
      await expect(titulo(page)).toBeFocused();
    });
  }
});
