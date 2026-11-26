import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { INSTITUICAO, mockInstituicaoApi, mockReitoriasApi } from '../support/api-da-instituicao';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

type VisualTheme = 'light' | 'dark' | 'contrast';
type VisualViewport = 'mobile' | 'desktop';

const TOLERANCIA = 1;

/** As sete seções do formulário, na ordem em que aparecem no drawer. */
const SECOES_DO_FORMULARIO = [
  'cfg-form-identificacao',
  'cfg-form-classificacao',
  'cfg-form-mantenedora',
  'cfg-form-situacao',
  'cfg-form-indicadores',
  'cfg-form-contato',
  'cfg-form-estrutura',
];

async function caixa(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Elemento sem geometria visível.');
  return { y: box.y, base: box.y + box.height };
}

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

  test('drawer e diálogo fechados não ocupam espaço entre os blocos', async ({ page }) => {
    await mockInstituicaoApi(page, { existe: true });
    await page.goto('/instituicao');
    await expect(page.locator('.cfg-instituicao__ficha')).toBeVisible();
    const pagina = page.locator('.cfg-page');
    const aviso = page.locator('ui-alert').first();
    const painel = page.locator('.panel');
    const gap = await pagina.evaluate((el) => Number.parseFloat(getComputedStyle(el).rowGap));
    const geoAviso = await caixa(aviso);
    const geoPainel = await caixa(painel);
    const geoPagina = await caixa(pagina);
    expect(Math.abs(geoPainel.y - geoAviso.base - gap)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(geoPagina.base - geoPainel.base)).toBeLessThanOrEqual(TOLERANCIA);
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
    // 7 seções do formulário + a legenda do cfg-endereco-form (também
    // .form-section__title) = 8 após a migração ao endereço estruturado (#412).
    await expect(drawer.locator('.form-section__title')).toHaveCount(8);

    const footer = drawer.locator('.form-drawer__footer');
    await expect(footer.getByRole('button', { name: 'Remover' })).toBeVisible();
    await expect(footer.getByRole('button', { name: 'Cancelar' })).toBeVisible();
    await expect(footer.getByRole('button', { name: 'Salvar instituição' })).toBeVisible();

    const metrics = await drawer.locator('.uni-drawer__panel').evaluate((panel) => {
      const body = panel.querySelector('.uni-drawer__body') as HTMLElement;
      const form = panel.querySelector('.form-drawer__form') as HTMLElement;
      const footer = panel.querySelector('.form-drawer__footer') as HTMLElement;
      const footerRect = footer.getBoundingClientRect();
      return {
        bodyOverflowY: getComputedStyle(body).overflowY,
        formOverflowY: getComputedStyle(form).overflowY,
        bodyOverflow: getComputedStyle(document.body).overflow,
        footerInsideViewport: footerRect.bottom <= window.innerHeight + 1,
      };
    });

    expect(metrics.bodyOverflowY).toBe('auto');
    expect(metrics.formOverflowY).toBe('visible');
    expect(metrics.bodyOverflow).toBe('hidden');
    expect(metrics.footerInsideViewport).toBe(true);

    const espacos = await drawer.locator('.form-drawer__campos').evaluate((campos, ids) => {
      const base = Number.parseFloat(getComputedStyle(campos).rowGap);
      const caixas = ids.map((id) => {
        const secao = campos.querySelector(`section[aria-labelledby="${id}"]`);
        if (!secao) throw new Error(`Seção ${id} ausente.`);
        const { top, bottom } = secao.getBoundingClientRect();
        return { top, bottom };
      });
      return {
        base,
        entreSecoes: caixas.slice(1).map((caixa, i) => caixa.top - caixas[i].bottom),
      };
    }, SECOES_DO_FORMULARIO);
    expect(espacos.base).toBeGreaterThan(0);
    for (const espaco of espacos.entreSecoes) {
      expect(Math.abs(espaco - espacos.base)).toBeLessThanOrEqual(TOLERANCIA);
    }

    await attachScreenshot(page, testInfo, 'instituicao-drawer');

    // Fecha sem salvar — não dispara mutação.
    await footer.getByRole('button', { name: 'Cancelar' }).click();
    await expect(drawer).toBeHidden();
    await expect(page.locator('body')).not.toHaveClass(/uni-drawer-open/);
  });

  test('modo criação — empty-state e cadastro pelo drawer', async ({ page }, testInfo) => {
    await mockInstituicaoApi(page, { existe: false });
    await page.goto('/instituicao');

    await expect(
      page.getByRole('heading', { name: 'Nenhuma instituição cadastrada' }),
    ).toBeVisible();
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

    const salvar = drawer.locator('.form-drawer__footer').getByRole('button', {
      name: 'Salvar instituição',
    });
    await expect(salvar).toBeEnabled();
    await salvar.click();

    // Pós-criação o GET passa a devolver 200 → a ficha aparece.
    await expect(drawer).toBeHidden();
    await expect(page.locator('.cfg-instituicao__ficha')).toBeVisible();
    await expect(page.getByRole('heading', { name: INSTITUICAO.nome, level: 2 })).toBeVisible();

    await attachScreenshot(page, testInfo, 'instituicao-criacao');
  });
});

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
}

async function assertSidebarInstituicaoAtiva(page: Page, viewport: VisualViewport): Promise<void> {
  const sidebar = page.locator('aside[aria-label="Painel administrativo"]');
  const drawer = page.locator('dialog.uni-drawer[open]');
  if (viewport === 'mobile') {
    await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('link', { name: 'Instituição' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    return;
  }
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Instituição' })).toHaveAttribute(
    'aria-current',
    'page',
  );
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
