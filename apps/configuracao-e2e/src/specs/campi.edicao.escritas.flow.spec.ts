import { expect, test } from '@playwright/test';
import {
  ERRO_INTERNO,
  PROCESSAMENTO_EM_CURSO,
  RECUSA_DA_SIGLA,
  SIGLA_JA_EXISTE,
  abrirEdicao,
  mockApi,
  titulo,
} from '../support/escritas-dos-campi';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

test.describe('Campus — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('edição pendente preserva foco e valores, recusa reenvio e a recusa foca o campo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 422, corpo: RECUSA_DA_SIGLA }]);
    const { formulario } = await abrirEdicao(page);
    const nome = formulario.locator('input[formcontrolname="nome"]');
    const sigla = formulario.locator('input[formcontrolname="sigla"]');
    await nome.fill('Campus de Marabá revisado');
    await formulario.getByRole('button', { name: 'Salvar campus' }).click();
    const salvar = formulario.getByRole('button', { name: 'Salvando...' });
    await expect(nome).toBeDisabled();
    await expect(nome).toHaveValue('Campus de Marabá revisado');
    await expect(salvar).toBeFocused();
    await expect(salvar).toHaveAttribute('aria-disabled', 'true');
    await expect(salvar).toHaveAttribute('aria-busy', 'true');
    await expect(salvar).toHaveCSS('cursor', 'not-allowed');
    await expect(formulario.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(formulario).toBeVisible();
    await expect(formulario.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await salvar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(envios).toEqual(['PUT']);
    liberar();
    await expect(nome).toBeEnabled();
    await expect(sigla).toBeFocused();
    await expect(sigla).toHaveAttribute('aria-invalid', 'true');
    await expect(formulario.getByText('Sigla fora do padrão.')).toBeVisible();
  });

  test('falha geral no salvamento mantém o foco no botão de salvar', async ({ page }) => {
    const { liberar } = await mockApi(page, [{ status: 500, corpo: ERRO_INTERNO }]);
    const { formulario } = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Salvar campus' }).click();
    liberar();
    await expect(formulario.getByText('Falha ao gravar o campus')).toBeVisible();
    await expect(formulario.getByRole('button', { name: 'Salvar campus' })).toBeFocused();
  });

  test('sigla já cadastrada marca o campo e renova a chave; processamento em curso a mantém', async ({
    page,
  }) => {
    const { liberar, chaves } = await mockApi(page, [
      { status: 409, corpo: PROCESSAMENTO_EM_CURSO },
      { status: 409, corpo: SIGLA_JA_EXISTE },
    ]);
    const { formulario } = await abrirEdicao(page);
    const salvar = formulario.getByRole('button', { name: 'Salvar campus' });
    await salvar.click();
    liberar();
    await expect(
      formulario.getByText('A requisição anterior ainda está em processamento'),
    ).toBeVisible();
    await expect(salvar).toBeFocused();
    await salvar.click();
    const sigla = formulario.locator('input[formcontrolname="sigla"]');
    await expect(sigla).toBeFocused();
    await expect(sigla).toHaveAttribute('aria-invalid', 'true');
    expect(chaves).toHaveLength(2);
    expect(chaves[1]).toBe(chaves[0]);
    await sigla.fill('MARABA2');
    await salvar.click();
    await expect.poll(() => chaves.length).toBe(3);
    expect(chaves[2]).not.toBe(chaves[1]);
  });

  test('Enter no campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 500, corpo: ERRO_INTERNO }]);
    const { formulario } = await abrirEdicao(page);
    const nome = formulario.locator('input[formcontrolname="nome"]');
    await nome.focus();
    await page.keyboard.press('Enter');
    await expect(nome).toBeDisabled();
    await expect(formulario.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar();
    await expect(formulario.getByText('Falha ao gravar o campus')).toBeVisible();
    await expect(nome).toBeEnabled();
    await expect(formulario.getByRole('button', { name: 'Salvar campus' })).toBeFocused();
    expect(envios).toEqual(['PUT']);
  });

  test('cancelar o formulário devolve o foco ao acionador sem enviar', async ({ page }) => {
    const { envios } = await mockApi(page, [{ status: 204 }]);
    const { acionador, formulario } = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Cancelar' }).click();
    await expect(formulario).toBeHidden();
    await expect(acionador).toBeFocused();
    expect(envios).toEqual([]);
  });

  test('edição concluída devolve o foco ao acionador depois da recarga', async ({ page }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }]);
    const { acionador, formulario } = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Salvar campus' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(acionador).toBeDisabled();
    await expect(acionador).toBeEnabled();
    await expect(acionador).toBeFocused();
  });

  test('edição concluída, com falha na recarga, leva o foco ao título da lista', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'com-falha');
    const { formulario } = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Salvar campus' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, [{ status: 204 }], 'com-o-campus', 'falha');
    await page.goto('/campi');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('button', { name: 'Editar campus MARABA' })).toBeVisible();
    await expect(titulo(page)).toBeFocused();
  });
});
