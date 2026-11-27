import { expect, type Page, type TestInfo } from '@playwright/test';
import { irAoPasso } from './navega-passo';

const AVISO_DE_PENDENTE = /serão gravados quando você gravar os Formulários/;
const PENDENCIA_NA_REVISAO = 'Documentos exigidos ainda não gravados';

export async function abrirOAssistente(page: Page, processoId: string): Promise<void> {
  await page.goto(`/processo-seletivo/${processoId}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

export async function abrirAFaseDeInscricao(page: Page, testInfo: TestInfo): Promise<void> {
  await irAoPasso(page, 'Cronograma', testInfo);
  await page.locator('.fase-alternar').filter({ hasText: 'Inscrição' }).first().click();
  await expect(page.getByLabel('Documento a exigir')).toBeVisible();
}

/** Declara o documento pelo nome do catálogo, com a norma que a exigência pede para decidir o resultado. */
export async function exigirDocumentoComNorma(page: Page, nome: string): Promise<void> {
  await page.getByLabel('Documento a exigir').fill(nome);
  await page.getByRole('option', { name: nome, exact: true }).click();
  await page.getByRole('button', { name: 'Acrescentar documento' }).click();
  await abrirOsCamposDoDocumento(page, nome);
  await page.getByLabel('Norma que exige o documento').first().fill('Edital sintético de teste');
  await page.getByLabel('Identificação da norma').first().selectOption({ label: 'Resolvida' });
}

async function abrirOsCamposDoDocumento(page: Page, nome: string): Promise<void> {
  const alternar = page.locator('.doc-conferencia__alternar').filter({ hasText: nome });
  if ((await alternar.getAttribute('aria-expanded')) !== 'true') await alternar.click();
}

export async function gravarEAvancar(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Gravar e avançar|Próximo/ }).click();
  await expect(page.getByText('Salvando…')).toBeHidden({ timeout: 30_000 });
}

export async function conferirAvisoDeDocumentosPendentes(
  page: Page,
  testInfo: TestInfo,
): Promise<void> {
  await irAoPasso(page, 'Cronograma', testInfo);
  await expect(page.getByText(AVISO_DE_PENDENTE)).toBeVisible();
}

/** O formulário de inscrição, da fase de inscrição, começado vazio. */
export async function acrescentarFormularioDeInscricao(page: Page, codigo: string): Promise<void> {
  await page.getByLabel('Fase em que o candidato responde').selectOption({ label: 'Inscrição' });
  await page.getByLabel('Código do formulário').fill(codigo);
  await page.getByRole('button', { name: 'Acrescentar formulário' }).click();
}

export async function conferirRevisaoSemOBloqueioDeDocumentos(
  page: Page,
  testInfo: TestInfo,
): Promise<void> {
  await irAoPasso(page, 'Revisão e publicação', testInfo);
  await expect(page.getByRole('heading', { level: 1, name: /Revisão/ })).toBeVisible();
  await expect(page.getByText(PENDENCIA_NA_REVISAO)).toHaveCount(0);
}
