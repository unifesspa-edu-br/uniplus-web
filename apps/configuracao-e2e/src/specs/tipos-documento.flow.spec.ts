import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import { WCAG_A_AA_TAGS } from '@uniplus/shared-e2e';

/**
 * E2E funcional do cadastro de Tipo de Documento (issue #392). Convenção do
 * repo: runtime-config e API mockados por `page.route`; autenticação real
 * (Keycloak) via projeto `fluxo-chromium` (auth-setup + storageState).
 *
 * Nomeado `tipos-documento.flow.spec.ts` (não `.e2e.ts`, conforme o mapa de
 * testes da issue) para casar com `testMatch: /.*\.flow\.spec\.ts$/` do
 * `playwright.config.ts` — é o padrão que roda com auth real mockando só a
 * API, espelhando `cursos.flow.spec.ts`/`pesos-enem.flow.spec.ts`.
 */

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

/**
 * Catálogo de categorias servido pelo endpoint `GET
 * /api/configuracao/categorias-documento`. Espelha o seed do backend — as dez
 * categorias na ordem de exibição — porque é dele que a tela deriva as opções do
 * `select`, os chips de filtro e o rótulo da coluna. Mockar só as três usadas
 * pelos casos daria uma tela que não existe em nenhum ambiente.
 */
const categoriasSeed = [
  { codigo: 'IDENTIFICACAO', nome: 'Identificação' },
  { codigo: 'ESCOLARIDADE', nome: 'Escolaridade' },
  { codigo: 'TITULACAO_EXPERIENCIA', nome: 'Titulação e experiência' },
  { codigo: 'RENDA', nome: 'Renda' },
  { codigo: 'RESIDENCIA', nome: 'Residência' },
  { codigo: 'RACA_ETNIA', nome: 'Raça/etnia' },
  { codigo: 'SAUDE', nome: 'Saúde' },
  { codigo: 'DOCUMENTO_PROCESSUAL', nome: 'Documento processual' },
  { codigo: 'PRODUCAO_AVALIATIVA', nome: 'Produção avaliativa' },
  { codigo: 'OUTROS', nome: 'Outros' },
].map((categoria, indice) => ({
  id: `01990000-0000-7000-0000-0000000000${(indice + 1).toString(16).padStart(2, '0')}`,
  codigo: categoria.codigo,
  nome: categoria.nome,
  descricao: null,
  ordem: indice + 1,
  criadoEm: '2026-08-30T12:00:00Z',
}));

const RG_ID = '01960000-0000-7000-0000-0000000000d1';
const LAUDO_ID = '01960000-0000-7000-0000-0000000000d2';

const rgSeed = {
  id: RG_ID,
  codigo: 'RG',
  nome: 'Registro Geral',
  descricao: 'Documento de identificação civil.',
  categoria: 'IDENTIFICACAO',
  formatosAceitos: 'pdf,jpg',
  tamanhoMaximoMb: 10,
  tipoEquivalente: 'CIN',
  criadoEm: '2026-06-10T12:00:00Z',
};

const laudoSeed = {
  id: LAUDO_ID,
  codigo: 'LAUDO_MEDICO',
  nome: 'Laudo médico — PcD',
  descricao: null,
  categoria: 'SAUDE',
  formatosAceitos: null,
  tamanhoMaximoMb: null,
  tipoEquivalente: null,
  criadoEm: '2026-06-11T12:00:00Z',
};

interface Capturado {
  readonly posts: unknown[];
  readonly deletedIds: string[];
}

function novoCapturado(): Capturado {
  return { posts: [], deletedIds: [] };
}

async function mockApi(
  page: Page,
  capturado: Capturado,
  lista: readonly unknown[],
  opcoes: { readonly criarStatus?: number; readonly criarBody?: unknown } = {},
): Promise<void> {
  await page.route(/\/api\/configuracao\/admin\/tipos-documento\/[^/?]+$/, async (route) => {
    if (route.request().method() === 'DELETE') {
      const partes = route.request().url().split('/');
      capturado.deletedIds.push(partes[partes.length - 1] ?? '');
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
  });
  await page.route(/\/api\/configuracao\/admin\/tipos-documento(\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      capturado.posts.push(route.request().postDataJSON());
      const status = opcoes.criarStatus ?? 201;
      await route.fulfill({
        status,
        contentType: status >= 400 ? 'application/problem+json' : 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify(opcoes.criarBody ?? 'novo-tipo-documento-id'),
      });
      return;
    }
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
  });
  await page.route(/\/api\/configuracao\/tipos-documento(\?.*)?$/, (route) =>
    jsonRoute(route, lista),
  );
  await page.route(/\/api\/configuracao\/categorias-documento(\?.*)?$/, (route) =>
    jsonRoute(route, categoriasSeed),
  );
}

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

async function abrirPagina(page: Page): Promise<void> {
  await page.goto('/tipos-documento');
  await expect(page.getByRole('heading', { name: 'Tipo de Documento', level: 1 })).toBeVisible();
}

/**
 * Locator de um chip de categoria pelo rótulo. `ui-filter-chips` sempre
 * inclui o contador como texto visível dentro do próprio botão (ex.: "Saúde
 * 1", "Todas 2") — o nome acessível nunca é só o rótulo isolado. A regex
 * ancorada no início casa o rótulo seguido do contador sem colidir com
 * outros botões da página que contenham o mesmo texto.
 */
function chipLocator(page: Page, rotulo: string) {
  const escapado = rotulo.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return page.getByRole('button', { name: new RegExp(`^${escapado}\\b`, 'u') });
}

test.describe('Tipo de Documento — CRUD (#392)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('CA-01: fluxo completo — criar, listar, filtrar por categoria e inativar', async ({
    page,
  }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [rgSeed, laudoSeed]);
    await abrirPagina(page);

    await expect(page.getByText('RG')).toBeVisible();
    await expect(page.getByText('Laudo médico — PcD')).toBeVisible();

    // Filtro por categoria (chip "Saúde 1" — ui-filter-chips inclui o contador no nome acessível)
    await chipLocator(page, 'Saúde').click();
    await expect(page.locator('table tbody tr')).toHaveCount(1);
    await expect(page.getByText('Laudo médico — PcD')).toBeVisible();
    await expect(chipLocator(page, 'Saúde')).toHaveAttribute('aria-pressed', 'true');

    // Volta para "Todas 2"
    await chipLocator(page, 'Todas').click();
    await expect(page.locator('table tbody tr')).toHaveCount(2);

    // Criar
    await page.getByRole('button', { name: 'Novo tipo' }).first().click();
    await page.locator('[formControlName="codigo"]').fill('DECL_LIDERANCA');
    await page.locator('[formControlName="nome"]').fill('Declaração de liderança');
    await page.locator('[formControlName="categoria"]').selectOption('OUTROS');
    await page.getByRole('button', { name: 'Criar tipo de documento' }).click();

    await expect.poll(() => capturado.posts.length).toBe(1);
    expect(capturado.posts[0]).toMatchObject({ codigo: 'DECL_LIDERANCA', categoria: 'OUTROS' });

    // Inativar
    await page.getByRole('button', { name: 'Inativar' }).first().click();
    const dialog = page.locator('dialog.uni-dialog');
    await expect(dialog.getByText('RN08')).toBeVisible();
    await dialog.getByRole('button', { name: 'Inativar' }).click();

    await expect.poll(() => capturado.deletedIds.length).toBe(1);
  });

  test('CA-05: tipo equivalente igual ao código é rejeitado sem chamar o backend', async ({
    page,
  }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, []);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Novo tipo' }).first().click();
    await page.locator('[formControlName="codigo"]').fill('RG');
    await page.locator('[formControlName="tipoEquivalente"]').fill('RG');
    await page.locator('[formControlName="tipoEquivalente"]').blur();

    await expect(
      page.getByText('O tipo equivalente não pode ser igual ao próprio código.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Criar tipo de documento' })).toBeDisabled();
    expect(capturado.posts).toHaveLength(0);
  });

  test('CA-08: modal de inativação não exibe bloqueio por referência de outro módulo', async ({
    page,
  }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [rgSeed]);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Inativar' }).first().click();
    const dialog = page.locator('dialog.uni-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/bloque/i)).toHaveCount(0);
  });
});

// Bloco `validacao`: rejeição de código duplicado — erro inline sem submit bem-sucedido.
test.describe('Tipo de Documento — validação (#392)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('CA-03: código duplicado é rejeitado com erro inline sem fechar o drawer', async ({
    page,
  }) => {
    await mockApi(page, novoCapturado(), [], {
      criarStatus: 409,
      criarBody: {
        type: 'https://uniplus.dev/erros/uniplus.configuracao.tipo_documento.codigo_ja_existe',
        title: 'Já existe um tipo de documento ativo com este código',
        status: 409,
        code: 'uniplus.configuracao.tipo_documento.codigo_ja_existe',
      },
    });
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Novo tipo' }).first().click();
    await page.locator('[formControlName="codigo"]').fill('RG');
    await page.locator('[formControlName="nome"]').fill('Registro Geral (dup)');
    await page.locator('[formControlName="categoria"]').selectOption('IDENTIFICACAO');
    await page.getByRole('button', { name: 'Criar tipo de documento' }).click();

    await expect(page.getByText('Já existe um tipo de documento ativo com este código')).toBeVisible();
    await expect(page.locator('#cfg-tipo-documento-form')).toBeVisible();
  });

  test('CA-06: tamanho máximo zero ou negativo bloqueia o submit', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, []);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Novo tipo' }).first().click();
    await page.locator('[formControlName="codigo"]').fill('DECL');
    await page.locator('[formControlName="nome"]').fill('Declaração');
    await page.locator('[formControlName="categoria"]').selectOption('OUTROS');
    await page.locator('[formControlName="tamanhoMaximoMb"]').fill('0');
    await page.locator('[formControlName="tamanhoMaximoMb"]').blur();
    await page.getByRole('button', { name: 'Criar tipo de documento' }).click();

    expect(capturado.posts).toHaveLength(0);
  });
});

// Bloco `axe`: acessibilidade WCAG 2.1 AA (sem violações serious/critical) na
// lista, no drawer aberto e no modal aberto.
test.describe('Tipo de Documento — acessibilidade axe-core (#392)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  async function violacoesGraves(page: Page): Promise<unknown[]> {
    const resultado = await new AxeBuilder({ page }).withTags([...WCAG_A_AA_TAGS]).analyze();
    return resultado.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  }

  test('lista não tem violações serious/critical', async ({ page }) => {
    await mockApi(page, novoCapturado(), [rgSeed, laudoSeed]);
    await abrirPagina(page);
    const graves = await violacoesGraves(page);
    expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
  });

  test('drawer aberto não tem violações serious/critical', async ({ page }) => {
    await mockApi(page, novoCapturado(), []);
    await abrirPagina(page);
    await page.getByRole('button', { name: 'Novo tipo' }).first().click();
    await expect(page.locator('dialog.uni-drawer')).toBeVisible();
    const graves = await violacoesGraves(page);
    expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
  });

  test('modal de inativação aberto não tem violações serious/critical', async ({ page }) => {
    await mockApi(page, novoCapturado(), [rgSeed]);
    await abrirPagina(page);
    await page.getByRole('button', { name: 'Inativar' }).first().click();
    await expect(page.locator('dialog.uni-dialog')).toBeVisible();
    const graves = await violacoesGraves(page);
    expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
  });
});

// Bloco `axe` escopado: audita só o <ui-filter-bar>, isolado do resto da
// página, respondendo ao CA-06 da issue #513 (ui-filter-bar #500).
test.describe('ui-filter-bar — auditoria isolada axe-core (CA-06 da issue #513)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('não tem violações serious/critical isoladamente', async ({ page }) => {
    await mockApi(page, novoCapturado(), [rgSeed, laudoSeed]);
    await abrirPagina(page);

    const resultado = await new AxeBuilder({ page })
      .include('.filter-bar')
      .withTags([...WCAG_A_AA_TAGS])
      .analyze();
    const graves = resultado.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );

    expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
  });
});

// Bloco `keyboard`: navegação por teclado sem mouse (e-MAG 3.1).
test.describe('Tipo de Documento — navegação por teclado (#392)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('abre o drawer, preenche e salva sem usar o mouse', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, []);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Novo tipo' }).first().focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('dialog.uni-drawer')).toBeVisible();

    await page.locator('[formControlName="codigo"]').fill('DECL_TECLADO');
    await page.locator('[formControlName="nome"]').fill('Declaração via teclado');
    await page.locator('[formControlName="categoria"]').selectOption('OUTROS');

    await page.getByRole('button', { name: 'Criar tipo de documento' }).focus();
    await page.keyboard.press('Enter');

    await expect.poll(() => capturado.posts.length).toBe(1);
  });
});

// Bloco `responsive`: lista e drawer em 375 px (mobile).
test.describe('Tipo de Documento — responsividade 375px (#392)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('lista e drawer permanecem sem overflow horizontal em 375px', async ({ page }) => {
    await mockApi(page, novoCapturado(), [rgSeed, laudoSeed]);
    await abrirPagina(page);

    const semOverflowLista = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(semOverflowLista.scrollWidth).toBeLessThanOrEqual(semOverflowLista.clientWidth);

    await page.getByRole('button', { name: 'Novo tipo' }).first().click();
    await expect(page.locator('dialog.uni-drawer')).toBeVisible();

    const semOverflowDrawer = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(semOverflowDrawer.scrollWidth).toBeLessThanOrEqual(semOverflowDrawer.clientWidth);
  });
});

// Bloco `a11y-focus`: drawer fecha com Esc e o foco retorna ao botão gatilho.
test.describe('Tipo de Documento — foco e Esc (#392)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('drawer fecha com Esc e o foco retorna ao botão "Novo tipo"', async ({ page }) => {
    await mockApi(page, novoCapturado(), []);
    await abrirPagina(page);

    const gatilho = page.getByRole('button', { name: 'Novo tipo' }).first();
    await gatilho.click();
    await expect(page.locator('dialog.uni-drawer')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('dialog.uni-drawer')).toBeHidden();
    await expect(gatilho).toBeFocused();
  });
});
