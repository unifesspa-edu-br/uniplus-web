import { expect, test, type Page } from '@playwright/test';
import {
  ERRO_INTERNO,
  ID,
  REMOCAO_BLOQUEADA,
  TERMO,
  mockTermosConsentimento,
  type OpcoesDoMock,
} from '../support/termos-consentimento-api';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

async function abrirDialogo(page: Page, opcoes: OpcoesDoMock = {}) {
  const mock = await mockTermosConsentimento(page, opcoes);
  await page.goto(`/termos-consentimento/${ID}`);
  const acionador = page.locator('[data-acao="remover"]');
  await acionador.click();
  const dialogo = page.getByRole('dialog', { name: 'Remover termo de consentimento' });
  await expect(dialogo).toBeVisible();
  return {
    ...mock,
    acionador,
    dialogo,
    confirmar: dialogo.getByRole('button', { name: 'Remover' }),
  };
}

const tituloDaLista = (page: Page) =>
  page.getByRole('heading', { name: 'Termos de consentimento', level: 2 });

test.describe('Termo de consentimento — remoção e lista', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('remoção pendente mantém o diálogo, anuncia o andamento e recusa Esc, X e novo envio', async ({
    page,
  }) => {
    const { liberar, envios, dialogo, confirmar } = await abrirDialogo(page);
    await confirmar.click();
    await expect(confirmar).toBeFocused();
    await expect(confirmar).toHaveAttribute('aria-disabled', 'true');
    await expect(confirmar).toHaveAttribute('aria-busy', 'true');
    await expect(confirmar).toHaveCSS('cursor', 'not-allowed');
    await expect(dialogo.getByRole('status')).toContainText(`Removendo o termo ${TERMO.nome}.`);
    await expect(dialogo.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
    await confirmar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(envios).toEqual(['DELETE :id']);
    liberar();
    await expect(dialogo).toBeHidden();
  });

  test('remoção concluída abre a lista sem o termo e leva o foco ao título dela', async ({
    page,
  }) => {
    const { liberar, confirmar } = await abrirDialogo(page);
    await confirmar.click();
    liberar();
    await expect(page).toHaveURL(/\/termos-consentimento$/);
    await expect(page.getByText('Termo removido')).toBeVisible();
    await expect(tituloDaLista(page)).toBeFocused();
    await expect(page.getByText('Nenhum termo de consentimento cadastrado')).toBeVisible({
      timeout: 10_000,
    });
    await expect(tituloDaLista(page)).toBeFocused();
  });

  test('remoção recusada com 409 mantém o diálogo e o foco dentro dele; cancelar volta ao botão', async ({
    page,
  }) => {
    const { liberar, dialogo, confirmar, acionador } = await abrirDialogo(page, {
      respostas: [{ status: 409, corpo: REMOCAO_BLOQUEADA }],
    });
    await confirmar.click();
    liberar();
    await expect(dialogo.locator('.field__error')).toHaveText(REMOCAO_BLOQUEADA.title);
    await expect(confirmar).not.toHaveAttribute('aria-disabled', 'true');
    await expect(confirmar).toBeFocused();
    await expect(dialogo.locator(':focus')).toHaveCount(1);
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(acionador).toBeFocused();
    await expect(page.getByText('Não foi possível concluir a ação')).toBeVisible();
  });

  test('remoção recusada com 500 avisa, mantém o diálogo e permite tentar de novo', async ({
    page,
  }) => {
    const { liberar, envios, dialogo, confirmar } = await abrirDialogo(page, {
      respostas: [{ status: 500, corpo: ERRO_INTERNO }, { status: 204 }],
    });
    await confirmar.click();
    liberar();
    await expect(dialogo.locator('.field__error')).toHaveText('Erro interno');
    await expect(confirmar).toBeFocused();
    await expect(confirmar).not.toHaveAttribute('aria-disabled', 'true');
    await confirmar.click();
    await expect(dialogo).toBeHidden();
    expect(envios).toEqual(['DELETE :id', 'DELETE :id']);
  });

  test('lista: "Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    let consultas = 0;
    await page.route(/\/api\/configuracao\/termos-consentimento(\?.*)?$/, async (route) => {
      consultas += 1;
      if (consultas > 1) await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.fulfill({
        status: consultas === 1 ? 500 : 200,
        contentType: consultas === 1 ? 'application/problem+json' : 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(consultas === 1 ? ERRO_INTERNO : []),
      });
    });
    await page.goto('/termos-consentimento');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByText('Nenhum termo de consentimento cadastrado')).toBeVisible({
      timeout: 10_000,
    });
    await expect(tituloDaLista(page)).toBeFocused();
  });
});
