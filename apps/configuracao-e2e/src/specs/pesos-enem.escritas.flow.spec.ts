import { expect, test } from '@playwright/test';
import {
  CRIADO,
  PROBLEMA_409_PAR,
  PROBLEMA_422_RESOLUCAO,
  PROBLEMA_500,
  SALVO,
  abrirCadastro,
  abrirEdicao,
  cadastrar,
  editar,
  mockApi,
  titulo,
} from '../support/pesos-enem-api';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CRIAR = { name: 'Criar resolução', exact: true } as const;
const SALVAR = { name: 'Salvar', exact: true } as const;

test.describe('Peso por Área — cadastro e edição', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('cadastro pendente fica somente leitura, mantém o foco no botão e recusa reenvio, Esc e X', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, { respostas: [CRIADO], recarga: 'com-a-nova' });
    const formulario = await abrirCadastro(page);
    const resolucao = formulario.locator('[formcontrolname="resolucao"]');
    await formulario.getByRole('button', CRIAR).click();
    const salvar = formulario.getByRole('button', { name: 'Salvando...' });
    await expect(resolucao).toBeDisabled();
    await expect(resolucao).toHaveValue('Res. 900/2026');
    await expect(salvar).toBeFocused();
    await expect(salvar).toHaveAttribute('aria-disabled', 'true');
    await expect(salvar).toHaveAttribute('aria-busy', 'true');
    await expect(salvar).toHaveCSS('cursor', 'not-allowed');
    await expect(formulario.getByRole('status').filter({ hasText: 'Criando' })).toHaveCount(1);
    await expect(formulario.getByRole('button', { name: 'Cancelar', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(formulario).toBeVisible();
    await expect(formulario.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await salvar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await expect.poll(() => envios.length).toBe(4);
    await liberar();
    await expect(formulario).toBeHidden();
    expect(envios).toEqual(['POST', 'POST', 'POST', 'POST']);
  });

  test('Enter num campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, {
      respostas: [{ status: 500, corpo: PROBLEMA_500 }],
      recarga: 'igual',
    });
    const formulario = await abrirCadastro(page);
    const resolucao = formulario.locator('[formcontrolname="resolucao"]');
    await resolucao.focus();
    await page.keyboard.press('Enter');
    await expect(resolucao).toBeDisabled();
    await expect(formulario.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    await liberar();
    await expect(formulario.locator('ui-alert')).toBeVisible();
    await expect(resolucao).toBeEnabled();
    await expect(formulario.getByRole('button', CRIAR)).toBeFocused();
    await expect(formulario.getByRole('button', CRIAR)).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  test('recusa de campo no cadastro leva o foco ao campo recusado', async ({ page }) => {
    const { liberar } = await mockApi(page, {
      respostas: [{ status: 422, corpo: PROBLEMA_422_RESOLUCAO }],
      recarga: 'igual',
    });
    const formulario = await abrirCadastro(page);
    await formulario.getByRole('button', CRIAR).click();
    await liberar();
    const resolucao = formulario.locator('[formcontrolname="resolucao"]');
    await expect(resolucao).toBeFocused();
    await expect(resolucao).toHaveAttribute('aria-invalid', 'true');
    await expect(formulario.getByText('Resolução fora do padrão.')).toBeVisible();
  });

  test('par já cadastrado marca o campo da resolução, leva o foco a ele e mantém o envio disponível', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, {
      respostas: [{ status: 409, corpo: PROBLEMA_409_PAR }],
      recarga: 'igual',
    });
    const formulario = await abrirCadastro(page);
    await formulario.getByRole('button', CRIAR).click();
    await liberar();
    const resolucao = formulario.locator('[formcontrolname="resolucao"]');
    await expect(resolucao).toBeFocused();
    await expect(resolucao).toHaveAttribute('aria-invalid', 'true');
    await expect(
      formulario.getByText('Resolução já cadastrada. Informe um identificador diferente.'),
    ).toBeVisible();
    await expect(formulario.getByRole('button', CRIAR)).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  test('cancelar o cadastro devolve o foco ao botão que o abriu', async ({ page }) => {
    await mockApi(page, { respostas: [CRIADO], recarga: 'igual' });
    const formulario = await abrirCadastro(page);
    await formulario.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(formulario).toBeHidden();
    await expect(cadastrar(page)).toBeFocused();
  });

  for (const inicial of [undefined, []] as const) {
    test(`cadastro concluído, ${inicial ? 'com a lista inicialmente vazia' : 'com a resolução nova vigente na recarga'}, leva o foco ao título`, async ({
      page,
    }) => {
      const { liberar } = await mockApi(page, {
        respostas: [CRIADO],
        recarga: 'com-a-nova',
        inicial,
      });
      const formulario = await abrirCadastro(page);
      await formulario.getByRole('button', CRIAR).click();
      await liberar();
      await expect(formulario).toBeHidden();
      await expect(page.getByText('Pesos — Res. 900/2026')).toBeVisible();
      await expect(titulo(page)).toBeFocused();
    });
  }

  test('cadastro concluído com a recarga falha mantém a lista e o foco no botão de cadastro, já disponível', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, { respostas: [CRIADO], recarga: 'com-falha' });
    const formulario = await abrirCadastro(page);
    await formulario.getByRole('button', CRIAR).click();
    await liberar();
    await expect(formulario).toBeHidden();
    await expect(cadastrar(page)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(cadastrar(page)).toBeFocused();
    await expect(page.getByText('Pesos — Res. 805/2024')).toBeVisible();
  });

  test('edição pendente trava a grade, mantém o foco em Salvar e recusa novo clique, Enter e Espaço', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, { respostas: [SALVO], recarga: 'igual' });
    await abrirEdicao(page);
    const peso = page.getByLabel('Peso de Matemática e suas Tecnologias — Tecnológica');
    await page.getByRole('button', SALVAR).click();
    const salvar = page.getByRole('button', { name: 'Salvando...' });
    await expect(peso).toBeDisabled();
    await expect(salvar).toBeFocused();
    await expect(salvar).toHaveAttribute('aria-disabled', 'true');
    await expect(salvar).toHaveAttribute('aria-busy', 'true');
    await expect(salvar).toHaveCSS('cursor', 'not-allowed');
    await expect(page.getByRole('button', { name: 'Cancelar', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(salvar).toBeVisible();
    await salvar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await expect.poll(() => envios.length).toBe(4);
    await liberar();
    await expect(editar(page)).toBeFocused();
    expect(envios).toEqual(['PUT', 'PUT', 'PUT', 'PUT']);
  });

  test('cancelar a edição devolve o foco ao botão que a abriu', async ({ page }) => {
    await mockApi(page, { respostas: [SALVO], recarga: 'igual' });
    await abrirEdicao(page);
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(editar(page)).toBeFocused();
  });

  test('envio de edição barrado localmente leva o foco ao primeiro campo inválido', async ({
    page,
  }) => {
    const { envios } = await mockApi(page, { respostas: [SALVO], recarga: 'igual' });
    await abrirEdicao(page);
    const peso = page.getByLabel('Peso de Redação — Tecnológica');
    await peso.fill('');
    await page.getByRole('button', SALVAR).click();
    await expect(peso).toBeFocused();
    await expect(peso).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('"Tentar novamente" da listagem fica indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, { respostas: [SALVO], recarga: 'igual', primeiraConsulta: 'falha' });
    await page.goto('/pesos-por-area');
    const tentar = page.locator('#cfg-pesos-enem-registros-tentar');
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(editar(page)).toBeVisible();
    await expect(titulo(page)).toBeFocused();
  });
});
