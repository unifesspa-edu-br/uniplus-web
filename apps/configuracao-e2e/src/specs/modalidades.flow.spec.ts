import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import { WCAG_A_AA_TAGS } from '@uniplus/shared-e2e';

/**
 * E2E funcional do cadastro de Modalidade de concorrência (issue #390, Piloto B).
 * Convenção do repo: runtime-config e API mockados por `page.route`; autenticação
 * real (Keycloak) via storageState. Modalidade usa **tela dedicada** (rota própria)
 * em vez de drawer, e `<ui-dialog>` para o bloqueio/confirmação de remoção.
 */

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const AC_ID = '01960000-0000-7000-0000-0000000000a1';
const V_ID = '01960000-0000-7000-0000-0000000000b1';

const acSeed = {
  id: AC_ID,
  codigo: 'AC',
  descricao: 'Ampla concorrência',
  naturezaLegal: 'AMPLA',
  composicaoVagas: 'RESIDUAL_DO_VO',
  composicaoOrigem: null,
  regraRemanejamento: null,
  remanejamentoDestino: null,
  remanejamentoPar: null,
  remanejamentoFallback: null,
  criteriosCumulativos: [],
  acaoQuandoIndeferido: null,
  baseLegal: null,
  criadoEm: '2026-07-03T12:00:00Z',
};

// V retira suas vagas de AC e remaneja para AC — referencia AC (bloqueia a remoção de AC).
const vSeed = {
  ...acSeed,
  id: V_ID,
  codigo: 'V',
  descricao: 'PcD ampla concorrência',
  naturezaLegal: 'SUPLEMENTAR',
  composicaoVagas: 'RETIRA_DE',
  composicaoOrigem: 'AC',
  regraRemanejamento: 'DESTINO_UNICO',
  remanejamentoDestino: 'AC',
  criteriosCumulativos: ['laudo'],
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
  opcoes: { readonly removerStatus?: number; readonly removerBody?: unknown } = {},
): Promise<void> {
  await page.route(/\/api\/configuracao\/admin\/modalidades\/[^/?]+$/, async (route) => {
    if (route.request().method() === 'DELETE') {
      const partes = route.request().url().split('/');
      capturado.deletedIds.push(partes[partes.length - 1] ?? '');
      const status = opcoes.removerStatus ?? 204;
      if (status >= 400) {
        await route.fulfill({
          status,
          contentType: 'application/problem+json',
          headers: CORS_HEADERS,
          body: JSON.stringify(opcoes.removerBody ?? {}),
        });
        return;
      }
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
  await page.route(/\/api\/configuracao\/admin\/modalidades(\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      capturado.posts.push(route.request().postDataJSON());
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify('nova-modalidade-id'),
      });
      return;
    }
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
  });
  // Detalhe por id (obter) — usado na edição.
  await page.route(/\/api\/configuracao\/modalidades\/[^/?]+$/, (route) => {
    const partes = route.request().url().split('/');
    const id = (partes[partes.length - 1] ?? '').replace(/\?.*$/u, '');
    const alvo = lista.find((m) => (m as { id: string }).id === id) ?? lista[0];
    return jsonRoute(route, alvo);
  });
  await page.route(/\/api\/configuracao\/modalidades(\?.*)?$/, (route) => jsonRoute(route, lista));
}

async function abrirLista(page: Page): Promise<void> {
  await page.goto('/modalidades');
  await expect(page.getByRole('heading', { name: 'Modalidade de concorrência', level: 1 })).toBeVisible();
}

test.describe('Modalidade de concorrência — CRUD (#390)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('CA-01: lista modalidades com natureza, status e coluna "Referenciada por"', async ({ page }) => {
    await mockApi(page, novoCapturado(), [acSeed, vSeed]);
    await abrirLista(page);

    await expect(page.locator('tbody tr')).toHaveCount(2);
    const linhaAc = page.locator('tr[data-codigo="AC"]');
    await expect(linhaAc.locator('td').first().locator('code')).toHaveText('AC');
    await expect(linhaAc.locator('.tag--info')).toContainText('Ampla concorrência');
    await expect(linhaAc.locator('.tag--success')).toHaveText('Ativa');
    // A linha de AC mostra V como quem a referencia (mapa reverso).
    await expect(linhaAc.locator('.cfg-ref-chip')).toHaveText('V');
  });

  test('CA-01: chips de natureza filtram a lista', async ({ page }) => {
    await mockApi(page, novoCapturado(), [acSeed, vSeed]);
    await abrirLista(page);

    await page.getByRole('button', { name: /Suplementar/ }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody')).toContainText('PcD ampla concorrência');
  });

  test('CA-02: "Nova modalidade" navega para a tela dedicada com foco no título', async ({ page }) => {
    await mockApi(page, novoCapturado(), [acSeed, vSeed]);
    await abrirLista(page);

    await page.getByRole('link', { name: 'Nova modalidade' }).first().click();
    await expect(page).toHaveURL(/\/modalidades\/novo$/);
    const titulo = page.getByRole('heading', { name: 'Nova modalidade', level: 1 });
    await expect(titulo).toBeVisible();
    await expect(titulo).toBeFocused();

    await page.getByRole('link', { name: 'Voltar à lista' }).click();
    await expect(page).toHaveURL(/\/modalidades$/);
    await expect(page.getByRole('heading', { name: 'Modalidade de concorrência', level: 1 })).toBeVisible();
  });

  test('CA-03: AMPLA oculta remanejamento; COTA_RESERVADA fixa cascata; SUPLEMENTAR oferta destino/cruzado', async ({
    page,
  }) => {
    await mockApi(page, novoCapturado(), [acSeed, vSeed]);
    await page.goto('/modalidades/novo');

    const natureza = page.locator('[formControlName="naturezaLegal"]');

    await natureza.selectOption('AMPLA');
    await expect(page.locator('#cfg-mod-remanejamento')).toBeHidden();

    await natureza.selectOption('COTA_RESERVADA');
    await expect(page.locator('#cfg-mod-remanejamento')).toBeVisible();
    const regra = page.locator('[formControlName="regraRemanejamento"]');
    await expect(regra).toHaveValue('SEGUE_CASCATA');
    // Playwright toBeDisabled é instável em <option>; checa a propriedade DOM diretamente.
    await expect(regra.locator('option[value="DESTINO_UNICO"]')).toHaveJSProperty('disabled', true);

    await natureza.selectOption('SUPLEMENTAR');
    await expect(regra.locator('option[value="SEGUE_CASCATA"]')).toHaveJSProperty('disabled', true);
    await expect(regra.locator('option[value="DESTINO_UNICO"]')).toHaveJSProperty('disabled', false);
    await expect(regra.locator('option[value="CRUZADO"]')).toHaveJSProperty('disabled', false);
  });

  test('CA-04: RETIRA_DE exige Origem; CRUZADO exige Par e Fallback', async ({ page }) => {
    await mockApi(page, novoCapturado(), [acSeed, vSeed]);
    await page.goto('/modalidades/novo');

    await page.locator('[formControlName="composicaoVagas"]').selectOption('RETIRA_DE');
    await expect(page.locator('[formControlName="composicaoOrigem"]')).toBeVisible();

    await page.locator('[formControlName="naturezaLegal"]').selectOption('SUPLEMENTAR');
    await page.locator('[formControlName="regraRemanejamento"]').selectOption('CRUZADO');
    await expect(page.locator('[formControlName="remanejamentoPar"]')).toBeVisible();
    await expect(page.locator('[formControlName="remanejamentoFallback"]')).toBeVisible();
    await expect(page.locator('[formControlName="remanejamentoDestino"]')).toBeHidden();
  });

  test('CA-02 / CA-04: cria modalidade SUPLEMENTAR RETIRA_DE + DESTINO_UNICO', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [acSeed, vSeed]);
    await page.goto('/modalidades/novo');

    await page.locator('[formControlName="codigo"]').fill('LI_PPI');
    await page.locator('[formControlName="descricao"]').fill('Cota PPI independente de renda');
    await page.locator('[formControlName="composicaoVagas"]').selectOption('RETIRA_DE');
    await page.locator('[formControlName="composicaoOrigem"]').selectOption('AC');
    await page.locator('[formControlName="naturezaLegal"]').selectOption('SUPLEMENTAR');
    await page.locator('[formControlName="regraRemanejamento"]').selectOption('DESTINO_UNICO');
    await page.locator('[formControlName="remanejamentoDestino"]').selectOption('AC');
    await page.getByRole('button', { name: 'Criar modalidade' }).click();

    await expect.poll(() => capturado.posts.length).toBe(1);
    expect(capturado.posts[0]).toMatchObject({
      codigo: 'LI_PPI',
      naturezaLegal: 'SUPLEMENTAR',
      composicaoVagas: 'RETIRA_DE',
      composicaoOrigem: 'AC',
      regraRemanejamento: 'DESTINO_UNICO',
      remanejamentoDestino: 'AC',
    });
    await expect(page).toHaveURL(/\/modalidades$/);
  });

  test('CA-05: código é somente leitura na edição', async ({ page }) => {
    await mockApi(page, novoCapturado(), [acSeed, vSeed]);
    await page.goto(`/modalidades/${V_ID}`);

    const codigo = page.locator('[formControlName="codigo"]');
    await expect(codigo).toHaveValue('V');
    await expect(codigo).toBeDisabled();
  });

  test('CA-06: remoção bloqueada quando referenciada por outra viva', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [acSeed, vSeed]);
    await abrirLista(page);

    await page.getByRole('button', { name: 'Inativar modalidade AC' }).click();

    const dialog = page.locator('dialog.uni-dialog');
    await expect(dialog.getByText('Remoção bloqueada')).toBeVisible();
    // V aparece como dependente na lista de referências.
    await expect(dialog.locator('.cfg-refs-lista').getByText('V', { exact: true })).toBeVisible();
    // Não deve haver botão de confirmação de inativação.
    await expect(dialog.getByRole('button', { name: 'Inativar', exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Entendi' }).click();
    expect(capturado.deletedIds).toHaveLength(0);
  });

  test('CA-06: soft-delete quando a modalidade está livre', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [acSeed, vSeed]);
    await abrirLista(page);

    await page.getByRole('button', { name: 'Inativar modalidade V' }).click();

    const dialog = page.locator('dialog.uni-dialog');
    await dialog.getByRole('button', { name: 'Inativar', exact: true }).click();
    await expect.poll(() => capturado.deletedIds.length).toBe(1);
    expect(capturado.deletedIds[0]).toBe(V_ID);
  });
});

// Bloco `axe`: acessibilidade WCAG 2.1 AA (sem violações serious/critical).
test.describe('Modalidade — acessibilidade axe-core (#390)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  async function violacoesGraves(page: Page): Promise<unknown[]> {
    const resultado = await new AxeBuilder({ page }).withTags([...WCAG_A_AA_TAGS]).analyze();
    return resultado.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  }

  test('lista não tem violações serious/critical', async ({ page }) => {
    await mockApi(page, novoCapturado(), [acSeed, vSeed]);
    await abrirLista(page);
    const graves = await violacoesGraves(page);
    expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
  });

  test('tela dedicada não tem violações serious/critical', async ({ page }) => {
    await mockApi(page, novoCapturado(), [acSeed, vSeed]);
    await page.goto('/modalidades/novo');
    await page.locator('[formControlName="naturezaLegal"]').selectOption('SUPLEMENTAR');
    await page.locator('[formControlName="regraRemanejamento"]').selectOption('CRUZADO');
    const graves = await violacoesGraves(page);
    expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
  });

  test('modal de bloqueio aberto não tem violações serious/critical', async ({ page }) => {
    await mockApi(page, novoCapturado(), [acSeed, vSeed]);
    await abrirLista(page);
    await page.getByRole('button', { name: 'Inativar modalidade AC' }).click();
    await expect(page.locator('dialog.uni-dialog')).toBeVisible();
    const graves = await violacoesGraves(page);
    expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
  });
});
