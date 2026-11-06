import { expect, test, type Page } from '@playwright/test';
import {
  CONFLITO_DE_CONCORRENCIA,
  ERRO_INTERNO,
  ID,
  RECUSA_DO_NOME,
  RECUSA_DO_TEXTO,
  TERMO,
  TERMO_PROMOVIDO,
  TERMO_REVISADO,
  mockTermosConsentimento,
  type OpcoesDoMock,
} from '../support/termos-consentimento-api';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const botaoDe = (page: Page, acao: 'rascunho' | 'revisar') => page.locator(`[data-acao="${acao}"]`);
const aviso = (page: Page) => page.locator('#cfg-termo-consentimento-anuncio');
const tituloDoTermo = (page: Page) => page.getByRole('heading', { name: TERMO.nome, level: 1 });

async function abrirTermo(page: Page, opcoes: OpcoesDoMock = {}) {
  const mock = await mockTermosConsentimento(page, opcoes);
  await page.goto(`/termos-consentimento/${ID}`);
  await expect(page.getByRole('button', { name: 'Salvar rascunho' })).toBeVisible();
  return mock;
}

test.describe('Termo de consentimento — rascunho e ações', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('envio pendente deixa o formulário somente leitura, mantém o foco e não reenvia', async ({
    page,
  }) => {
    const { liberar, envios } = await abrirTermo(page);
    const texto = page.locator('textarea[formcontrolname="texto"]');
    await texto.fill('Texto revisado.');
    const salvar = botaoDe(page, 'rascunho');
    await salvar.click();
    await expect(salvar).toHaveText('Salvando...');
    await expect(texto).toBeDisabled();
    await expect(texto).toHaveValue('Texto revisado.');
    await expect(salvar).toBeFocused();
    await expect(salvar).toHaveAttribute('aria-disabled', 'true');
    await expect(salvar).toHaveAttribute('aria-busy', 'true');
    await expect(salvar).toHaveCSS('cursor', 'not-allowed');
    await expect(aviso(page)).toHaveText('Salvando o rascunho.');
    await expect(page.getByRole('link', { name: 'Voltar à lista' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    for (const nome of ['Marcar como revisado', 'Remover']) {
      await expect(page.getByRole('button', { name: nome, exact: true })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    }
    await salvar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await page.keyboard.press('Escape');
    expect(envios).toEqual(['PUT :id/rascunho']);
    liberar();
    await expect(page.getByText('Rascunho salvo')).toBeVisible();
    await expect(salvar).toHaveAttribute('aria-disabled', 'true');
    await expect(texto).toBeEnabled({ timeout: 10_000 });
    await expect(salvar).toHaveText('Salvar rascunho');
    await expect(salvar).toBeFocused();
    await expect(aviso(page)).toHaveText('');
  });

  test('recusa do servidor marca o campo e leva o foco a ele', async ({ page }) => {
    const { liberar } = await abrirTermo(page, {
      respostas: [{ status: 422, corpo: RECUSA_DO_TEXTO }],
    });
    await page.getByRole('button', { name: 'Salvar rascunho' }).click();
    liberar();
    const texto = page.locator('textarea[formcontrolname="texto"]');
    await expect(texto).toBeEnabled();
    await expect(texto).toBeFocused();
    await expect(texto).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Texto fora do tamanho permitido.')).toBeVisible();
  });

  test('Enter num campo leva o foco ao botão e, na falha 500, o envio segue disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await abrirTermo(page, {
      respostas: [{ status: 500, corpo: ERRO_INTERNO }],
    });
    const base = page.locator('input[formcontrolname="baseLegal"]');
    await base.focus();
    await page.keyboard.press('Enter');
    await expect(base).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar();
    await expect(page.getByText('Erro interno').first()).toBeVisible();
    await expect(base).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Salvar rascunho' })).toBeFocused();
    expect(envios).toEqual(['PUT :id/rascunho']);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await abrirTermo(page);
    const base = page.locator('input[formcontrolname="baseLegal"]');
    await base.fill('x'.repeat(501));
    await page.getByRole('button', { name: 'Salvar rascunho' }).focus();
    await page.keyboard.press('Enter');
    await expect(base).toBeFocused();
    await expect(base).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('revisar concluído mantém o foco no botão durante e depois da releitura atrasada', async ({
    page,
  }) => {
    const { liberar, envios } = await abrirTermo(page, { termoApos: TERMO_REVISADO });
    const revisar = botaoDe(page, 'revisar');
    await revisar.click();
    await expect(revisar).toBeFocused();
    await expect(revisar).toHaveAttribute('aria-disabled', 'true');
    await expect(revisar).toHaveCSS('cursor', 'not-allowed');
    await revisar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    expect(envios).toEqual(['POST :id/revisar']);
    liberar();
    await expect(page.getByText(/Revisado em/)).toBeVisible({ timeout: 10_000 });
    await expect(revisar).not.toHaveAttribute('aria-disabled', 'true');
    await expect(revisar).toBeFocused();
  });

  test('promover concluído devolve o foco ao título porque o botão deixa de estar disponível', async ({
    page,
  }) => {
    const { liberar } = await abrirTermo(page, {
      termo: TERMO_REVISADO,
      termoApos: TERMO_PROMOVIDO,
    });
    await page.getByRole('button', { name: 'Promover a versão' }).click();
    liberar();
    await expect(page.getByText('Nova versão promovida')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Promover a versão' })).toBeDisabled({
      timeout: 10_000,
    });
    await expect(tituloDoTermo(page)).toBeFocused();
  });

  test('releitura com falha após a ação leva o foco ao título e "Tentar novamente" recupera', async ({
    page,
  }) => {
    const { liberar } = await abrirTermo(page, { releitura: 'com-falha' });
    await page.getByRole('button', { name: 'Marcar como revisado' }).click();
    liberar();
    const alerta = page.getByText('Não foi possível carregar o termo');
    await expect(alerta).toBeVisible({ timeout: 10_000 });
    await expect(tituloDoTermo(page)).toBeFocused();
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.focus();
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
  });

  test('conflito de concorrência bloqueia revisar e, ao recarregar, leva o foco ao título', async ({
    page,
  }) => {
    const { liberar, envios } = await abrirTermo(page, {
      respostas: [{ status: 409, corpo: CONFLITO_DE_CONCORRENCIA }],
    });
    await botaoDe(page, 'revisar').click();
    liberar();
    const recarregar = page.getByRole('button', { name: 'Recarregar dados' });
    await expect(recarregar).toBeVisible();
    await expect(botaoDe(page, 'revisar')).toBeDisabled();
    await expect(page.getByText('Recarregue os dados antes de continuar.').first()).toBeAttached();
    await recarregar.click();
    await expect(page.getByRole('button', { name: 'Salvar rascunho' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(tituloDoTermo(page)).toBeFocused();
    await expect(botaoDe(page, 'revisar')).toBeEnabled();
    expect(envios).toEqual(['POST :id/revisar']);
  });

  test('recarregar com texto digitado pede confirmação; cancelar mantém o texto e o foco', async ({
    page,
  }) => {
    const { liberar } = await abrirTermo(page, {
      respostas: [{ status: 409, corpo: CONFLITO_DE_CONCORRENCIA }],
    });
    const texto = page.locator('textarea[formcontrolname="texto"]');
    await texto.fill('Texto ainda não salvo.');
    await botaoDe(page, 'revisar').click();
    liberar();
    const recarregar = page.getByRole('button', { name: 'Recarregar dados' });
    await recarregar.click();
    const dialogo = page.getByRole('dialog', { name: 'Descartar as alterações não salvas?' });
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toContainText('As alterações não salvas serão descartadas');
    await dialogo.getByRole('button', { name: 'Continuar editando' }).click();
    await expect(dialogo).toBeHidden();
    await expect(texto).toHaveValue('Texto ainda não salvo.');
    await expect(recarregar).toBeFocused();
    await recarregar.click();
    await dialogo.getByRole('button', { name: 'Descartar e recarregar' }).click();
    await expect(texto).toHaveValue(TERMO.textoRascunho, { timeout: 10_000 });
    await expect(tituloDoTermo(page)).toBeFocused();
  });

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockTermosConsentimento(page, { primeiraLeitura: 'falha' });
    await page.goto(`/termos-consentimento/${ID}`);
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('button', { name: 'Salvar rascunho' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(tituloDoTermo(page)).toBeFocused();
  });
});

test.describe('Termo de consentimento — criação', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('criação pendente deixa o formulário somente leitura e, ao concluir, abre o termo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockTermosConsentimento(page, {
      respostas: [{ status: 201 }],
    });
    await page.goto('/termos-consentimento/novo');
    const nome = page.locator('input[formcontrolname="nome"]');
    await expect(nome).toHaveAttribute('aria-required', 'true');
    await nome.fill(TERMO.nome);
    await page.getByRole('button', { name: 'Criar termo' }).click();
    const criar = page.getByRole('button', { name: 'Criando...' });
    await expect(nome).toBeDisabled();
    await expect(nome).toHaveValue(TERMO.nome);
    await expect(criar).toBeFocused();
    await expect(criar).toHaveAttribute('aria-disabled', 'true');
    await expect(criar).toHaveCSS('cursor', 'not-allowed');
    await expect(aviso(page)).toHaveText('Criando o termo.');
    await criar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(envios).toEqual(['POST']);
    liberar();
    await expect(page).toHaveURL(new RegExp(`/termos-consentimento/${ID}$`));
    await expect(tituloDoTermo(page)).toBeFocused();
  });

  test('recusa do servidor marca o nome e leva o foco a ele', async ({ page }) => {
    const { liberar } = await mockTermosConsentimento(page, {
      respostas: [{ status: 422, corpo: RECUSA_DO_NOME }],
    });
    await page.goto('/termos-consentimento/novo');
    const nome = page.locator('input[formcontrolname="nome"]');
    await nome.fill(TERMO.nome);
    await page.getByRole('button', { name: 'Criar termo' }).click();
    liberar();
    await expect(nome).toBeEnabled();
    await expect(nome).toBeFocused();
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Nome fora do tamanho permitido.')).toBeVisible();
  });

  test('Enter no nome leva o foco ao botão e, na falha 500, o envio segue disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockTermosConsentimento(page, {
      respostas: [{ status: 500, corpo: ERRO_INTERNO }],
    });
    await page.goto('/termos-consentimento/novo');
    const nome = page.locator('input[formcontrolname="nome"]');
    await nome.fill(TERMO.nome);
    await page.keyboard.press('Enter');
    await expect(nome).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Criando...' })).toBeFocused();
    liberar();
    await expect(page.getByText('Erro interno').first()).toBeVisible();
    await expect(nome).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Criar termo' })).toBeFocused();
    expect(envios).toEqual(['POST']);
  });

  test('envio barrado localmente leva o foco ao nome', async ({ page }) => {
    const { envios } = await mockTermosConsentimento(page);
    await page.goto('/termos-consentimento/novo');
    await page.getByRole('button', { name: 'Criar termo' }).focus();
    await page.keyboard.press('Enter');
    const nome = page.locator('input[formcontrolname="nome"]');
    await expect(nome).toBeFocused();
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });
});
