import { runAxeWcagAA } from '@uniplus/shared-e2e';
import { test, expect } from '../fixtures/auth.fixture';

/**
 * Baseline de acessibilidade WCAG 2.1 A + AA para as páginas Editais
 * (módulo Seleção). Roda no project `selecao-authenticated` — usa
 * `storageState` admin do `globalSetup`/setup project (sem login UI por
 * test).
 *
 * **Estratégia:** baseline incremental. Cada page coberta aqui passa a
 * ser regression-tested em PRs subsequentes — evita drift de a11y.
 * Páginas adicionais (Inscrição, Recurso, Classificação) entram quando
 * suas features amadurecerem.
 *
 * **Conformidade alvo:** e-MAG 3.1 + WCAG 2.1 AA (autarquia federal —
 * Lei 13.146/2015 + Decreto 9.094/2017).
 */
test.describe('Editais — a11y baseline WCAG 2.1 A+AA', () => {
  test('GET /editais (lista) sem violations', async ({ page }) => {
    await page.goto('/editais');
    // Aguarda o estado estável: header + tabela renderizados.
    await expect(page.locator('h2', { hasText: 'Editais' })).toBeVisible();
    await expect(page.locator('table[role="grid"]')).toBeVisible();

    const results = await runAxeWcagAA(page);
    expect(results.violations).toEqual([]);
  });

  test('GET /editais/novo (form) sem violations', async ({ page }) => {
    await page.goto('/editais/novo');
    await expect(page.locator('h2', { hasText: 'Novo edital' })).toBeVisible();
    // Confirma form renderizado antes da análise (axe precisa do DOM final).
    await expect(page.getByLabel('Número do edital')).toBeVisible();

    const results = await runAxeWcagAA(page);
    expect(results.violations).toEqual([]);
  });

  test('GET /editais/{id-inexistente} (banner de erro) sem violations', async ({ page }) => {
    const idArbitrario = '01960000-0000-7000-0000-000000000fff';
    await page.goto(`/editais/${idArbitrario}`);
    await expect(page.locator('h2', { hasText: 'Detalhes do edital' })).toBeVisible();
    // Aguarda banner de erro aparecer — confirma estado estável pós-404.
    await expect(page.locator('[role="alert"]')).toBeVisible();

    const results = await runAxeWcagAA(page);
    expect(results.violations).toEqual([]);
  });
});
