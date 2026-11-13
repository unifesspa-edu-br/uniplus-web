import { expect, test, type Page } from '@playwright/test';
import {
  ATRASO_DA_RECARGA_EM_MS,
  CONCORRENCIA,
  DECISAO,
  DETALHE,
  EM_PROCESSAMENTO,
  ERRO_INTERNO,
  ITEM,
  type Leitura,
  abrirReprovacao,
  linha,
  mockApi,
  painel,
  responder,
  titulo,
} from '../support/escritas-da-protecao';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

test.describe('Proteção de dados do catálogo — reprovação e nova tentativa', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('reprovação pendente deixa o diálogo somente leitura, com o botão focado e Esc e X recusados', async ({
    page,
  }) => {
    const mock = await mockApi(page, { decisoes: [{ status: 204 }] });
    const { dialogo, campo, confirmar } = await abrirReprovacao(page, 'Falta a base legal.');

    await confirmar.click();
    await expect(confirmar).toBeFocused();
    await expect(confirmar).toHaveAttribute('aria-disabled', 'true');
    await expect(confirmar).toHaveAttribute('aria-busy', 'true');
    await expect(confirmar).toHaveCSS('cursor', 'not-allowed');
    await expect(campo).toBeDisabled();
    await expect(campo).toHaveValue('Falta a base legal.');
    await expect(dialogo.locator('.sr-only[role="status"]')).toContainText('Registrando decisão');
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await expect(dialogo.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
    await confirmar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(mock.chaves()).toHaveLength(1);

    mock.liberar();
    await expect(dialogo).toBeHidden();
    await expect(painel(page)).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  test('envio barrado por justificativa em branco leva o foco ao campo e não envia', async ({
    page,
  }) => {
    const mock = await mockApi(page, { decisoes: [] });
    const { campo, confirmar } = await abrirReprovacao(page, null);

    await confirmar.focus();
    await page.keyboard.press('Enter');

    await expect(campo).toBeFocused();
    await expect(campo).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Informe a justificativa da reprovação.')).toBeVisible();
    expect(mock.chaves()).toHaveLength(0);
  });

  test('reprovação recusada pelo servidor mantém o diálogo, o foco no botão e a recusa visível', async ({
    page,
  }) => {
    const mock = await mockApi(page, { decisoes: [{ status: 500, corpo: ERRO_INTERNO }] });
    const { dialogo, confirmar } = await abrirReprovacao(page, 'Falta a base legal.');

    await confirmar.click();
    mock.liberar();
    await expect(dialogo.getByText('Erro interno')).toBeVisible();
    await expect(confirmar).not.toHaveAttribute('aria-disabled', 'true');
    await expect(confirmar).toBeFocused();
    await expect(dialogo).toBeVisible();
  });

  test('decisão ainda em processamento (409) mantém o diálogo, o foco e a mesma chave', async ({
    page,
  }) => {
    const mock = await mockApi(page, {
      decisoes: [{ status: 409, corpo: EM_PROCESSAMENTO }, { status: 204 }],
    });
    const { dialogo, confirmar } = await abrirReprovacao(page, 'Falta a base legal.');

    await confirmar.click();
    mock.liberar(0);
    await expect(dialogo.getByText('A decisão ainda está em processamento')).toBeVisible();
    await expect(dialogo).toBeVisible();
    await expect(confirmar).toBeFocused();

    await confirmar.click();
    mock.liberar(1);
    await expect(dialogo).toBeHidden();
    expect(mock.chaves()[1]).toBe(mock.chaves()[0]);
  });

  test('diálogo que se fecha sozinho pela proteção alterada leva o foco ao título', async ({
    page,
  }) => {
    const mock = await mockApi(page, {
      decisoes: [{ status: 409, corpo: CONCORRENCIA }],
      recarga: 'sem-o-item',
    });
    const { dialogo, confirmar } = await abrirReprovacao(page, 'Falta a base legal.');

    await confirmar.click();
    mock.liberar();
    await expect(dialogo).toBeHidden();
    await expect(painel(page)).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  test('"Tentar novamente" da fila fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, { decisoes: [], fila: 'falha-na-primeira', recarga: 'com-o-item' });
    await page.goto('/protecao-do-catalogo');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });

    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(linha(page)).toBeVisible();
    await expect(titulo(page)).toBeFocused();
  });

  test('"Tentar novamente" do detalhe leva o foco à região dos dados do item', async ({ page }) => {
    await mockApi(page, { decisoes: [], detalhe: 'falha-na-primeira' });
    await page.goto('/protecao-do-catalogo');
    await linha(page).click();
    const tentar = painel(page).getByRole('button', { name: 'Tentar novamente' });

    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(painel(page).getByText('Proposta de proteção')).toBeVisible();
    await expect(painel(page).getByRole('region', { name: 'Dados do item' })).toBeFocused();
  });
});

test.describe('Proteção de dados do catálogo — aba Decisões', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  async function mockDecisoes(page: Page, historico: Leitura) {
    let leituras = 0;
    let leiturasDoHistorico = 0;
    await page.route(/\/api\/configuracao\/admin\/protecao-do-catalogo(\?.*)?$/, (r) =>
      responder(r, 200, []),
    );
    await page.route(
      /\/api\/configuracao\/admin\/protecao-do-catalogo\/tipos-documento\/[^/?]+$/,
      async (r) => {
        leiturasDoHistorico += 1;
        if (historico === 'falha-na-primeira' && leiturasDoHistorico === 1) {
          await responder(r, 500, ERRO_INTERNO);
          return;
        }
        if (leiturasDoHistorico > 1) {
          await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
        }
        await responder(r, 200, DETALHE);
      },
    );
    await page.route(
      /\/api\/configuracao\/admin\/protecao-do-catalogo\/decisoes(\?.*)?$/,
      async (r) => {
        leituras += 1;
        if (leituras === 1) {
          await responder(r, 500, ERRO_INTERNO);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
        await responder(r, 200, [DECISAO]);
      },
    );
  }

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockDecisoes(page, 'ok');
    await page.goto('/protecao-do-catalogo?aba=decisoes');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });

    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(
      page.getByRole('button', { name: `Ver a decisão sobre ${ITEM.nome}` }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Decisões registradas', level: 2 }),
    ).toBeFocused();
  });

  test('"Tentar novamente" do histórico leva o foco à região dos dados da decisão', async ({
    page,
  }) => {
    await mockDecisoes(page, 'falha-na-primeira');
    await page.goto('/protecao-do-catalogo?aba=decisoes');
    await page.getByRole('button', { name: 'Tentar novamente' }).click();
    await page.getByRole('button', { name: `Ver a decisão sobre ${ITEM.nome}` }).click();
    const drawer = page.getByRole('dialog', { name: 'Detalhe da decisão' });
    const tentar = drawer.getByRole('button', { name: 'Tentar novamente' });

    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(drawer.getByText('Histórico do item')).toBeVisible();
    await expect(drawer.getByRole('region', { name: 'Dados da decisão' })).toBeFocused();
  });
});
