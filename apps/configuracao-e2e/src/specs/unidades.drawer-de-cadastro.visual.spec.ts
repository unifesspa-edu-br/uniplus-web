import { expect, test, type Locator } from '@playwright/test';
import {
  attachScreenshot,
  metadataViewport,
  prepararTelaDeUnidades,
} from '../support/visual-das-unidades';

test.describe('Unidade — cobertura visual DS', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await prepararTelaDeUnidades(page, testInfo);
  });

  test('drawer de cadastro preserva footer, rolagem única e grid responsivo', async ({
    page,
  }, testInfo) => {
    const viewport = metadataViewport(testInfo);

    await page.goto('/unidades');
    await page.getByRole('button', { name: 'Nova unidade' }).click();

    const drawer = page.locator('dialog.uni-drawer').filter({ hasText: 'Nova unidade' });
    await expect(drawer).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/uni-drawer-open/);
    await expect(drawer.getByRole('heading', { name: 'Nova unidade' })).toBeVisible();
    await expect(drawer.getByText('Identificadores')).toBeVisible();
    await expect(drawer.getByText('Classificação e hierarquia')).toBeVisible();
    await expect(drawer.getByText('Vigência', { exact: true })).toBeVisible();

    const footer = drawer.locator('.form-drawer__footer');
    await expect(footer.getByRole('button', { name: 'Cancelar' })).toBeVisible();
    await expect(footer.getByRole('button', { name: 'Criar unidade' })).toBeVisible();

    const drawerMetrics = await drawer.locator('.uni-drawer__panel').evaluate((panel) => {
      const body = panel.querySelector('.uni-drawer__body') as HTMLElement;
      const form = panel.querySelector('.form-drawer__form') as HTMLElement;
      const grid = panel.querySelector('.form-grid') as HTMLElement;
      const footer = panel.querySelector('.form-drawer__footer') as HTMLElement;
      const panelRect = panel.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      return {
        bodyOverflowY: getComputedStyle(body).overflowY,
        formOverflowY: getComputedStyle(form).overflowY,
        bodyScrolls: body.scrollHeight > body.clientHeight,
        bodyOverflow: getComputedStyle(document.body).overflow,
        // A grade é flex (quebra por espaço): as colunas são as posições à esquerda distintas.
        gridColumns: new Set(
          Array.from(grid.children, (campo) => Math.round(campo.getBoundingClientRect().left)),
        ).size,
        panelWidth: panelRect.width,
        footerInsideViewport: footerRect.bottom <= window.innerHeight + 1,
      };
    });

    expect(drawerMetrics.bodyOverflowY).toBe('auto');
    expect(drawerMetrics.formOverflowY).toBe('visible');
    expect(drawerMetrics.bodyScrolls).toBe(true);
    expect(drawerMetrics.bodyOverflow).toBe('hidden');
    expect(drawerMetrics.footerInsideViewport).toBe(true);
    expect(drawerMetrics.panelWidth).toBeGreaterThan(viewport === 'desktop' ? 600 : 0);
    expect(drawerMetrics.panelWidth).toBeLessThanOrEqual(
      viewport === 'desktop' ? Number.MAX_SAFE_INTEGER : 375,
    );
    expect(drawerMetrics.gridColumns).toBe(viewport === 'desktop' ? 2 : 1);

    await attachScreenshot(page, testInfo, 'unidades-drawer');

    await fillRequiredUnitForm(drawer);
    await drawer.getByLabel('Início de vigência').fill('2026-06-10');
    await drawer.getByLabel('Fim de vigência').fill('2026-06-02');
    await expect(footer.getByRole('button', { name: 'Criar unidade' })).toBeEnabled();
    await footer.getByRole('button', { name: 'Criar unidade' }).click();
    await expect(
      drawer.getByText('Data de encerramento deve ser igual ou posterior à data de início.'),
    ).toBeVisible();

    await drawer.getByLabel('Fim de vigência').fill('2026-06-10');
    await footer.getByRole('button', { name: 'Criar unidade' }).click();
    await expect(drawer).toBeHidden();
    await expect(page.locator('body')).not.toHaveClass(/uni-drawer-open/);
  });
});

async function fillRequiredUnitForm(drawer: Locator): Promise<void> {
  await drawer.getByLabel('Sigla').fill('FACOM');
  await drawer.getByLabel('Slug').fill('facom');
  await drawer.getByLabel('Código').fill('FACOM');
  await drawer.getByLabel('Nome completo').fill('Faculdade de Computação');
}
