import { expect, type Page, type TestInfo } from '@playwright/test';
import { irAoPasso } from './navega-passo';

/** Simula o quadro de vagas, que a publicação confere antes de aceitar o processo. */
export async function simularOQuadroDeVagas(page: Page, testInfo: TestInfo): Promise<void> {
  await irAoPasso(page, 'Vagas', testInfo);
  await page.getByRole('button', { name: 'Simular o quadro' }).click();
  await expect(page.getByRole('button', { name: 'Simular o quadro' })).toBeEnabled();
}

/** Preenche o ato do edital com o único órgão e a única série do cenário. */
async function preencherOAto(page: Page): Promise<void> {
  await page.getByLabel('Tipo de ato').selectOption({ index: 1 });
  await page.getByLabel('Órgão').fill('CEPS/Unifesspa');
  await page.getByLabel('Série').fill('Edital de abertura');
  await page.getByLabel('Ano').fill('2027');
  await page.getByLabel('Data do ato').fill('2027-01-15');
  await page.getByLabel('Assinante').fill('Reitor da Unifesspa');
}

/** Vai à Revisão, preenche o ato e confirma a publicação; a resposta do servidor fica para o teste. */
export async function publicarPelaRevisao(page: Page, testInfo: TestInfo): Promise<void> {
  await irAoPasso(page, 'Revisão e publicação', testInfo);
  await preencherOAto(page);
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await page.getByRole('button', { name: 'Publicar processo' }).click();
}
