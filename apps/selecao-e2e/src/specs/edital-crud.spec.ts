import { test, expect } from '@playwright/test';
import { keycloakLogin, resetPasswords } from '../support/keycloak-login';

const ADMIN = { username: 'admin', password: 'E2eTest!123' };

test.describe('Editais — CRUD', () => {
  test.beforeAll(async () => {
    await resetPasswords([ADMIN]);
  });

  test('deve exibir a listagem de editais após login como admin', async ({ page }) => {
    await page.goto('/editais');
    await keycloakLogin(page, ADMIN.username, ADMIN.password);
    await expect(page.locator('h2')).toContainText('Editais');
    // EditaisListPage (F6) sempre renderiza um <table role="grid">; quando o
    // backend devolve lista vazia, a mensagem "Nenhum edital cadastrado." cai
    // no tbody. Quando há itens, as linhas aparecem em <tbody tr>.
    await expect(page.locator('table[role="grid"]')).toBeVisible();
  });

  test('deve permitir navegar até /editais/novo e renderizar o form de criação (F7)', async ({
    page,
  }) => {
    await page.goto('/editais');
    await keycloakLogin(page, ADMIN.username, ADMIN.password);

    await page.getByRole('link', { name: 'Novo edital' }).click();

    await expect(page).toHaveURL(/\/editais\/novo$/);
    await expect(page.locator('h2')).toContainText('Novo edital');
    // Selectors por label são semânticos + resilientes a mudança de IDs
    // (o ui-form-field wrapper gera IDs únicos por instância, não estáveis).
    await expect(page.getByLabel('Número do edital')).toBeVisible();
    await expect(page.getByLabel('Ano')).toBeVisible();
    await expect(page.getByLabel('Título')).toBeVisible();
    await expect(page.getByLabel('Tipo de processo (código numérico)')).toBeVisible();
    await expect(page.getByLabel('Máximo de opções de curso')).toBeVisible();
    // Submit fica disabled enquanto form invalid + nenhum campo preenchido.
    await expect(page.getByRole('button', { name: 'Criar edital' })).toBeDisabled();
  });

  test('deve renderizar EditaisDetailPage com banner de erro ao acessar /editais/{id} inexistente (F8)', async ({
    page,
  }) => {
    // Smoke direto na URL — independe de a lista ter itens. ID arbitrário
    // garante 404 no backend; a page deve mostrar banner role="alert" sem
    // crash. Cobertura ponta-a-ponta com criar→listar→detalhar→publicar fica
    // para F9 (auth fixture + happy path completo).
    const idArbitrario = '01960000-0000-7000-0000-000000000001';
    await page.goto(`/editais/${idArbitrario}`);
    await keycloakLogin(page, ADMIN.username, ADMIN.password);

    await expect(page.locator('h2')).toContainText('Detalhes do edital');
    await expect(page.getByRole('link', { name: 'Voltar para lista' })).toBeVisible();
    // Banner de erro role="alert" via problem-i18n — confirma que a page lida
    // graciosamente com 404 sem crash do componente.
    await expect(page.locator('[role="alert"]')).toBeVisible();
  });
});
