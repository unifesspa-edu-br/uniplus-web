import { expect, test } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import {
  NAO_ENCONTRADA,
  ERRO_INTERNO,
  mockApi,
  titulo,
  principal,
  drawer,
  abrirConfirmacao,
} from '../support/instituicao-escritas';

test.describe('Instituição — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('remoção pendente mantém o botão focado e indisponível; o segundo clique não envia', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 204 }], {
      recarga: 'sem-a-instituicao',
    });
    const { dialogo } = await abrirConfirmacao(page);
    const remover = dialogo.getByRole('button', { name: 'Remover', exact: true });
    await remover.click();
    await expect(remover).toBeFocused();
    await expect(remover).toHaveAttribute('aria-disabled', 'true');
    await expect(remover).toHaveAttribute('aria-busy', 'true');
    await expect(remover).toHaveCSS('cursor', 'not-allowed');
    await expect(dialogo.getByRole('status')).toContainText('Removendo a instituição Unifesspa.');
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await expect(dialogo.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
    await remover.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(envios).toEqual(['DELETE']);
    liberar();
    await expect(dialogo).toBeHidden();
  });

  test('remoção concluída, com a instituição ausente da recarga, anuncia e leva o foco ao cadastro', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], { recarga: 'sem-a-instituicao' });
    const { dialogo } = await abrirConfirmacao(page);
    await dialogo.getByRole('button', { name: 'Remover', exact: true }).click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(page.locator('.cfg-page > .sr-only[role="status"]')).toHaveText(
      'Instituição Unifesspa removida.',
    );
    await expect(principal(page)).toContainText('Cadastrar instituição');
    await expect(principal(page)).toBeFocused();
  });

  test('remoção concluída, com a instituição ainda na recarga, devolve o foco ao botão Editar', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], { recarga: 'com-a-instituicao' });
    const { dialogo } = await abrirConfirmacao(page);
    await dialogo.getByRole('button', { name: 'Remover', exact: true }).click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(principal(page)).toContainText('Editar');
    await expect(principal(page)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(principal(page)).toBeFocused();
  });

  test('remoção concluída, com falha na recarga, leva o foco ao título da página', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], { recarga: 'com-falha' });
    const { dialogo } = await abrirConfirmacao(page);
    await dialogo.getByRole('button', { name: 'Remover', exact: true }).click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  for (const [rotulo, recusa] of [['falha (500)', { status: 500, corpo: ERRO_INTERNO }]] as const) {
    test(`remoção recusada por ${rotulo} mantém o diálogo, o foco no botão e aceita nova tentativa`, async ({
      page,
    }) => {
      const { liberar, envios } = await mockApi(page, [recusa, { status: 204 }], {
        recarga: 'sem-a-instituicao',
      });
      const { dialogo } = await abrirConfirmacao(page);
      const remover = dialogo.getByRole('button', { name: 'Remover', exact: true });
      await remover.click();
      liberar();
      await expect(dialogo.locator('.field__error')).toHaveText(recusa.corpo.title);
      await expect(dialogo.getByRole('status')).toContainText('Não foi possível remover');
      await expect(remover).not.toHaveAttribute('aria-disabled', 'true');
      await expect(remover).toBeFocused();
      await remover.click();
      await expect(dialogo).toBeHidden();
      expect(envios).toEqual(['DELETE', 'DELETE']);
    });
  }

  test('remoção de instituição já removida (404) fecha o diálogo e o formulário, anuncia e leva o foco ao cadastro', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 404, corpo: NAO_ENCONTRADA }], {
      recarga: 'sem-a-instituicao',
    });
    const { dialogo } = await abrirConfirmacao(page);
    await dialogo.getByRole('button', { name: 'Remover', exact: true }).click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(drawer(page)).toBeHidden();
    await expect(page.locator('.cfg-page > .sr-only[role="status"]')).toHaveText(
      'Instituição Unifesspa já havia sido removida.',
    );
    await expect(principal(page)).toContainText('Cadastrar instituição');
    await expect(principal(page)).toBeFocused();
    expect(envios).toEqual(['DELETE']);
  });

  test('cancelar a confirmação devolve o foco ao botão Remover do formulário', async ({ page }) => {
    const { envios } = await mockApi(page, [{ status: 204 }]);
    const { dialogo, remover } = await abrirConfirmacao(page);
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(remover).toBeFocused();
    expect(envios).toEqual([]);
  });
});
