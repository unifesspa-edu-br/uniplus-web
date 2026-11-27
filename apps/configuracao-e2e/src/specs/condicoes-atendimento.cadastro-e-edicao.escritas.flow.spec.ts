import { expect, test } from '@playwright/test';
import { ERRO_INTERNO } from '../support/escritas-retidas';
import { campo } from '../support/passos-de-cadastro-simples';
import {
  PCD,
  PROBLEMA_422,
  PROBLEMA_DUPLICADO,
  PROBLEMA_PROCESSANDO,
  abrirCadastro,
  abrirDrawer,
  abrirEdicao,
  editar,
  mockApi,
  novo,
  preencherCadastro,
  titulo,
} from '../support/escritas-das-condicoes-de-atendimento';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

test.describe('Condição de atendimento — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('edição pendente preserva foco e valores, recusa reenvio e a recusa foca o campo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 422, corpo: PROBLEMA_422 }],
      'com-o-item',
    );
    const drawer = await abrirEdicao(page);
    const nome = campo(drawer, 'nome');
    await nome.fill('Ledor de provas');
    await drawer.getByRole('button', { name: 'Salvar condição' }).click();
    const salvar = drawer.getByRole('button', { name: 'Salvando...' });
    await expect(nome).toBeDisabled();
    await expect(nome).toHaveValue('Ledor de provas');
    await expect(campo(drawer, 'descricao')).toBeDisabled();
    await expect(salvar).toBeFocused();
    await expect(salvar).toHaveAttribute('aria-disabled', 'true');
    await expect(salvar).toHaveAttribute('aria-busy', 'true');
    await expect(salvar).toHaveCSS('cursor', 'not-allowed');
    await expect(drawer.getByRole('status').filter({ hasText: 'Salvando' })).toHaveCount(1);
    await expect(drawer.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await salvar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(envios).toEqual(['PUT']);
    liberar();
    await expect(nome).toBeEnabled();
    await expect(nome).toBeFocused();
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
    await expect(drawer.getByText('Nome fora do padrão.')).toBeVisible();
  });

  test('Enter no campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível com a mesma chave', async ({
    page,
  }) => {
    const { liberar, envios, chaves } = await mockApi(
      page,
      [{ status: 500, corpo: ERRO_INTERNO }, { status: 204 }],
      'com-o-item',
    );
    const drawer = await abrirEdicao(page);
    const nome = campo(drawer, 'nome');
    await nome.focus();
    await page.keyboard.press('Enter');
    await expect(nome).toBeDisabled();
    await expect(drawer.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar(0);
    await expect(drawer.getByText('Erro interno')).toBeVisible();
    await expect(nome).toBeEnabled();
    const salvar = drawer.getByRole('button', { name: 'Salvar condição' });
    await expect(salvar).toBeEnabled();
    await salvar.click();
    liberar(1);
    await expect(drawer).toBeHidden();
    expect(envios).toEqual(['PUT', 'PUT']);
    expect(chaves[1]).toBe(chaves[0]);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, [{ status: 201, corpo: 'id' }], 'com-o-item');
    const drawer = await abrirCadastro(page);
    await drawer.getByRole('button', { name: 'Criar condição' }).focus();
    await page.keyboard.press('Enter');
    await expect(campo(drawer, 'codigo')).toBeFocused();
    await expect(campo(drawer, 'codigo')).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('código duplicado marca o campo do código e foca nele', async ({ page }) => {
    const { liberar } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_DUPLICADO }],
      'com-o-item',
    );
    const drawer = await abrirCadastro(page);
    await preencherCadastro(drawer);
    await drawer.getByRole('button', { name: 'Criar condição' }).click();
    liberar();
    await expect(campo(drawer, 'codigo')).toBeFocused();
    await expect(campo(drawer, 'codigo')).toHaveAttribute('aria-invalid', 'true');
    await expect(drawer.getByText(PROBLEMA_DUPLICADO.title)).toBeVisible();
  });

  test('conflito de processamento mostra a mensagem geral e não marca o código', async ({
    page,
  }) => {
    const { liberar } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_PROCESSANDO }],
      'com-o-item',
    );
    const drawer = await abrirCadastro(page);
    await preencherCadastro(drawer);
    await drawer.getByRole('button', { name: 'Criar condição' }).click();
    liberar();
    await expect(drawer.getByText(PROBLEMA_PROCESSANDO.title)).toBeVisible();
    await expect(campo(drawer, 'codigo')).not.toHaveAttribute('aria-invalid', 'true');
    await expect(drawer.getByRole('button', { name: 'Criar condição' })).toBeEnabled();
  });

  test('o código reservado fica desabilitado na edição e a lixeira não é oferecida', async ({
    page,
  }) => {
    await mockApi(page, [], 'com-o-item', [PCD]);
    const drawer = await abrirDrawer(page, () =>
      page.getByRole('button', { name: 'Editar condição de atendimento PCD' }).click(),
    );
    await expect(campo(drawer, 'codigo')).toBeDisabled();
    await expect(campo(drawer, 'nome')).toBeEnabled();
    await drawer.getByRole('button', { name: 'Cancelar' }).click();
    await expect(
      page.getByRole('button', { name: 'Remover condição de atendimento PCD' }),
    ).toBeDisabled();
  });

  test('cadastro concluído devolve o foco ao botão de nova condição depois da recarga', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 201, corpo: 'novo-id' }], 'com-o-item');
    const drawer = await abrirCadastro(page);
    await preencherCadastro(drawer);
    await drawer.getByRole('button', { name: 'Criar condição' }).click();
    liberar();
    await expect(drawer).toBeHidden();
    await expect(novo(page)).toBeDisabled();
    await expect(novo(page)).toBeEnabled();
    await expect(novo(page)).toBeFocused();
  });

  test('edição concluída devolve o foco ao botão da linha depois da recarga', async ({ page }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'com-o-item');
    const drawer = await abrirEdicao(page);
    await drawer.getByRole('button', { name: 'Salvar condição' }).click();
    liberar();
    await expect(drawer).toBeHidden();
    await expect(editar(page)).toBeDisabled();
    await expect(editar(page)).toBeEnabled();
    await expect(editar(page)).toBeFocused();
  });

  test('edição concluída, com a recarga devolvendo o código alterado, devolve o foco ao botão da mesma linha', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'com-o-codigo-alterado');
    const drawer = await abrirEdicao(page);
    await drawer.getByRole('button', { name: 'Salvar condição' }).click();
    liberar();
    await expect(drawer).toBeHidden();
    const alterado = editar(page, /^Editar condição de atendimento LEDOR_V2$/);
    await expect(alterado).toBeEnabled();
    await expect(alterado).toBeFocused();
    await expect(titulo(page)).not.toBeFocused();
  });

  test('edição concluída, com falha na recarga, leva o foco ao título da lista', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'com-falha');
    const drawer = await abrirEdicao(page);
    await drawer.getByRole('button', { name: 'Salvar condição' }).click();
    liberar();
    await expect(drawer).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  test('cancelar a edição devolve o foco ao botão da linha', async ({ page }) => {
    await mockApi(page, [], 'com-o-item');
    const drawer = await abrirEdicao(page);
    await drawer.getByRole('button', { name: 'Cancelar' }).click();
    await expect(drawer).toBeHidden();
    await expect(editar(page)).toBeFocused();
  });
});
