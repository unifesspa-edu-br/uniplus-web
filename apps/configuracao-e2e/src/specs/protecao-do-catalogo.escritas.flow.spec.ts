import { expect, test } from '@playwright/test';
import {
  CONCORRENCIA,
  ERRO_INTERNO,
  SEM_QUEM_APROVE,
  abrirAprovacao,
  mockApi,
  titulo,
} from '../support/escritas-da-protecao';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

test.describe('Proteção de dados do catálogo — decisões e foco', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('aprovação pendente mantém o botão do diálogo focado e ocupado, recusa Esc e Cancelar e não reenvia', async ({
    page,
  }) => {
    const mock = await mockApi(page, { decisoes: [{ status: 204 }] });
    const { drawer, dialogo, aprovar } = await abrirAprovacao(page);

    await aprovar.click();
    await expect(aprovar).toBeFocused();
    await expect(aprovar).toHaveAttribute('aria-disabled', 'true');
    await expect(aprovar).toHaveAttribute('aria-busy', 'true');
    await expect(aprovar).toHaveCSS('cursor', 'not-allowed');
    await expect(dialogo.locator('[role="status"]')).toContainText('Registrando decisão');
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
    await aprovar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(mock.chaves()).toHaveLength(1);

    mock.liberar();
    await expect(drawer).toBeHidden();
  });

  test('aprovação concluída, com o item ausente da recarga atrasada, leva o foco ao título', async ({
    page,
  }) => {
    const mock = await mockApi(page, { decisoes: [{ status: 204 }], recarga: 'sem-o-item' });
    const { drawer, aprovar } = await abrirAprovacao(page);

    await aprovar.click();
    mock.liberar();
    await expect(drawer).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  test('aprovação concluída, com falha na recarga, leva o foco ao título e oferece nova tentativa', async ({
    page,
  }) => {
    const mock = await mockApi(page, { decisoes: [{ status: 204 }], recarga: 'com-falha' });
    const { drawer, aprovar } = await abrirAprovacao(page);

    await aprovar.click();
    mock.liberar();
    await expect(drawer).toBeHidden();
    await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
    await expect(titulo(page)).toBeFocused();
  });

  test('aprovação concluída não tira o foco de quem o levou a outro ponto durante a recarga', async ({
    page,
  }) => {
    const mock = await mockApi(page, { decisoes: [{ status: 204 }] });
    const { drawer, aprovar } = await abrirAprovacao(page);

    await aprovar.click();
    mock.liberar();
    await expect(drawer).toBeHidden();
    await page.evaluate(() => {
      const outro = document.createElement('button');
      outro.id = 'foco-externo';
      document.body.append(outro);
      outro.focus();
    });
    await expect(page.getByText('Nenhum item aguardando a sua decisão')).toBeVisible();
    await expect(page.locator('#foco-externo')).toBeFocused();
  });

  test('erro do servidor mantém o foco no botão, que aceita o clique e repete com a mesma chave', async ({
    page,
  }) => {
    const mock = await mockApi(page, {
      decisoes: [{ status: 500, corpo: ERRO_INTERNO }, { status: 204 }],
    });
    const { drawer, dialogo, aprovar } = await abrirAprovacao(page);

    await aprovar.click();
    mock.liberar(0);
    await expect(dialogo.getByText('Erro interno')).toBeVisible();
    await expect(aprovar).not.toHaveAttribute('aria-disabled', 'true');
    await expect(aprovar).toBeFocused();

    await aprovar.click();
    mock.liberar(1);
    await expect(drawer).toBeHidden();
    expect(mock.chaves()).toHaveLength(2);
    expect(mock.chaves()[1]).toBe(mock.chaves()[0]);
  });

  test('recusa de regra (422) mantém o diálogo e o drawer abertos e o foco no botão', async ({
    page,
  }) => {
    const mock = await mockApi(page, { decisoes: [{ status: 422, corpo: SEM_QUEM_APROVE }] });
    const { drawer, dialogo, aprovar } = await abrirAprovacao(page);

    await aprovar.click();
    mock.liberar();
    await expect(dialogo.getByText('Ninguém tem a permissão de aprovar')).toBeVisible();
    await expect(drawer).toBeVisible();
    await expect(aprovar).toBeFocused();
    await expect(aprovar).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('proteção alterada (409) fecha o drawer, relê a fila e leva o foco ao título', async ({
    page,
  }) => {
    const mock = await mockApi(page, {
      decisoes: [{ status: 409, corpo: CONCORRENCIA }],
      recarga: 'sem-o-item',
    });
    const { drawer, aprovar } = await abrirAprovacao(page);

    await aprovar.click();
    mock.liberar();
    await expect(drawer).toBeHidden();
    await expect(page.getByText(/A proteção do item mudou desde a leitura/).first()).toBeVisible();
    await expect(titulo(page)).toBeFocused();
  });
});
