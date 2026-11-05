import { expect, test, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const MODALIDADE = {
  id: '01960000-0000-7000-0000-0000000000a1',
  codigo: 'AC',
  legalFixa: false,
  descricao: 'Ampla concorrência',
  naturezaLegal: 'AMPLA',
  composicaoVagas: 'RESIDUAL_DO_VO',
  composicaoOrigem: null,
  regraRemanejamento: null,
  remanejamentoDestino: null,
  remanejamentoPar: null,
  remanejamentoFallback: null,
  regraDeAplicabilidade: [],
  acaoQuandoIndeferido: null,
  baseLegal: null,
  criadoEm: '2026-07-03T12:00:00Z',
};

async function responder(route: Route, status: number, corpo?: unknown): Promise<void> {
  await route.fulfill({
    status,
    headers: CORS_HEADERS,
    ...(corpo === undefined
      ? {}
      : {
          contentType: status === 422 ? 'application/problem+json' : 'application/json',
          body: JSON.stringify(corpo),
        }),
  });
}

async function mockApi(page: Page, metodo: string, status: number, corpo?: unknown) {
  let liberar: () => void = () => undefined;
  const retida = new Promise<void>((resolve) => (liberar = resolve));
  const envios: { metodo: string; corpo: unknown }[] = [];
  await page.route(/\/api\/configuracao\/fatos-candidato(\?.*)?$/, (r) => responder(r, 200, []));
  await page.route(/\/api\/configuracao\/modalidades\/[^/?]+$/, (r) =>
    responder(r, 200, MODALIDADE),
  );
  await page.route(/\/api\/configuracao\/modalidades(\?.*)?$/, (r) =>
    responder(r, 200, [MODALIDADE]),
  );
  await page.route(/\/api\/configuracao\/admin\/modalidades(?:\/[^/?]+)?$/, async (r) => {
    const requisicao = r.request();
    if (requisicao.method() === 'OPTIONS') {
      await responder(r, 204);
      return;
    }
    if (requisicao.method() !== metodo) {
      await responder(r, 405);
      return;
    }
    envios.push({ metodo: requisicao.method(), corpo: requisicao.postDataJSON() });
    await retida;
    await responder(r, status, corpo);
  });
  return { liberar, envios };
}

test.describe('Modalidade — escrita', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('criação pendente mantém foco e valores; recusa leva foco ao campo', async ({ page }) => {
    const { liberar } = await mockApi(page, 'POST', 422, {
      type: 'about:blank',
      title: 'Dados inválidos',
      status: 422,
      code: 'uniplus.validacao',
      traceId: 'e2e',
      errors: [
        {
          field: 'Descricao',
          code: 'uniplus.configuracao.modalidade.descricao_invalida',
          message: 'Descrição fora do padrão.',
        },
      ],
    });
    await page.goto('/modalidades/novo');
    await page.locator('[formcontrolname="codigo"]').fill('NOVA');
    const descricao = page.locator('[formcontrolname="descricao"]');
    await descricao.fill('Modalidade nova');
    await page.getByRole('button', { name: 'Criar modalidade' }).click();
    const salvando = page.getByRole('button', { name: 'Salvando...' });
    await expect(descricao).toBeDisabled();
    await expect(descricao).toHaveValue('Modalidade nova');
    await expect(salvando).toBeFocused();
    await expect(salvando).toHaveAttribute('aria-disabled', 'true');
    await expect(salvando).toHaveAttribute('aria-busy', 'true');
    liberar();
    await expect(descricao).toBeEnabled();
    await expect(descricao).toBeFocused();
    await expect(descricao).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Descrição fora do padrão.')).toBeVisible();
  });

  test('criação impede reenvio por clique, Enter e Espaço', async ({ page }) => {
    const { liberar, envios } = await mockApi(page, 'POST', 201, 'novo-id');
    await page.goto('/modalidades/novo');
    await page.locator('[formcontrolname="codigo"]').fill('NOVA');
    await page.getByRole('button', { name: 'Criar modalidade' }).click();
    const salvando = page.getByRole('button', { name: 'Salvando...' });
    await expect(salvando).toBeFocused();
    await expect(salvando).toHaveCSS('cursor', 'not-allowed');
    await salvando.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(envios).toHaveLength(1);
    liberar();
    await expect(page).toHaveURL(/\/modalidades$/);
    expect(envios).toHaveLength(1);
  });

  test('criação pendente mantém Cancelar e Voltar à lista focáveis, sem sair da página', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, 'POST', 201, 'novo-id');
    await page.goto('/modalidades/novo');
    await page.locator('[formcontrolname="codigo"]').fill('NOVA');
    await page.getByRole('button', { name: 'Criar modalidade' }).click();
    await expect(page.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    for (const nome of ['Cancelar', 'Voltar à lista']) {
      const link = page.getByRole('link', { name: nome });
      await expect(link).toHaveAttribute('aria-disabled', 'true');
      await expect(link).toHaveCSS('cursor', 'not-allowed');
      await link.focus();
      await expect(link).toBeFocused();
      await link.click({ force: true });
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/modalidades\/novo$/);
    }
    expect(envios).toHaveLength(1);
    liberar();
    await expect(page).toHaveURL(/\/modalidades$/);
  });

  test('edição mantém campos e foco durante envio e retorna à lista', async ({ page }) => {
    const { liberar, envios } = await mockApi(page, 'PUT', 204);
    await page.goto(`/modalidades/${MODALIDADE.id}`);
    const codigo = page.locator('[formcontrolname="codigo"]');
    const descricao = page.locator('[formcontrolname="descricao"]');
    await expect(codigo).toBeDisabled();
    await descricao.fill('Descrição atualizada');
    await page.getByRole('button', { name: 'Salvar modalidade' }).click();
    await expect(descricao).toBeDisabled();
    await expect(descricao).toHaveValue('Descrição atualizada');
    await expect(page.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    expect(envios).toHaveLength(1);
    expect(envios[0].corpo).toMatchObject({ descricao: 'Descrição atualizada' });
    liberar();
    await expect(page).toHaveURL(/\/modalidades$/);
  });

  test('remoção pendente bloqueia fechamento e anuncia início e fim', async ({ page }) => {
    const { liberar, envios } = await mockApi(page, 'DELETE', 204);
    await page.goto('/modalidades');
    await page.getByRole('button', { name: 'Remover modalidade AC' }).click();
    const dialog = page.getByRole('dialog', { name: 'Remover modalidade' });
    await dialog.getByRole('button', { name: 'Remover', exact: true }).click();
    await expect(
      dialog.getByRole('status').filter({ hasText: 'Removendo a modalidade AC.' }),
    ).toHaveCount(1);
    await expect(dialog.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    expect(envios).toHaveLength(1);
    liberar();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole('status').filter({ hasText: 'Modalidade AC removida.' }),
    ).toHaveCount(1);
  });
});
