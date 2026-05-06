import { test, expect } from '../fixtures/auth.fixture';

/**
 * Smoke ponta-a-ponta autenticado — F9 do Frontend Milestone B. Roda no
 * project `selecao-authenticated` (declarado em `playwright.config.ts`),
 * que carrega o `storageState` produzido pelo `globalSetup` — sem login via
 * UI dentro do test.
 *
 * Os smokes aqui validam:
 * - storageState carrega o usuário admin sem login UI;
 * - rotas `/editais` (lista), `/editais/novo` (form), `/editais/:id`
 *   (detalhe) renderizam para usuário autenticado;
 * - cancelar do form de criação volta para a lista.
 *
 * **Não-escopo:** validar criação real de edital ponta-a-ponta. O fluxo de
 * POST `/api/editais` depende de premissas de backend (TipoProcesso enum
 * válido, RBAC do admin, validators FluentValidation) que evoluem
 * independente do frontend e tornariam o smoke flaky. Cobertura desse
 * caminho fica para integration tests dedicados quando o contrato de
 * `TipoProcesso` estabilizar (ver gap em `uniplus-api#334`).
 */
test.describe('Editais — smoke autenticado (F9)', () => {
  test('storageState carrega admin sem login UI e renderiza lista de editais', async ({
    page,
  }) => {
    await page.goto('/editais');
    // Sem redirect ao Keycloak — storageState já contém a sessão admin.
    await expect(page).toHaveURL(/\/editais$/, { timeout: 10_000 });
    await expect(page.locator('h2')).toContainText('Editais');
    await expect(page.locator('table[role="grid"]')).toBeVisible();
  });

  test('navegacao para /editais/novo renderiza form com submit disabled em estado vazio', async ({
    page,
  }) => {
    await page.goto('/editais');
    await page.getByRole('link', { name: 'Novo edital' }).click();

    await expect(page).toHaveURL(/\/editais\/novo$/);
    await expect(page.locator('h2')).toContainText('Novo edital');
    await expect(page.locator('#numeroEdital')).toBeVisible();
    await expect(page.locator('#titulo')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Criar edital' })).toBeDisabled();
  });

  test('cancelar form retorna para /editais', async ({ page }) => {
    await page.goto('/editais/novo');
    await expect(page.locator('h2')).toContainText('Novo edital');

    await page.getByRole('link', { name: 'Cancelar' }).click();
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
