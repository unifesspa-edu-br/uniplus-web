import { expect, test, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import { runAxeWcagAA } from '@uniplus/shared-e2e';

/**
 * E2E funcional do cadastro de Precedência de fase (issue #497). Convenção do
 * repo: runtime-config e API mockados por `page.route`; autenticação real
 * (Keycloak) via projeto `fluxo-chromium` (auth-setup + storageState).
 */

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const ARESTA_ID = '01960000-0000-7000-0000-0000000000a1';

const arestaSeed = {
  id: ARESTA_ID,
  antecessoraCodigo: 'INSCRICAO',
  sucessoraCodigo: 'HOMOLOGACAO',
  permiteSobreposicao: false,
  criadoEm: '2026-07-15T12:00:00Z',
};

const fasesSeed = [
  {
    id: 'fase-inscricao',
    codigo: 'INSCRICAO',
    nome: 'Inscrição',
    descricao: null,
    donoTipico: 'CEPS',
    agrupaEtapas: false,
    permiteComplementacao: false,
    baseLegal: null,
    criadoEm: '2026-06-10T12:00:00Z',
  },
  {
    id: 'fase-homologacao',
    codigo: 'HOMOLOGACAO',
    nome: 'Homologação',
    descricao: null,
    donoTipico: 'CEPS',
    agrupaEtapas: false,
    permiteComplementacao: true,
    baseLegal: null,
    criadoEm: '2026-06-10T12:00:00Z',
  },
];

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
  readonly postKeys: string[];
  readonly puts: unknown[];
  readonly deletedIds: string[];
}

function novoCapturado(): Capturado {
  return { posts: [], postKeys: [], puts: [], deletedIds: [] };
}

async function mockApi(
  page: Page,
  capturado: Capturado,
  lista: readonly unknown[],
  opcoes: { readonly criarStatus?: number; readonly criarBody?: unknown } = {},
): Promise<void> {
  await page.route(/\/api\/configuracao\/admin\/precedencias-fase\/[^/?]+$/, async (route) => {
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
  await page.route(/\/api\/configuracao\/admin\/precedencias-fase(\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      capturado.posts.push(route.request().postDataJSON());
      capturado.postKeys.push(route.request().headers()['idempotency-key'] ?? '');
      const status = opcoes.criarStatus ?? 201;
      await route.fulfill({
        status,
        contentType: status >= 400 ? 'application/problem+json' : 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify(opcoes.criarBody ?? 'nova-aresta-id'),
      });
      return;
    }
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
  });
  await page.route(/\/api\/configuracao\/precedencias-fase(\?.*)?$/, (route) =>
    jsonRoute(route, lista),
  );
  // A página também lê o cadastro de Fase canônica para rotular as opções.
  await page.route(/\/api\/configuracao\/fases-canonicas(\?.*)?$/, (route) =>
    jsonRoute(route, fasesSeed),
  );
}

async function abrirPagina(page: Page): Promise<void> {
  await page.goto('/precedencias-fase');
  await expect(page.getByRole('heading', { name: 'Precedência de Fase', level: 1 })).toBeVisible();
}

test.describe('Precedência de fase — CRUD (#497)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('CA-01: lista as arestas vivas com antecessora e sucessora', async ({ page }) => {
    await mockApi(page, novoCapturado(), [arestaSeed]);
    await abrirPagina(page);

    // Escopado à tabela: os códigos também aparecem como <option> nos selects
    // do drawer, presentes no DOM desde a carga (modo inicia em 'criar').
    const linha = page.locator('tr[data-aresta="INSCRICAO>HOMOLOGACAO"]');
    await expect(linha).toBeVisible();
    await expect(linha.getByText('INSCRICAO', { exact: true })).toBeVisible();
    await expect(linha.getByText('HOMOLOGACAO', { exact: true })).toBeVisible();
  });

  test('CA-02: cria uma aresta com fases distintas', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, []);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Nova aresta' }).first().click();
    await page.locator('#cfg-precedencia-antecessora').selectOption('AVALIACAO');
    await page.locator('#cfg-precedencia-sucessora').selectOption('CLASSIFICACAO');
    await page.getByRole('button', { name: 'Criar aresta' }).click();

    await expect.poll(() => capturado.posts.length).toBe(1);
    // `toEqual` e não `toMatchObject`: o contrato de criação tem exatamente
    // estes três campos, e a asserção precisa falhar se um controle novo
    // vazar para o payload.
    expect(capturado.posts[0]).toEqual({
      antecessoraCodigo: 'AVALIACAO',
      sucessoraCodigo: 'CLASSIFICACAO',
      permiteSobreposicao: false,
    });
  });

  test('abrir edição e depois criação não vaza id nem valores da aresta editada', async ({
    page,
  }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [arestaSeed]);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Editar' }).first().click();
    await expect(page.locator('#cfg-precedencia-antecessora')).toHaveValue('INSCRICAO');
    await page.getByRole('button', { name: 'Cancelar' }).click();

    await page.getByRole('button', { name: 'Nova aresta' }).first().click();
    await page.locator('#cfg-precedencia-antecessora').selectOption('AVALIACAO');
    await page.locator('#cfg-precedencia-sucessora').selectOption('CLASSIFICACAO');
    await page.getByRole('button', { name: 'Criar aresta' }).click();

    await expect.poll(() => capturado.posts.length).toBe(1);
    expect(capturado.posts[0]).toEqual({
      antecessoraCodigo: 'AVALIACAO',
      sucessoraCodigo: 'CLASSIFICACAO',
      permiteSobreposicao: false,
    });
    expect(capturado.puts).toHaveLength(0);
  });

  test('CA-03: self-loop é barrado no client e não chega ao backend', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, []);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Nova aresta' }).first().click();
    await page.locator('#cfg-precedencia-antecessora').selectOption('AVALIACAO');
    await page.locator('#cfg-precedencia-sucessora').selectOption('AVALIACAO');
    await page.getByRole('button', { name: 'Criar aresta' }).click();

    await expect(
      page.getByText('A fase sucessora não pode ser igual à antecessora.'),
    ).toBeVisible();
    expect(capturado.posts).toHaveLength(0);
    await expect(page.locator('#cfg-precedencia-fase-form')).toBeVisible();
  });

  test('CA-04: aresta duplicada (422) aparece no campo sucessora sem fechar o drawer', async ({
    page,
  }) => {
    await mockApi(page, novoCapturado(), [], {
      criarStatus: 422,
      criarBody: {
        type: 'https://uniplus.dev/erros/uniplus.configuracao.precedencia_fase.aresta_duplicada',
        title: 'Já existe uma aresta de precedência viva com este par de fases',
        status: 422,
        code: 'uniplus.configuracao.precedencia_fase.aresta_duplicada',
      },
    });
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Nova aresta' }).first().click();
    await page.locator('#cfg-precedencia-antecessora').selectOption('INSCRICAO');
    await page.locator('#cfg-precedencia-sucessora').selectOption('HOMOLOGACAO');
    await page.getByRole('button', { name: 'Criar aresta' }).click();

    const campoSucessora = page.locator('#cfg-precedencia-sucessora').locator('..');
    await expect(
      campoSucessora.getByText('Já existe uma aresta de precedência viva com este par de fases'),
    ).toBeVisible();
    await expect(page.locator('#cfg-precedencia-fase-form')).toBeVisible();
  });

  test('CA-05: aresta que fecharia um ciclo (422) vira banner geral do drawer', async ({ page }) => {
    await mockApi(page, novoCapturado(), [], {
      criarStatus: 422,
      criarBody: {
        type: 'https://uniplus.dev/erros/uniplus.configuracao.precedencia_fase.ciclo_detectado',
        title: 'A aresta fecharia um ciclo no grafo de precedências',
        status: 422,
        code: 'uniplus.configuracao.precedencia_fase.ciclo_detectado',
      },
    });
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Nova aresta' }).first().click();
    await page.locator('#cfg-precedencia-antecessora').selectOption('RESULTADO_FINAL');
    await page.locator('#cfg-precedencia-sucessora').selectOption('INSCRICAO');
    await page.getByRole('button', { name: 'Criar aresta' }).click();

    await expect(page.getByText('Não foi possível salvar')).toBeVisible();
    await expect(
      page.getByText('A aresta fecharia um ciclo no grafo de precedências'),
    ).toBeVisible();
    await expect(page.locator('#cfg-precedencia-fase-form')).toBeVisible();
  });

  test('CA-06: na edição o par é somente leitura e o PUT leva só a sobreposição', async ({
    page,
  }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [arestaSeed]);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Editar' }).first().click();
    const antecessora = page.locator('#cfg-precedencia-antecessora');
    const sucessora = page.locator('#cfg-precedencia-sucessora');
    await expect(antecessora).toHaveAttribute('readonly', '');
    await expect(antecessora).toHaveValue('INSCRICAO');
    await expect(sucessora).toHaveAttribute('readonly', '');
    await expect(sucessora).toHaveValue('HOMOLOGACAO');

    await page.locator('#cfg-precedencia-sobreposicao').selectOption({ label: 'Sim' });
    await page.getByRole('button', { name: 'Salvar aresta' }).click();

    await expect.poll(() => capturado.puts.length).toBe(1);
    expect(capturado.puts[0]).toEqual({ id: ARESTA_ID, permiteSobreposicao: true });
  });

  test('CA-07: remove uma aresta após confirmação no modal', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [arestaSeed]);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Remover' }).first().click();
    const dialog = page.locator('dialog.uni-dialog');
    await dialog.getByRole('button', { name: 'Remover' }).click();

    await expect.poll(() => capturado.deletedIds.length).toBe(1);
    expect(capturado.deletedIds[0]).toBe(ARESTA_ID);
  });

  test('corrigir o formulário após 422 reenvia com Idempotency-Key nova', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [], {
      criarStatus: 422,
      criarBody: {
        type: 'https://uniplus.dev/erros/uniplus.configuracao.precedencia_fase.aresta_duplicada',
        title: 'Já existe uma aresta de precedência viva com este par de fases',
        status: 422,
        code: 'uniplus.configuracao.precedencia_fase.aresta_duplicada',
      },
    });
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Nova aresta' }).first().click();
    await page.locator('#cfg-precedencia-antecessora').selectOption('INSCRICAO');
    await page.locator('#cfg-precedencia-sucessora').selectOption('HOMOLOGACAO');
    await page.getByRole('button', { name: 'Criar aresta' }).click();
    await expect.poll(() => capturado.posts.length).toBe(1);

    // Correção e reenvio: o backend guarda a resposta 422 associada à chave, e
    // reusá-la devolveria `body_mismatch` em vez de processar o novo comando.
    await page.locator('#cfg-precedencia-sucessora').selectOption('AVALIACAO');
    await page.getByRole('button', { name: 'Criar aresta' }).click();

    await expect.poll(() => capturado.posts.length).toBe(2);
    expect(capturado.postKeys[0]).toBeTruthy();
    expect(capturado.postKeys[1]).not.toBe(capturado.postKeys[0]);
  });
});

// Bloco `axe`: acessibilidade WCAG 2.1 AA (sem violações serious/critical).
test.describe('Precedência de fase — acessibilidade axe-core (#497)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  async function violacoesGraves(page: Page): Promise<unknown[]> {
    const resultado = await runAxeWcagAA(page);
    return resultado.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  }

  test('lista não tem violações serious/critical', async ({ page }) => {
    await mockApi(page, novoCapturado(), [arestaSeed]);
    await abrirPagina(page);
    const graves = await violacoesGraves(page);
    expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
  });

  test('drawer de criação aberto não tem violações serious/critical', async ({ page }) => {
    await mockApi(page, novoCapturado(), [arestaSeed]);
    await abrirPagina(page);
    await page.getByRole('button', { name: 'Nova aresta' }).first().click();
    await expect(page.locator('#cfg-precedencia-fase-form')).toBeVisible();
    const graves = await violacoesGraves(page);
    expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
  });

  test('drawer com erro de campo não tem violações serious/critical', async ({ page }) => {
    await mockApi(page, novoCapturado(), []);
    await abrirPagina(page);
    await page.getByRole('button', { name: 'Nova aresta' }).first().click();
    await page.locator('#cfg-precedencia-antecessora').selectOption('AVALIACAO');
    await page.locator('#cfg-precedencia-sucessora').selectOption('AVALIACAO');
    await page.getByRole('button', { name: 'Criar aresta' }).click();
    await expect(
      page.getByText('A fase sucessora não pode ser igual à antecessora.'),
    ).toBeVisible();
    const graves = await violacoesGraves(page);
    expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
  });

  test('modal de remoção aberto não tem violações serious/critical', async ({ page }) => {
    await mockApi(page, novoCapturado(), [arestaSeed]);
    await abrirPagina(page);
    await page.getByRole('button', { name: 'Remover' }).first().click();
    await expect(page.locator('dialog.uni-dialog')).toBeVisible();
    const graves = await violacoesGraves(page);
    expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
  });
});
