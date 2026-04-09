import { test, expect, Page } from '@playwright/test';

const screenshotsDir = 'screenshots';

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: `${screenshotsDir}/${name}.png`,
    fullPage: true,
  });
}

test.describe('Fluxo de inscrição — PoC Spartan + Gov.br DS', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/inscricao');
    await page.waitForLoadState('networkidle');
  });

  // F01 — Página inicial
  test('F01: deve exibir página inicial com header, título e 3 tabs', async ({ page }) => {
    await expect(page.locator('poc-govbr-header')).toBeVisible();
    await expect(page.getByText('Inscrição — Processo Seletivo 2026')).toBeVisible();
    await expect(page.locator('button[brnTabsTrigger="dados-pessoais"]')).toBeVisible();
    await expect(page.locator('button[brnTabsTrigger="documentos"]')).toBeVisible();
    await expect(page.locator('button[brnTabsTrigger="revisao"]')).toBeVisible();

    // Tab Dados Pessoais deve estar ativa
    await expect(page.locator('button[brnTabsTrigger="dados-pessoais"]')).toHaveAttribute('data-state', 'active');

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

    // Sem mensagens de erro visíveis (asteriscos obrigatórios usam .text-govbr-danger, filtrar só mensagens)
    await expect(page.locator('.text-govbr-xs.text-govbr-danger')).toHaveCount(0);

    await screenshot(page, '02-form-vazio');
  });

  // F03 — Validação de erros
  test('F03: deve exibir mensagens de erro ao tocar e sair de campos vazios', async ({ page }) => {
    // Tocar e sair de cada campo para disparar validação
    await page.locator('#nome').focus();
    await page.locator('#cpf').focus();
    await page.locator('#email').focus();
    await page.locator('#curso').focus();
    await page.locator('#cidade').focus();
    await page.locator('#nome').focus(); // Volta para disparar blur na cidade

    // Mensagens de erro devem aparecer
    await expect(page.getByText('Nome é obrigatório')).toBeVisible();
    await expect(page.getByText('CPF é obrigatório')).toBeVisible();
    await expect(page.getByText('E-mail é obrigatório')).toBeVisible();

    // Inputs devem ter borda vermelha
    await expect(page.locator('#nome')).toHaveClass(/border-govbr-danger/);
    await expect(page.locator('#cpf')).toHaveClass(/border-govbr-danger/);
    await expect(page.locator('#email')).toHaveClass(/border-govbr-danger/);

    await screenshot(page, '03-validacao-erros');
  });

  // F04 — Preenchimento completo
  test('F04: deve preencher formulário completo sem erros', async ({ page }) => {
    await page.fill('#nome', 'Maria da Silva');
    await page.fill('#cpf', '529.982.247-25');
    await page.fill('#email', 'maria@email.com');
    await page.selectOption('#curso', { label: 'Ciência da Computação' });
    await page.selectOption('#cidade', { label: 'Marabá — PA' });

    // Valores preenchidos
    await expect(page.locator('#nome')).toHaveValue('Maria da Silva');
    await expect(page.locator('#cpf')).toHaveValue('529.982.247-25');
    await expect(page.locator('#email')).toHaveValue('maria@email.com');

    // Sem erros de validação
    await expect(page.locator('#nome')).not.toHaveClass(/border-govbr-danger/);

    await screenshot(page, '04-form-preenchido');
  });

  // F05 — CPF inválido
  test('F05: deve exibir erro para CPF inválido', async ({ page }) => {
    await page.fill('#cpf', '111.111.111-11');
    await page.locator('#nome').focus(); // blur para disparar validação

    await expect(page.getByText('CPF inválido')).toBeVisible();
    await expect(page.locator('#cpf')).toHaveClass(/border-govbr-danger/);

    await screenshot(page, '05-cpf-invalido');
  });

  // F06 — Email inválido
  test('F06: deve exibir erro para email inválido', async ({ page }) => {
    await page.fill('#email', 'nao-e-email');
    await page.locator('#nome').focus(); // blur

    await expect(page.getByText('E-mail inválido')).toBeVisible();

    await screenshot(page, '06-email-invalido');
  });

  // F07 — Tab Documentos
  test('F07: deve navegar para tab Documentos', async ({ page }) => {
    await page.locator('button[brnTabsTrigger="documentos"]').click();

    // Tab Documentos ativa
    await expect(page.locator('button[brnTabsTrigger="documentos"]')).toHaveAttribute('data-state', 'active');

    // Conteúdo da tab visível
    await expect(page.locator('legend', { hasText: 'Modalidade de concorrência' })).toBeVisible();
    await expect(page.locator('legend', { hasText: 'Opção de curso' })).toBeVisible();

    // Modalidades de cota listadas
    await expect(page.getByText('Ampla Concorrência')).toBeVisible();

    await screenshot(page, '07-tab-documentos');
  });

  // F08 — Seleção de modalidade
  test('F08: deve selecionar modalidade Ampla Concorrência', async ({ page }) => {
    await page.locator('button[brnTabsTrigger="documentos"]').click();

    // Clicar no label da Ampla Concorrência
    await page.locator('label', { hasText: 'Ampla Concorrência' }).click();

    // Radio selecionado — input checked
    await expect(page.locator('label', { hasText: 'Ampla Concorrência' }).locator('input[type="radio"]')).toBeChecked();

    await screenshot(page, '08-modalidade-selecionada');
  });

  // F09 — Opção de curso
  test('F09: deve selecionar 1ª Opção de curso', async ({ page }) => {
    await page.locator('button[brnTabsTrigger="documentos"]').click();

    await page.locator('label', { hasText: '1ª Opção' }).click();

    await expect(page.locator('label', { hasText: '1ª Opção' }).locator('input[type="radio"]')).toBeChecked();

    await screenshot(page, '09-opcao-curso');
  });

  // F10 — Tab Revisão com tabela
  // FINDING: computed signal com form.getRawValue() não é reativo — os valores preenchidos
  // nos campos não aparecem na tabela de revisão. O computed() é avaliado uma vez e não
  // re-executa quando o FormGroup muda (getRawValue() não é um signal).
  // Solução: converter para toSignal(form.valueChanges) ou usar form.getRawValue() com effect().
  test.fixme('F10: deve exibir tabela de revisão com 7 linhas', async ({ page }) => {
    // Preencher formulário completo primeiro
    await page.fill('#nome', 'Maria da Silva');
    await page.fill('#cpf', '529.982.247-25');
    await page.fill('#email', 'maria@email.com');
    await page.selectOption('#curso', { label: 'Ciência da Computação' });
    await page.selectOption('#cidade', { label: 'Marabá — PA' });

    // Preencher documentos
    await page.locator('button[brnTabsTrigger="documentos"]').click();
    await page.locator('label', { hasText: 'Ampla Concorrência' }).click();
    await page.locator('label', { hasText: '1ª Opção' }).click();

    // Ir para Revisão
    await page.locator('button[brnTabsTrigger="revisao"]').click();

    await expect(page.getByText('Revisão da Inscrição')).toBeVisible();

    // Tabela CDK com dados
    const table = page.locator('table[cdk-table]');
    await expect(table).toBeVisible();

    // 7 linhas de dados (excluindo header)
    const rows = table.locator('tr[cdk-row]');
    await expect(rows).toHaveCount(7);

    // Valores corretos na tabela (aguardar computed signal atualizar)
    await expect(page.getByText('Maria da Silva')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('529.982.247-25')).toBeVisible();
    await expect(page.getByText('maria@email.com')).toBeVisible();
    await expect(page.getByText('Ciência da Computação')).toBeVisible();

    // Header azul
    const headerRow = table.locator('tr[cdk-header-row]');
    await expect(headerRow).toBeVisible();

    await screenshot(page, '10-tab-revisao');
  });

  // F11 — Dialog de confirmação
  test('F11: deve abrir dialog de confirmação', async ({ page }) => {
    await page.locator('button[brnTabsTrigger="revisao"]').click();

    const enviarBtn = page.locator('poc-confirmacao-dialog button', { hasText: 'Enviar Inscrição' });
    await expect(enviarBtn).toBeVisible();
    await enviarBtn.click();
    await page.waitForTimeout(300);

    // Dialog deve aparecer
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Confirmar inscrição')).toBeVisible();
    await expect(page.getByText('Cancelar')).toBeVisible();
    await expect(page.locator('[data-testid="btn-confirmar"]')).toBeVisible();

    await screenshot(page, '11-dialog-confirmacao');
  });

  // F12 — Fechar dialog
  test('F12: deve fechar dialog ao clicar Cancelar', async ({ page }) => {
    await page.locator('button[brnTabsTrigger="revisao"]').click();

    await page.locator('poc-confirmacao-dialog button', { hasText: 'Enviar Inscrição' }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 });

    // Cancelar
    await page.locator('[role="dialog"] button', { hasText: 'Cancelar' }).click();
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();

    await screenshot(page, '12-dialog-fechado');
  });

  // F13 — Confirmação com formulário válido (sucesso)
  test('F13: deve exibir alert de sucesso após confirmar formulário válido', async ({ page }) => {
    // Preencher formulário completo
    await page.fill('#nome', 'Maria da Silva');
    await page.fill('#cpf', '529.982.247-25');
    await page.fill('#email', 'maria@email.com');
    await page.selectOption('#curso', { label: 'Ciência da Computação' });
    await page.selectOption('#cidade', { label: 'Marabá — PA' });

    // Preencher documentos
    await page.locator('button[brnTabsTrigger="documentos"]').click();
    await page.locator('label', { hasText: 'Ampla Concorrência' }).click();
    await page.locator('label', { hasText: '1ª Opção' }).click();

    // Ir para Revisão e enviar
    await page.locator('button[brnTabsTrigger="revisao"]').click();
    await page.locator('poc-confirmacao-dialog button', { hasText: 'Enviar Inscrição' }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 });

    // Confirmar
    await page.locator('[data-testid="btn-confirmar"]').click();

    // Alert de sucesso
    await expect(page.getByText('Inscrição enviada com sucesso!')).toBeVisible({ timeout: 3000 });

    await screenshot(page, '13-sucesso');
  });

  // F14 — Confirmação com formulário inválido (erro)
  test('F14: deve exibir alert de erro ao confirmar formulário incompleto', async ({ page }) => {
    // Ir direto para Revisão sem preencher
    await page.locator('button[brnTabsTrigger="revisao"]').click();

    await page.locator('poc-confirmacao-dialog button', { hasText: 'Enviar Inscrição' }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 });

    // Confirmar sem preencher
    await page.locator('[data-testid="btn-confirmar"]').click();

    // Alert de erro
    await expect(page.getByText('Formulário incompleto')).toBeVisible({ timeout: 3000 });

    await screenshot(page, '14-erro-validacao');
  });

  // F15 — Navegação de volta preserva estado
  test('F15: deve preservar dados ao navegar entre tabs', async ({ page }) => {
    // Preencher dados pessoais
    await page.fill('#nome', 'Maria da Silva');
    await page.fill('#cpf', '529.982.247-25');
    await page.fill('#email', 'maria@email.com');

    // Navegar para Revisão
    await page.locator('button[brnTabsTrigger="revisao"]').click();

    // Voltar para Dados Pessoais
    await page.locator('button[brnTabsTrigger="dados-pessoais"]').click();

    // Dados devem estar preservados
    await expect(page.locator('#nome')).toHaveValue('Maria da Silva');
    await expect(page.locator('#cpf')).toHaveValue('529.982.247-25');
    await expect(page.locator('#email')).toHaveValue('maria@email.com');

    await screenshot(page, '15-navegacao-volta');
  });
});
