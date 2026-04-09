import { test, expect } from '@playwright/test';

test.describe('Fluxo de inscrição — PoC Spartan + Gov.br DS', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/inscricao');
    await page.waitForLoadState('networkidle');
  });

  test('deve exibir o header Gov.br', async ({ page }) => {
    await expect(page.locator('poc-govbr-header')).toBeVisible();
    await expect(page.getByText('Sistema Unificado CEPS')).toBeVisible();
    await expect(page.getByText('GOVERNO FEDERAL')).toBeVisible();
  });

  test('deve exibir as 3 tabs de navegação', async ({ page }) => {
    await expect(page.locator('button[brnTabsTrigger="dados-pessoais"]')).toBeVisible();
    await expect(page.locator('button[brnTabsTrigger="documentos"]')).toBeVisible();
    await expect(page.locator('button[brnTabsTrigger="revisao"]')).toBeVisible();
  });

  test('deve preencher dados pessoais', async ({ page }) => {
    await page.fill('#nome', 'Maria da Silva');
    await page.fill('#cpf', '529.982.247-25');
    await page.fill('#email', 'maria@email.com');

    await expect(page.locator('#nome')).toHaveValue('Maria da Silva');
    await expect(page.locator('#cpf')).toHaveValue('529.982.247-25');
    await expect(page.locator('#email')).toHaveValue('maria@email.com');
  });

  test('deve exibir validação de campos obrigatórios', async ({ page }) => {
    await page.click('#nome');
    await page.click('#cpf');

    await expect(page.getByText('Nome é obrigatório')).toBeVisible();
  });

  test('deve navegar entre tabs', async ({ page }) => {
    // Ir para Documentos
    await page.locator('button[brnTabsTrigger="documentos"]').click();
    await expect(page.locator('legend', { hasText: 'Modalidade de concorrência' })).toBeVisible();

    // Ir para Revisão
    await page.locator('button[brnTabsTrigger="revisao"]').click();
    await expect(page.getByText('Revisão da Inscrição')).toBeVisible();

    // Voltar para Dados Pessoais
    await page.locator('button[brnTabsTrigger="dados-pessoais"]').click();
    await expect(page.locator('#nome')).toBeVisible();
  });

  // FINDING: Dialog com @if + signal em zoneless — Playwright não detecta o dialog
  // após click no botão. Change detection do signal pode precisar de workaround.
  // Documentado em findings.md como item de investigação.
  test.fixme('deve abrir e fechar dialog de confirmação', async ({ page }) => {
    // Ir para aba Revisão
    await page.locator('button[brnTabsTrigger="revisao"]').click();
    await page.waitForTimeout(500);

    // Clicar em Enviar — botão dentro da poc-confirmacao-dialog
    const enviarBtn = page.locator('poc-confirmacao-dialog button', { hasText: 'Enviar Inscrição' });
    await expect(enviarBtn).toBeVisible();
    await enviarBtn.click();
    await page.waitForTimeout(300);

    // Dialog deve aparecer
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Confirmar inscrição')).toBeVisible();

    // Cancelar
    await page.locator('[role="dialog"] button', { hasText: 'Cancelar' }).click();
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });
});
