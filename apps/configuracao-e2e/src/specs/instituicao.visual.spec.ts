import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

type VisualTheme = 'light' | 'dark' | 'contrast';
type VisualViewport = 'mobile' | 'desktop';

const REITORIA_ID = '01960000-0000-7000-0000-000000000001';
const INSTITUICAO_ID = '01960000-0000-7000-0000-0000000000a1';

const REITORIAS = [
  {
    id: REITORIA_ID,
    nome: 'Reitoria',
    alias: null,
    slug: 'reitoria',
    sigla: 'REITORIA',
    codigo: 'REITORIA',
    unidadeSuperiorId: null,
    tipo: 'Reitoria',
    unidadeAcademica: false,
    vigenciaInicio: '2026-01-01',
    vigenciaFim: null,
    origem: 'CriadoNoUniPlus',
    criadoEm: '2026-06-10T12:00:00Z',
  },
] as const;

const INSTITUICAO = {
  id: INSTITUICAO_ID,
  codigoEmec: '3990',
  nome: 'Universidade Federal do Sul e Sudeste do Pará',
  sigla: 'Unifesspa',
  organizacaoAcademica: 'Universidade',
  categoriaAdministrativa: 'Pública Federal',
  cnpj: null,
  mantenedora: null,
  codigoMantenedoraEmec: null,
  situacao: null,
  atoCredenciamento: null,
  atoRecredenciamento: null,
  conceitoInstitucional: null,
  igc: null,
  website: null,
  cidade: null,
  endereco: null,
  unidadeRaizId: REITORIA_ID,
  criadoEm: '2026-06-10T12:00:00Z',
} as const;

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

test.describe('Instituição — cobertura visual DS', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const theme = metadataTheme(testInfo);
    await mockConfiguracaoRuntimeConfig(page);
    await page.addInitScript((dsTheme: VisualTheme) => {
      window.localStorage.setItem(
        'uniplus.a11y',
        JSON.stringify({
          theme: dsTheme === 'contrast' ? 'auto' : dsTheme,
          contrast: dsTheme === 'contrast',
          fontMode: 'default',
        }),
      );
    }, theme);

    await mockReitoriasApi(page);
  });

  test('modo leitura — ficha, banner singleton, breadcrumb e tema aderentes ao DS', async ({
    page,
  }, testInfo) => {
    const theme = metadataTheme(testInfo);
    const viewport = metadataViewport(testInfo);

    await mockInstituicaoApi(page, { existe: true });
    await page.goto('/instituicao');

    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.getByRole('heading', { name: 'Instituição', level: 1 })).toBeVisible();

    // Banner singleton sempre visível.
    await expect(page.getByText('Registro único')).toBeVisible();
    await expect(
      page.getByText('Cada instância da plataforma atende uma única instituição'),
    ).toBeVisible();

    // Breadcrumb reflete a página ativa (dinâmico por rota).
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(breadcrumb.getByText('Instituição', { exact: true })).toBeVisible();

    // Ficha de leitura: 7 seções.
    const ficha = page.locator('.cfg-instituicao__ficha');
    await expect(ficha).toBeVisible();
    await expect(ficha.locator('.form-section__title')).toHaveCount(7);
    await expect(ficha.getByText('REITORIA — Reitoria')).toBeVisible();
    // Botão de criação não aparece quando há Instituição viva.
    await expect(page.getByRole('button', { name: 'Cadastrar instituição' })).toHaveCount(0);

    await assertNoHorizontalOverflow(page);
    await assertSidebarInstituicaoAtiva(page, viewport);

    await attachScreenshot(page, testInfo, 'instituicao-leitura');
  });

  test('modo edição — drawer preserva footer, rolagem única e ação de remoção', async ({
    page,
  }, testInfo) => {
    await mockInstituicaoApi(page, { existe: true });
    await page.goto('/instituicao');

    await page.getByRole('button', { name: 'Editar' }).click();

    const drawer = page.locator('dialog.uni-drawer').filter({ hasText: 'Editar instituição' });
    await expect(drawer).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/uni-drawer-open/);
    await expect(drawer.getByText('Identificação')).toBeVisible();
    await expect(drawer.getByText('Classificação e-MEC')).toBeVisible();
    await expect(drawer.getByText('Estrutura organizacional')).toBeVisible();
    await expect(drawer.locator('.form-section__title')).toHaveCount(7);

    const footer = drawer.locator('.cfg-form-footer');
    await expect(footer.getByRole('button', { name: 'Remover' })).toBeVisible();
    await expect(footer.getByRole('button', { name: 'Cancelar' })).toBeVisible();
    await expect(footer.getByRole('button', { name: 'Salvar instituição' })).toBeVisible();

    const metrics = await drawer.locator('.uni-drawer__panel').evaluate((panel) => {
      const body = panel.querySelector('.uni-drawer__body') as HTMLElement;
      const form = panel.querySelector('.cfg-form') as HTMLElement;
      const footer = panel.querySelector('.cfg-form-footer') as HTMLElement;
      const footerRect = footer.getBoundingClientRect();
      return {
        bodyOverflowY: getComputedStyle(body).overflowY,
        formOverflowY: getComputedStyle(form).overflowY,
        bodyOverflow: getComputedStyle(document.body).overflow,
        footerInsideViewport: footerRect.bottom <= window.innerHeight + 1,
      };
    });

    expect(metrics.bodyOverflowY).toBe('hidden');
    expect(metrics.formOverflowY).toBe('auto');
    expect(metrics.bodyOverflow).toBe('hidden');
    expect(metrics.footerInsideViewport).toBe(true);

    await attachScreenshot(page, testInfo, 'instituicao-drawer');

    // Fecha sem salvar — não dispara mutação.
    await footer.getByRole('button', { name: 'Cancelar' }).click();
    await expect(drawer).toBeHidden();
    await expect(page.locator('body')).not.toHaveClass(/uni-drawer-open/);
  });

  test('modo criação — empty-state e cadastro pelo drawer', async ({ page }, testInfo) => {
    await mockInstituicaoApi(page, { existe: false });
    await page.goto('/instituicao');

    await expect(page.getByRole('heading', { name: 'Nenhuma instituição cadastrada' })).toBeVisible();
    await expect(page.getByText('Registro único')).toBeVisible();
    await expect(page.locator('.cfg-instituicao__ficha')).toHaveCount(0);

    await page.getByRole('button', { name: 'Cadastrar instituição' }).first().click();

    const drawer = page.locator('dialog.uni-drawer').filter({ hasText: 'Cadastrar instituição' });
    await expect(drawer).toBeVisible();
    // Em criação não há ação de remoção.
    await expect(drawer.getByRole('button', { name: 'Remover' })).toHaveCount(0);

    await drawer.getByLabel('Nome oficial').fill(INSTITUICAO.nome);
    await drawer.getByLabel('Sigla').fill(INSTITUICAO.sigla);
    await drawer.getByLabel('Código e-MEC').fill(INSTITUICAO.codigoEmec);
    await drawer.getByLabel('Organização acadêmica').fill(INSTITUICAO.organizacaoAcademica);
    await drawer.getByLabel('Categoria administrativa').fill(INSTITUICAO.categoriaAdministrativa);

    const salvar = drawer.locator('.cfg-form-footer').getByRole('button', {
      name: 'Salvar instituição',
    });
    await expect(salvar).toBeEnabled();
    await salvar.click();

    // Pós-criação o GET passa a devolver 200 → a ficha aparece.
    await expect(drawer).toBeHidden();
    await expect(page.locator('.cfg-instituicao__ficha')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: INSTITUICAO.nome, level: 2 }),
    ).toBeVisible();

    await attachScreenshot(page, testInfo, 'instituicao-criacao');
  });
});

async function mockReitoriasApi(page: Page): Promise<void> {
  await page.route(/\/api\/unidades(\?.*)?$/, async (route, request) => {
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    if (request.method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify(REITORIAS),
    });
  });
}

async function mockInstituicaoApi(page: Page, options: { existe: boolean }): Promise<void> {
  let existe = options.existe;

  // GET /api/instituicao (singleton): 200 quando existe, 404 quando não.
  await page.route(/\/api\/instituicao$/, async (route, request) => {
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    if (request.method() !== 'GET') {
      await route.continue();
      return;
    }
    if (existe) {
      await route.fulfill({
        status: 200,
        headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
        body: JSON.stringify(INSTITUICAO),
      });
    } else {
      await route.fulfill({ status: 404, headers: CORS_HEADERS });
    }
  });

  // POST /api/admin/instituicao: cria e liga o flag para a ficha aparecer.
  await page.route(/\/api\/admin\/instituicao$/, async (route, request) => {
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    if (request.method() !== 'POST') {
      await route.continue();
      return;
    }
    existe = true;
    await route.fulfill({
      status: 201,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify(INSTITUICAO_ID),
    });
  });
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
}

async function assertSidebarInstituicaoAtiva(page: Page, viewport: VisualViewport): Promise<void> {
  const sidebar = page.locator('#cfg-admin-sidebar');
  if (viewport === 'mobile') {
    await page.getByRole('button', { name: 'Abrir menu lateral' }).click();
    await expect(sidebar).toBeVisible();
  }
  await expect(sidebar.getByRole('link', { name: 'Instituição' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  if (viewport === 'mobile') {
    await sidebar.getByRole('button', { name: 'Fechar menu lateral' }).click();
    await expect(sidebar).toBeHidden();
  }
}

async function attachScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: 'instituicao-leitura' | 'instituicao-drawer' | 'instituicao-criacao',
): Promise<void> {
  await testInfo.attach(`${testInfo.project.name}-${name}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}

function metadataTheme(testInfo: TestInfo): VisualTheme {
  const theme = testInfo.project.metadata['theme'];
  return theme === 'dark' || theme === 'contrast' ? theme : 'light';
}

function metadataViewport(testInfo: TestInfo): VisualViewport {
  return testInfo.project.metadata['viewport'] === 'mobile' ? 'mobile' : 'desktop';
}
