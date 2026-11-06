import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { assertReflowContract, runAxeWcagAA } from '@uniplus/shared-e2e';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import { laudoSeed, mockApi, novoCapturado, rgSeed } from '../support/tipos-documento-api';

type VisualTheme = 'light' | 'dark' | 'contrast';

const TOLERANCIA = 1;

test.describe('Tipo de documento — lista e formulário', () => {
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
    await mockApi(page, novoCapturado(), [rgSeed, laudoSeed]);

    await page.goto('/tipos-documento');
    // Varredura sobre conjunto vazio aprova: as ações de linha só existem com a tabela renderizada.
    await expect(page.locator('table tbody tr')).toHaveCount(2);
  });

  test('aplica o tema selecionado e lista o cadastro', async ({ page }, testInfo) => {
    await expect(page.locator('html')).toHaveAttribute('data-theme', metadataTheme(testInfo));
    await expect(page.getByRole('heading', { name: 'Tipo de Documento', level: 1 })).toBeVisible();
  });

  test('a lista não viola WCAG 2.1 A/AA', async ({ page }) => {
    await expectSemViolacoes(page);
  });

  test('o formulário não viola WCAG 2.1 A/AA', async ({ page }) => {
    await page.getByRole('button', { name: 'Novo tipo' }).first().click();
    await expect(page.locator('[formControlName="codigo"]')).toBeVisible();
    await expectSemViolacoes(page);
  });

  test('o detalhe não viola WCAG 2.1 A/AA', async ({ page }) => {
    await page.getByRole('button', { name: `Ver o detalhe de ${rgSeed.nome}` }).click();
    await expect(page.getByRole('dialog', { name: 'Detalhe do tipo de documento' })).toBeVisible();
    await expectSemViolacoes(page);
  });

  test('a gaveta rola pelo formulário e mantém o rodapé fixo', async ({ page }) => {
    await page.getByRole('button', { name: 'Novo tipo' }).first().click();

    const formulario = page.locator('form.form-drawer__form');
    await expect(formulario).toBeVisible();
    await expect(formulario).toHaveCSS('overflow-y', 'auto');

    const rodape = page.locator('.form-drawer__footer');
    await expect(rodape).toBeVisible();
    await expect(formulario.locator('.form-drawer__footer')).toHaveCount(0);
    await expect(rodape.getByRole('button', { name: 'Criar tipo de documento' })).toBeVisible();
  });

  // Os hospedeiros fechados de drawer e diálogo não podem consumir espaçamento, e a barra de filtros
  // não pode trazer margem própria: entre os blocos só existe o espaçamento da página.
  test('os blocos ficam a um espaçamento da página uns dos outros e ela termina no painel', async ({
    page,
  }) => {
    const pagina = page.locator('.cfg-page');
    const gap = await pagina.evaluate((el) => Number.parseFloat(getComputedStyle(el).rowGap));
    const cabecalho = await caixa(page.locator('.page-header'));
    const filtros = await caixa(page.locator('cfg-tipos-documento-filtros'));
    const painel = await caixa(page.locator('.panel'));
    const geoPagina = await caixa(pagina);

    expect(Math.abs(filtros.y - cabecalho.base - gap)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(painel.y - filtros.base - gap)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(geoPagina.base - painel.base)).toBeLessThanOrEqual(TOLERANCIA);
  });

  test('a página cumpre o contrato de reflow do viewport', async ({ page }) => {
    await assertReflowContract(page);
  });
});

async function caixa(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Elemento sem geometria visível.');
  return { y: box.y, base: box.y + box.height };
}

async function expectSemViolacoes(page: Page): Promise<void> {
  const { violations } = await runAxeWcagAA(page);
  expect(
    violations.map((violacao) => violacao.id),
    JSON.stringify(violations, null, 2),
  ).toEqual([]);
}

function metadataTheme(testInfo: TestInfo): VisualTheme {
  const theme = testInfo.project.metadata['theme'];
  return theme === 'dark' || theme === 'contrast' ? theme : 'light';
}
