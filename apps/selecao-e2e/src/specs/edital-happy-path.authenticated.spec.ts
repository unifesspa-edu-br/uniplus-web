import { test, expect } from '../fixtures/auth.fixture';

/**
 * Happy path ponta-a-ponta do ciclo CRUD de Edital — F9 do Frontend
 * Milestone B. Roda no project `selecao-authenticated` (declarado em
 * `playwright.config.ts`), que carrega o `storageState` produzido pelo
 * `globalSetup` — sem login via UI dentro do test.
 *
 * Fluxo:
 * 1. Visita `/editais` → lista renderiza (Editais List).
 * 2. Clica "Novo edital" → preenche form → submete → 201.
 * 3. Volta para `/editais` (redirect pós-submit).
 *
 * **Não verifica** a navegação até detail e o publicar — esse fluxo depende
 * de que a lista atualize com o item criado, o que requer pagination/refresh
 * fora do escopo F9. O smoke aqui valida que a foundation autenticada
 * funciona ponta-a-ponta contra a `uniplus-api` real.
 */
test.describe('Editais — happy path autenticado (F9)', () => {
  test('lista carrega + criar edital redireciona para /editais', async ({ page }) => {
    await page.goto('/editais');
    await expect(page.locator('h2')).toContainText('Editais');
    await expect(page.locator('table[role="grid"]')).toBeVisible();

    await page.getByRole('link', { name: 'Novo edital' }).click();
    await expect(page).toHaveURL(/\/editais\/novo$/);

    // Geração de número aleatório evita 409 (RN: numeroEdital único por ano).
    const numero = Math.floor(Math.random() * 900_000) + 100_000;
    await page.locator('#numeroEdital').fill(String(numero));
    await page.locator('#anoEdital').fill('2026');
    await page.locator('#titulo').fill(`PSE 2026 — F9 smoke ${numero}`);
    await page.locator('#tipoProcesso').fill('1');
    await page.locator('#maximoOpcoesCurso').fill('2');

    await expect(page.getByRole('button', { name: 'Criar edital' })).toBeEnabled();
    await page.getByRole('button', { name: 'Criar edital' }).click();

    await expect(page).toHaveURL(/\/editais$/, { timeout: 10_000 });
    await expect(page.locator('h2')).toContainText('Editais');
  });

  test('navegacao direta para /editais/{id-inexistente} mostra banner de erro', async ({
    page,
  }) => {
    const idInexistente = '01960000-0000-7000-0000-000000000fff';
    await page.goto(`/editais/${idInexistente}`);

    await expect(page.locator('h2')).toContainText('Detalhes do edital');
    await expect(page.locator('[role="alert"]')).toBeVisible();
  });
});
