import { expect, test, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * E2E funcional da tela de Locais de oferta: listagem, estado vazio, recusa de carga com
 * "Tentar novamente" e cadastro. As escritas com foco e envio pendente estão em
 * `locais-oferta.escritas.flow.spec.ts`.
 *
 * Convenção do repo: runtime-config e API mockados por `page.route`; autenticação real
 * (Keycloak) via projeto `fluxo-chromium`.
 */

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const LOCAL = {
  id: '01960000-0000-7000-0000-0000000000d1',
  tipo: 'poloEad',
  codigoEmec: '999',
  campusResponsavelId: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

async function responder(route: Route, status: number, corpo?: unknown): Promise<void> {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
    return;
  }
  await route.fulfill({
    status,
    contentType: status >= 400 ? 'application/problem+json' : 'application/json',
    headers: CORS_HEADERS,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
}

async function mockLista(page: Page, respostas: readonly { status: number; corpo?: unknown }[]) {
  let consultas = 0;
  await page.route(/\/api\/configuracao\/campi(\?.*)?$/, (route) => responder(route, 200, []));
  await page.route(/\/api\/configuracao\/locais-oferta(\?.*)?$/, async (route) => {
    const { status, corpo } = respostas[Math.min(consultas, respostas.length - 1)];
    consultas += 1;
    await responder(route, status, corpo);
  });
}

test.describe('Locais de oferta', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('lista o tipo, a cidade e o código e-MEC do local', async ({ page }) => {
    await mockLista(page, [{ status: 200, corpo: [LOCAL] }]);
    await page.goto('/locais-oferta');
    const linha = page.getByRole('row', { name: /Polo EAD/ });
    await expect(linha).toContainText('Marabá — PA');
    await expect(linha).toContainText('999');
  });

  test('sem locais, oferece o cadastro no estado vazio', async ({ page }) => {
    await mockLista(page, [{ status: 200, corpo: [] }]);
    await page.goto('/locais-oferta');
    await expect(page.getByText('Nenhum local de oferta cadastrado')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Novo local de oferta' }).last()).toBeEnabled();
  });

  test('com a carga recusada, "Tentar novamente" recarrega e leva o foco ao título da lista', async ({
    page,
  }) => {
    await mockLista(page, [
      {
        status: 400,
        corpo: { type: 'about:blank', title: 'Falha ao carregar', status: 400, code: 'x' },
      },
      { status: 200, corpo: [LOCAL] },
    ]);
    await page.goto('/locais-oferta');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await expect(page.getByText('Falha ao carregar')).toBeVisible();
    await tentar.focus();
    await tentar.click();
    await expect(page.getByRole('row', { name: /Polo EAD/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Locais de oferta', level: 2 })).toBeFocused();
  });

  test('abre o formulário de cadastro com o tipo obrigatório e a cidade pedida ao salvar', async ({
    page,
  }) => {
    await mockLista(page, [{ status: 200, corpo: [] }]);
    await page.goto('/locais-oferta');
    await page.getByRole('button', { name: 'Novo local de oferta' }).first().click();
    const drawer = page.getByRole('dialog', { name: 'Formulário de local de oferta' });
    await expect(drawer.locator('select[formcontrolname="tipo"]')).toHaveAttribute(
      'aria-required',
      'true',
    );
    await drawer.getByRole('button', { name: 'Criar local' }).click();
    await expect(drawer.getByText('Campo obrigatório.')).toBeVisible();
    await expect(drawer.getByText(/Selecione a cidade do endereço/)).toBeVisible();
  });
});
