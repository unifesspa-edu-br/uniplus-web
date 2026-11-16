import { expect, type Page } from '@playwright/test';
import { mockarCatalogos } from '../fixtures/catalogos-da-etapa-da-fase';

/**
 * Abre o Cronograma de um processo novo com a fase de Habilitação já acrescentada e aberta: a
 * fase entra fechada — a linha do tempo mostra os cabeçalhos, e configurar é abrir.
 */
export async function abrirFaseDeHabilitacao(page: Page): Promise<void> {
  await mockarCatalogos(page);
  await page.goto('/processo-seletivo/novo');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Cronograma' }).first().click();
  await expect(page.getByLabel('Fase do catálogo')).toBeVisible();

  await page.getByLabel('Fase do catálogo').selectOption({ label: 'Habilitação' });
  await page.getByRole('button', { name: 'Acrescentar à linha do tempo' }).click();
  await page.locator('.fase-alternar').first().click();
}

/**
 * Abre um dos blocos que a etapa traz recolhidos — as janelas recursais e as publicações
 * crescem com o que se declara nelas, e chegam contadas no cabeçalho.
 */
export async function abrirBloco(page: Page, titulo: string): Promise<void> {
  await page.locator('.etapa-publica__cabecalho', { hasText: titulo }).first().click();
}

/**
 * Escolhe um documento no campo de busca: digitar filtra a lista, e a opção é escolhida com
 * o teclado — é o caminho de quem usa a tela, e o controle não é um `select` nativo.
 */
export async function escolherDocumento(page: Page, nome: string): Promise<void> {
  await page.getByLabel('Documento a exigir').fill(nome);
  await page.getByRole('option', { name: nome, exact: true }).click();
}

/**
 * Acrescenta uma etapa à fase aberta e a expande — ela entra fechada, resumida numa linha,
 * porque aberta passa de mil pixels e oito delas enterravam o passo em rolagem.
 */
export async function acrescentarEtapa(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Acrescentar etapa nesta fase' }).click();
  await page.locator('.etapa-resumo').last().click();
}

/**
 * O bloco da ETAPA, não o da fase: a configuração da fase vive na mesma tela e tem campos
 * de rótulo idêntico — `Ato`, `Papel` —, então o escopo é o que separa os dois.
 */
export function blocoDaEtapa(page: Page, titulo: string) {
  return page.locator('.etapa-publica').filter({ hasText: titulo }).first();
}
