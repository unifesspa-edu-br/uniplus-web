import { test, expect, Page } from '@playwright/test';

import { join } from 'path';

const screenshotsDir = join(__dirname, '..', 'screenshots');

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: `${screenshotsDir}/${name}.png`,
    fullPage: true,
  });
}

test.describe('Fluxo de inscrição — PoC PrimeNG + Gov.br DS', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/inscricao');
    await expect(page.locator('poc-govbr-header')).toBeVisible({ timeout: 10_000 });
  });

  // F01 — Página inicial
  test('F01: deve exibir página inicial com header, título e 3 tabs', async ({ page }) => {
    await expect(page.locator('poc-govbr-header')).toBeVisible();
    await expect(page.getByText('Inscrição — Processo Seletivo 2026')).toBeVisible();

    const tabs = page.locator('[role="tablist"] [role="tab"]');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toHaveText(/Dados Pessoais/);
    await expect(tabs.nth(1)).toHaveText(/Documentos/);
    await expect(tabs.nth(2)).toHaveText(/Revisão/);

    // Tab Dados Pessoais ativa por default
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');

    await screenshot(page, '01-pagina-inicial');
  });

  // F02 — Formulário vazio
  test('F02: formulário vazio com placeholders e sem mensagens de erro', async ({ page }) => {
    await expect(page.locator('#nome')).toHaveValue('');
    await expect(page.locator('#cpf')).toHaveValue('');
    await expect(page.locator('#email')).toHaveValue('');
    await expect(page.locator('#nome')).toHaveAttribute('placeholder', 'Digite seu nome completo');
    await expect(page.locator('#cpf')).toHaveAttribute('placeholder', '000.000.000-00');
    await expect(page.locator('#email')).toHaveAttribute('placeholder', 'seu.email@exemplo.com');

    await expect(page.locator('.text-govbr-xs.text-govbr-danger')).toHaveCount(0);

    await screenshot(page, '02-form-vazio');
  });

  // F03 — Validação de erros
  test('F03: deve exibir mensagens de erro ao tocar e sair de campos vazios', async ({ page }) => {
    await page.locator('#nome').focus();
    await page.locator('#cpf').focus();
    await page.locator('#email').focus();
    await page.locator('h1').click();

    await expect(page.getByText('Nome é obrigatório')).toBeVisible();
    await expect(page.getByText('CPF é obrigatório')).toBeVisible();
    await expect(page.getByText('E-mail é obrigatório')).toBeVisible();

    await screenshot(page, '03-validacao-erros');
  });

  // F04 — Preenchimento completo
  test('F04: deve preencher formulário completo sem erros', async ({ page }) => {
    await page.fill('#nome', 'Maria da Silva');
    await page.fill('#cpf', '529.982.247-25');
    await page.fill('#email', 'maria@email.com');

    // PrimeNG Select: click para abrir + click na opção
    await page.locator('p-select#curso').click();
    await page.locator('[role="option"]', { hasText: 'Ciência da Computação' }).click();

    await page.locator('p-select#cidade').click();
    await page.locator('[role="option"]', { hasText: 'Marabá' }).click();

    await expect(page.locator('#nome')).toHaveValue('Maria da Silva');
    await expect(page.locator('#cpf')).toHaveValue('529.982.247-25');
    await expect(page.locator('#email')).toHaveValue('maria@email.com');

    await screenshot(page, '04-form-preenchido');
  });

  // F05 — CPF inválido
  test('F05: deve exibir erro para CPF inválido', async ({ page }) => {
    await page.fill('#cpf', '111.111.111-11');
    await page.locator('#nome').focus();
    await page.locator('h1').click();

    await expect(page.getByText('CPF inválido')).toBeVisible();

    await screenshot(page, '05-cpf-invalido');
  });

  // F06 — Email inválido
  test('F06: deve exibir erro para email inválido', async ({ page }) => {
    await page.fill('#email', 'nao-e-email');
    await page.locator('#nome').focus();
    await page.locator('h1').click();

    await expect(page.getByText('E-mail inválido')).toBeVisible();

    await screenshot(page, '06-email-invalido');
  });

  // F07 — Tab Documentos
  test('F07: deve navegar para tab Documentos', async ({ page }) => {
    await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Documentos' }).click();

    const tabDoc = page.locator('[role="tablist"] [role="tab"]', { hasText: 'Documentos' });
    await expect(tabDoc).toHaveAttribute('aria-selected', 'true');

    await expect(page.locator('legend', { hasText: 'Modalidade de concorrência' })).toBeVisible();
    await expect(page.locator('legend', { hasText: 'Opção de curso' })).toBeVisible();
    await expect(page.getByText('Ampla Concorrência')).toBeVisible();

    await screenshot(page, '07-tab-documentos');
  });

  // F08 — Seleção de modalidade
  test('F08: deve selecionar modalidade Ampla Concorrência', async ({ page }) => {
    await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Documentos' }).click();

    await page.locator('label', { hasText: 'Ampla Concorrência' }).click();

    const radioInput = page.locator('#mod-AC');
    await expect(radioInput).toBeChecked();

    await screenshot(page, '08-modalidade-selecionada');
  });

  // F09 — Opção de curso
  test('F09: deve selecionar 1ª Opção de curso', async ({ page }) => {
    await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Documentos' }).click();

    await page.locator('label', { hasText: '1ª Opção' }).click();

    const radioInput = page.locator('#opcao-primeira');
    await expect(radioInput).toBeChecked();

    await screenshot(page, '09-opcao-curso');
  });

  // F10 — Tab Revisão com tabela reativa
  test('F10: deve exibir tabela de revisão com 7 linhas', async ({ page }) => {
    await page.fill('#nome', 'Maria da Silva');
    await page.fill('#cpf', '529.982.247-25');
    await page.fill('#email', 'maria@email.com');

    await page.locator('p-select#curso').click();
    await page.locator('[role="option"]', { hasText: 'Ciência da Computação' }).click();

    await page.locator('p-select#cidade').click();
    await page.locator('[role="option"]', { hasText: 'Marabá' }).click();

    await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Documentos' }).click();
    await page.locator('label', { hasText: 'Ampla Concorrência' }).click();
    await page.locator('label', { hasText: '1ª Opção' }).click();

    await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' }).click();

    await expect(page.getByText('Revisão da Inscrição')).toBeVisible();

    const table = page.locator('p-table table');
    await expect(table).toBeVisible();

    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(7);

    await expect(table.getByText('Maria da Silva')).toBeVisible();
    await expect(table.getByText('529.982.247-25')).toBeVisible();
    await expect(table.getByText('maria@email.com')).toBeVisible();
    await expect(table.getByText('Ciência da Computação')).toBeVisible();

    await screenshot(page, '10-tab-revisao');
  });

  // F11 — Dialog de confirmação
  test('F11: deve abrir dialog de confirmação', async ({ page }) => {
    await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' }).click();

    const enviarBtn = page.locator('[data-testid="btn-enviar-inscricao"]');
    await expect(enviarBtn).toBeVisible();
    await enviarBtn.click();

    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Confirmar inscrição')).toBeVisible();
    await expect(page.locator('[data-testid="btn-cancelar"]')).toBeVisible();
    await expect(page.locator('[data-testid="btn-confirmar"]')).toBeVisible();

    await screenshot(page, '11-dialog-confirmacao');
  });

  // F12 — Fechar dialog
  test('F12: deve fechar dialog ao clicar Cancelar', async ({ page }) => {
    await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' }).click();
    await page.locator('[data-testid="btn-enviar-inscricao"]').click();

    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 });
    await page.locator('[data-testid="btn-cancelar"]').click();

    await expect(page.locator('[role="dialog"]')).toBeHidden();

    await screenshot(page, '12-dialog-fechado');
  });

  // F13 — Confirmação com formulário válido
  test('F13: deve exibir alert de sucesso após confirmar formulário válido', async ({ page }) => {
    await page.fill('#nome', 'Maria da Silva');
    await page.fill('#cpf', '529.982.247-25');
    await page.fill('#email', 'maria@email.com');

    await page.locator('p-select#curso').click();
    await page.locator('[role="option"]', { hasText: 'Ciência da Computação' }).click();

    await page.locator('p-select#cidade').click();
    await page.locator('[role="option"]', { hasText: 'Marabá' }).click();

    await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Documentos' }).click();
    await page.locator('label', { hasText: 'Ampla Concorrência' }).click();
    await page.locator('label', { hasText: '1ª Opção' }).click();

    await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' }).click();
    await page.locator('[data-testid="btn-enviar-inscricao"]').click();

    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 });
    await page.locator('[data-testid="btn-confirmar"]').click();

    await expect(page.getByText('Inscrição enviada com sucesso')).toBeVisible({ timeout: 3000 });

    await screenshot(page, '13-sucesso');
  });

  // F14 — Confirmação com formulário inválido
  test('F14: deve exibir alert de erro ao confirmar formulário incompleto', async ({ page }) => {
    await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' }).click();
    await page.locator('[data-testid="btn-enviar-inscricao"]').click();

    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 });
    await page.locator('[data-testid="btn-confirmar"]').click();

    await expect(page.getByText('Formulário incompleto')).toBeVisible({ timeout: 3000 });

    await screenshot(page, '14-erro-validacao');
  });

  // F15 — Navegação preserva dados
  test('F15: deve preservar dados ao navegar entre tabs', async ({ page }) => {
    await page.fill('#nome', 'Maria da Silva');
    await page.fill('#cpf', '529.982.247-25');
    await page.fill('#email', 'maria@email.com');

    await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' }).click();
    await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Dados Pessoais' }).click();

    await expect(page.locator('#nome')).toHaveValue('Maria da Silva');
    await expect(page.locator('#cpf')).toHaveValue('529.982.247-25');
    await expect(page.locator('#email')).toHaveValue('maria@email.com');

    await screenshot(page, '15-navegacao-volta');
  });
});
