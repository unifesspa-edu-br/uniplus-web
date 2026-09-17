import { expect, test, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * E2E funcional do cadastro de Tipo de etapa. É aqui que o CEPS declara se uma etapa daquele
 * tipo pode compor a nota final e se pode eliminar candidato — o par que o formulário do edital
 * lê para decidir quais caracteres oferecer.
 *
 * Convenção do repo: runtime-config e API mockados por `page.route`; autenticação real
 * (Keycloak) via projeto `fluxo-chromium`.
 */

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const ANALISE_ID = '01960000-0000-7000-0000-0000000000e1';

const analiseDocumental = {
  id: ANALISE_ID,
  codigo: 'ANALISE_DOCUMENTAL',
  nome: 'Análise Documental',
  descricao: null,
  ativo: true,
  admitePontuacao: false,
  admiteEliminacao: true,
  criadoEm: '2026-08-11T00:00:00Z',
};

async function jsonRoute(route: Route, body: unknown, status = 200): Promise<void> {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
    return;
  }
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  });
}

interface Capturado {
  readonly posts: unknown[];
  readonly puts: unknown[];
  readonly deletedIds: string[];
}

function novoCapturado(): Capturado {
  return { posts: [], puts: [], deletedIds: [] };
}

async function mockApi(
  page: Page,
  capturado: Capturado,
  lista: readonly unknown[],
): Promise<void> {
  await page.route(/\/api\/configuracao\/admin\/tipos-etapa\/[^/?]+$/, async (route) => {
    if (route.request().method() === 'DELETE') {
      const partes = route.request().url().split('/');
      capturado.deletedIds.push(partes[partes.length - 1] ?? '');
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    if (route.request().method() === 'PUT') {
      capturado.puts.push(route.request().postDataJSON());
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
  });
  await page.route(/\/api\/configuracao\/admin\/tipos-etapa(\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      capturado.posts.push(route.request().postDataJSON());
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify('novo-tipo-etapa-id'),
      });
      return;
    }
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
  });
  await page.route(/\/api\/configuracao\/tipos-etapa(\?.*)?$/, (route) => jsonRoute(route, lista));
}

/** A caixa de escolha do formulário, e não o texto explicativo que repete o mesmo rótulo. */
function caixaDeAdmissao(page: Page, rotulo: string) {
  return page.locator('label.checkbox').filter({ hasText: rotulo });
}

async function abrirPagina(page: Page): Promise<void> {
  await page.goto('/tipos-etapa');
  await expect(page.getByRole('heading', { name: 'Tipo de Etapa', level: 1 })).toBeVisible();
}

test.describe('Tipo de etapa — CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  /** A coluna diz o que o tipo admite em prosa: dois booleanos crus não se leem de relance. */
  test('lista os tipos e descreve o que cada um admite', async ({ page }) => {
    await mockApi(page, novoCapturado(), [analiseDocumental]);
    await abrirPagina(page);

    await expect(page.locator('table').getByText('ANALISE_DOCUMENTAL')).toBeVisible();
    await expect(page.locator('table').getByText('Só eliminar')).toBeVisible();
  });

  test('cria tipo declarando que ele não compõe a nota final', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, []);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Novo tipo de etapa' }).first().click();
    await page.locator('[formControlName="codigo"]').fill('ANALISE_SOCIOECONOMICA');
    await page.locator('[formControlName="nome"]').fill('Análise socioeconômica');
    // O clique é no rótulo: o controle real fica invisível sob a caixa do design system. E
    // escopado à caixa, porque o texto explicativo do topo da página diz a mesma coisa.
    await caixaDeAdmissao(page, 'Compor a nota final').click();
    await page.getByRole('button', { name: 'Criar tipo de etapa' }).click();

    await expect.poll(() => capturado.posts.length).toBe(1);
    expect(capturado.posts[0]).toMatchObject({
      codigo: 'ANALISE_SOCIOECONOMICA',
      nome: 'Análise socioeconômica',
      admitePontuacao: false,
      admiteEliminacao: true,
    });
  });

  test('o código é somente leitura na edição, e o que o tipo admite é editável', async ({
    page,
  }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [analiseDocumental]);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Editar' }).first().click();
    const codigoInput = page.locator('[formControlName="codigo"]');
    await expect(codigoInput).toHaveAttribute('readonly', '');
    await expect(codigoInput).toHaveValue('ANALISE_DOCUMENTAL');

    await caixaDeAdmissao(page, 'Compor a nota final').click();
    await page.getByRole('button', { name: 'Salvar tipo de etapa' }).click();

    await expect.poll(() => capturado.puts.length).toBe(1);
    expect(capturado.puts[0]).not.toHaveProperty('codigo');
    expect(capturado.puts[0]).toMatchObject({ admitePontuacao: true, admiteEliminacao: true });
  });

  test('inativa um tipo após confirmação', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [analiseDocumental]);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Inativar' }).first().click();
    const dialog = page.locator('dialog.uni-dialog');
    await dialog.getByRole('button', { name: 'Inativar' }).click();

    await expect.poll(() => capturado.deletedIds).toEqual([ANALISE_ID]);
  });

  /** Interface que transborda na horizontal é defeito: 320px é o piso do projeto. */
  test('não transborda horizontalmente a 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await mockApi(page, novoCapturado(), [analiseDocumental]);
    await abrirPagina(page);

    const transbordo = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(transbordo).toBeLessThanOrEqual(0);
  });
});
