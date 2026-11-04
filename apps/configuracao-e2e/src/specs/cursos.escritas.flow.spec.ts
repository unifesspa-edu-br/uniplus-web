import { expect, test, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * Escrita do formulário de Curso num navegador real: com o envio em curso o formulário é só
 * leitura e não fecha, e o foco vai ao primeiro campo recusado ou volta ao botão que abriu o
 * drawer. API mockada por `page.route`; autenticação real pelo projeto `fluxo-chromium`.
 */

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const CURSO = {
  id: '01960000-0000-7000-0000-0000000000c1',
  codigo: 'ENG-CIV',
  nome: 'Engenharia Civil',
  grau: 'Bacharelado',
  nivelEnsino: 'Graduação',
  grupoAreaEnem: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

async function responder(route: Route, status: number, body: unknown, tipo = 'application/json') {
  await route.fulfill({
    status,
    contentType: tipo,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  });
}

/** A resposta do POST fica retida até `liberar`, para o teste observar o envio em curso. */
async function mockApi(page: Page, resposta: { status: number; corpo: unknown; tipo?: string }) {
  let liberar: () => void = () => undefined;
  const envios = { total: 0 };
  const retida = new Promise<void>((resolve) => (liberar = resolve));
  await page.route(/\/api\/configuracao\/vocabularios\/grupos-area-enem$/, (r) =>
    responder(r, 200, []),
  );
  await page.route(/\/api\/configuracao\/cursos(\?.*)?$/, (r) =>
    r.request().method() === 'OPTIONS'
      ? r.fulfill({ status: 204, headers: CORS_HEADERS })
      : responder(r, 200, [CURSO]),
  );
  await page.route(/\/api\/configuracao\/admin\/cursos$/, async (r) => {
    if (r.request().method() === 'OPTIONS') {
      await r.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    envios.total += 1;
    await retida;
    await responder(r, resposta.status, resposta.corpo, resposta.tipo);
  });
  return { liberar, envios };
}

async function preencher(page: Page): Promise<void> {
  await page.locator('input[formcontrolname="codigo"]').fill('DIR');
  await page.locator('input[formcontrolname="nome"]').fill('Direito');
  await page.locator('input[formcontrolname="grau"]').fill('Bacharelado');
  await page.locator('input[formcontrolname="nivelEnsino"]').fill('Graduação');
}

test.describe('Curso — escrita do formulário', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('o envio deixa o formulário só leitura e o foco segue no botão; a recusa leva o foco ao campo', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, {
      status: 422,
      tipo: 'application/problem+json',
      corpo: {
        type: 'about:blank',
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        traceId: 'e2e',
        errors: [
          {
            field: 'Nome',
            code: 'uniplus.configuracao.curso.nome_invalido',
            message: 'Nome fora do padrão.',
          },
        ],
      },
    });
    await page.goto('/cursos');
    await page.getByRole('button', { name: 'Novo curso' }).first().click();
    const drawer = page.getByRole('dialog', { name: 'Formulário de curso' });
    await preencher(page);

    const salvar = drawer.getByRole('button', { name: 'Criar curso' });
    await salvar.focus();
    await salvar.click();

    const nome = page.locator('input[formcontrolname="nome"]');
    await expect(nome).toBeDisabled();
    await expect(nome).toHaveValue('Direito');
    await expect(drawer.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    await expect(drawer.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeVisible();

    liberar();
    await expect(nome).toBeEnabled();
    await expect(nome).toBeFocused();
    await expect(drawer.getByText('Nome fora do padrão.')).toBeVisible();
  });

  test('após o sucesso o foco volta ao botão que abriu o drawer', async ({ page }) => {
    const { liberar } = await mockApi(page, { status: 201, corpo: 'novo-id' });
    await page.goto('/cursos');
    const acionador = page.getByRole('button', { name: 'Novo curso' }).first();
    await acionador.focus();
    await acionador.click();
    const drawer = page.getByRole('dialog', { name: 'Formulário de curso' });
    await preencher(page);
    await drawer.getByRole('button', { name: 'Criar curso' }).click();

    liberar();
    await expect(drawer).toBeHidden();
    await expect(acionador).toBeFocused();
  });

  test('com o envio em curso, clique, Enter e Espaço no botão não enviam de novo e ele parece indisponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, { status: 201, corpo: 'novo-id' });
    await page.goto('/cursos');
    await page.getByRole('button', { name: 'Novo curso' }).first().click();
    const drawer = page.getByRole('dialog', { name: 'Formulário de curso' });
    await preencher(page);
    const salvar = drawer.getByRole('button', { name: 'Criar curso' });
    await salvar.focus();
    await salvar.click();

    const emCurso = drawer.getByRole('button', { name: 'Salvando...' });
    await expect(emCurso).toHaveAttribute('aria-disabled', 'true');
    await expect(emCurso).toHaveCSS('cursor', 'not-allowed');
    await emCurso.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await page.evaluate(() => new Promise((resolver) => requestAnimationFrame(resolver)));
    expect(envios.total).toBe(1);

    liberar();
    await expect(drawer).toBeHidden();
    expect(envios.total).toBe(1);
  });
});
