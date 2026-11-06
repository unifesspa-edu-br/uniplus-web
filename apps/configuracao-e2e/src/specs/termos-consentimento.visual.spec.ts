import { expect, test, type Locator, type TestInfo } from '@playwright/test';
import { ID, mockTermosConsentimento } from '../support/termos-consentimento-api';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

type VisualTheme = 'light' | 'dark' | 'contrast';

const TOLERANCIA = 1;

async function caixa(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Elemento sem geometria visível.');
  return { y: box.y, base: box.y + box.height, altura: box.height, largura: box.width };
}

function tema(testInfo: TestInfo): VisualTheme {
  const valor = testInfo.project.metadata['theme'];
  return valor === 'dark' || valor === 'contrast' ? valor : 'light';
}

test.describe('Termos de consentimento — geometria', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await mockConfiguracaoRuntimeConfig(page);
    await page.addInitScript((valor: VisualTheme) => {
      window.localStorage.setItem(
        'uniplus.a11y',
        JSON.stringify({
          theme: valor === 'contrast' ? 'auto' : valor,
          contrast: valor === 'contrast',
          fontMode: 'default',
        }),
      );
    }, tema(testInfo));
    await mockTermosConsentimento(page);
  });

  test('lista: cabeçalho e painel ficam separados só pelo espaçamento da página', async ({
    page,
  }) => {
    await page.goto('/termos-consentimento');
    await expect(page.locator('.panel table')).toBeVisible();
    const pagina = page.locator('.cfg-page');
    const gap = await pagina.evaluate((el) => Number.parseFloat(getComputedStyle(el).rowGap));
    const cabecalho = await caixa(page.locator('.page-header'));
    const painel = await caixa(page.locator('.panel'));
    const geoPagina = await caixa(pagina);
    expect(Math.abs(painel.y - cabecalho.base - gap)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(geoPagina.base - painel.base)).toBeLessThanOrEqual(TOLERANCIA);
  });

  test('lista: a busca fica dentro do painel, abaixo do cabeçalho dele', async ({ page }) => {
    await page.goto('/termos-consentimento');
    await expect(page.locator('.panel table')).toBeVisible();
    await expect(page.locator('.cfg-page > ui-filter-bar')).toHaveCount(0);
    const cabecalho = await caixa(page.locator('.panel > .panel-head'));
    const busca = await caixa(page.locator('.panel .filter-bar'));
    const tabela = await caixa(page.locator('.panel table'));
    expect(busca.y).toBeGreaterThanOrEqual(cabecalho.base - TOLERANCIA);
    expect(tabela.y).toBeGreaterThanOrEqual(busca.base - TOLERANCIA);
  });

  test('termo: o diálogo de remoção fechado não ocupa espaço na página', async ({ page }) => {
    await page.goto(`/termos-consentimento/${ID}`);
    await expect(page.getByRole('button', { name: 'Remover', exact: true })).toBeVisible();
    const hospedeiro = page.locator('cfg-confirmacao-de-remocao');
    await expect(hospedeiro).toHaveCSS('position', 'absolute');
    expect((await caixa(hospedeiro)).altura).toBeLessThanOrEqual(TOLERANCIA);
  });

  test('termo: os campos do rascunho cabem na largura da página', async ({ page }) => {
    await page.goto(`/termos-consentimento/${ID}`);
    const campos = page.locator('.cfg-termo-consentimento__campos');
    await expect(campos).toBeVisible();
    const dimensoes = await page.evaluate(() => ({
      largura: document.documentElement.scrollWidth,
      visivel: document.documentElement.clientWidth,
    }));
    expect(dimensoes.largura).toBeLessThanOrEqual(dimensoes.visivel + TOLERANCIA);
  });
});
