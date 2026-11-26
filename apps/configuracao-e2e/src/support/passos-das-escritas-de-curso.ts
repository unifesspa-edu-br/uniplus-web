import { expect, type Page } from '@playwright/test';
const BLOQUEIO = 'Não é possível remover um curso referenciado por uma oferta de curso ativa';
const formulario = (page: Page) => page.getByRole('dialog', { name: 'Formulário de curso' });
const confirmacao = (page: Page) => page.getByRole('dialog', { name: 'Remover curso' });
const remover = (page: Page) => page.getByRole('button', { name: 'Remover curso ENG_CIV' });
const tituloDaLista = (page: Page) => page.getByRole('heading', { name: 'Cursos', level: 2 });

async function estadoDoEnvio(page: Page): Promise<void> {
  const drawer = formulario(page);
  const nome = page.locator('input[formcontrolname="nome"]');
  const salvar = drawer.getByRole('button', { name: 'Salvando...' });
  await expect(nome).toBeDisabled();
  await expect(nome).toHaveValue('Direito');
  await expect(salvar).toBeFocused();
  await expect(salvar).toHaveAttribute('aria-disabled', 'true');
  await expect(salvar).toHaveAttribute('aria-busy', 'true');
  await expect(salvar).toHaveCSS('cursor', 'not-allowed');
  await expect(drawer.locator('[role="status"]').first()).toContainText('Salvando');
  await expect(drawer.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  await expect(drawer.getByRole('button', { name: 'Fechar' })).toBeDisabled();
}

export async function verificarEnvioPendente(page: Page, envios: string[]): Promise<void> {
  await estadoDoEnvio(page);
  const drawer = formulario(page);
  const salvar = drawer.getByRole('button', { name: 'Salvando...' });
  await page.keyboard.press('Escape');
  await expect(drawer).toBeVisible();
  await salvar.dispatchEvent('click');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await page.evaluate(() => new Promise((resolver) => requestAnimationFrame(resolver)));
  expect(envios).toEqual(['POST']);
}

export async function verificarRecusaDoNome(page: Page): Promise<void> {
  const drawer = formulario(page);
  const nome = page.locator('input[formcontrolname="nome"]');
  await expect(nome).toBeEnabled();
  await expect(nome).toBeFocused();
  await expect(nome).toHaveAttribute('aria-invalid', 'true');
  await expect(drawer.locator('.field__error')).toHaveText('Nome fora do padrão.');
  await expect(drawer.locator('[role="status"]').first()).toContainText('Revise os campos');
}

async function estadoDaRemocao(page: Page): Promise<void> {
  const dialogo = confirmacao(page);
  const confirmar = dialogo.getByRole('button', { name: 'Remover', exact: true });
  await expect(confirmar).toBeFocused();
  await expect(confirmar).toHaveAttribute('aria-disabled', 'true');
  await expect(confirmar).toHaveCSS('cursor', 'not-allowed');
  await expect(dialogo.locator('[role="status"]')).toContainText('Removendo o curso ENG_CIV');
  await expect(dialogo.getByRole('button', { name: 'Fechar' })).toBeDisabled();
  await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
}

export async function verificarRemocaoPendente(page: Page, envios: string[]): Promise<void> {
  await estadoDaRemocao(page);
  const dialogo = confirmacao(page);
  const confirmar = dialogo.getByRole('button', { name: 'Remover', exact: true });
  await page.keyboard.press('Escape');
  await expect(dialogo).toBeVisible();
  await confirmar.dispatchEvent('click');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await page.evaluate(() => new Promise((resolver) => requestAnimationFrame(resolver)));
  expect(envios).toEqual(['DELETE']);
}

export async function verificarFalhaRemocao(page: Page): Promise<void> {
  const dialogo = confirmacao(page);
  const confirmar = dialogo.getByRole('button', { name: 'Remover', exact: true });
  await expect(dialogo.locator('.field__error')).toHaveText('Erro interno');
  await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
  await expect(confirmar).toBeFocused();
  await expect(tituloDaLista(page)).not.toBeFocused();
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  await expect(remover(page)).toBeFocused();
}

export async function verificarOfertasBloqueadas(page: Page): Promise<void> {
  const dialogo = confirmacao(page);
  const ofertas = page.getByRole('dialog', { name: /Ofertas/ });
  await expect(dialogo).toBeHidden();
  await expect(ofertas).toBeVisible();
  await expect(ofertas.getByText(BLOQUEIO)).toBeVisible();
  await expect(ofertas.getByText('IGE')).toBeVisible();

  await ofertas.getByRole('button', { name: 'Fechar' }).click();
  await expect(ofertas).toBeHidden();
  await expect(remover(page)).toBeFocused();
}

export async function abrirFormularioNovo(page: Page): Promise<void> {
  await page.goto('/cursos');
  await page.locator('#cfg-cursos-novo').click();
  await preencher(page);
}

async function preencher(page: Page): Promise<void> {
  await page.locator('input[formcontrolname="codigo"]').fill('DIR');
  await page.locator('input[formcontrolname="nome"]').fill('Direito');
  await page.locator('input[formcontrolname="grau"]').fill('Bacharelado');
  await page.locator('input[formcontrolname="nivelEnsino"]').fill('Graduação');
}

export async function iniciarCriacaoDeCurso(page: Page, focoNoAcionador: boolean): Promise<void> {
  await page.goto('/cursos');
  const acionador = page.locator('#cfg-cursos-novo');
  if (focoNoAcionador) await acionador.focus();
  await acionador.click();
  await preencher(page);
  if (!focoNoAcionador) await formulario(page).getByRole('button', { name: 'Criar curso' }).focus();
  await formulario(page).getByRole('button', { name: 'Criar curso' }).click();
}

export async function verificarEnvioComErroInterno(page: Page, envios: string[]): Promise<void> {
  const drawer = formulario(page);
  const nome = page.locator('input[formcontrolname="nome"]');
  await expect(drawer.locator('ui-alert').first()).toContainText('Erro interno');
  await expect(nome).toBeEnabled();
  await expect(drawer.getByRole('button', { name: 'Criar curso' })).toBeFocused();
  expect(envios).toEqual(['POST']);
}

export async function verificarAnuncioDeRemocao(page: Page): Promise<void> {
  await expect(page.locator('.sr-only[role="status"]').first()).toHaveText(
    'Curso ENG_CIV removido.',
  );
}

export async function verificarRecargaDasOfertas(page: Page): Promise<void> {
  const ofertas = page.getByRole('dialog', { name: /Ofertas/ });
  const tentar = ofertas.getByRole('button', { name: 'Tentar novamente' });
  await expect(tentar).toBeFocused();
  await expect(tentar).toHaveAttribute('aria-disabled', 'true');
  await expect(ofertas.getByText('IGE')).toBeVisible();
  await expect(tentar).toBeHidden();
  await expect(ofertas.getByRole('button', { name: 'Fechar' })).toBeFocused();
}
