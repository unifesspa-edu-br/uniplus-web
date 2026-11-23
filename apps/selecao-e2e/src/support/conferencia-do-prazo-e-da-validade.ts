import { expect, type Page } from '@playwright/test';
import type { ExigenciasGravadas } from './api-das-exigencias-do-processo';
import { conferirAcessibilidade, tabularAte } from './cenario-das-regras-de-comprovacao';

export async function abrirDocumento(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'RG', exact: true }).click();
}

export async function preencherPrazo(page: Page): Promise<void> {
  await page.getByLabel('Com prazo', { exact: true }).check();
  await page.getByLabel('Prazo', { exact: true }).fill('30');
  await page.getByLabel('Unidade do prazo').selectOption('dias');
  await page.getByLabel('Data de referência').selectOption('fimDasInscricoes');
  await page.getByLabel('Efeito fora do prazo').selectOption('recusarDocumento');
}

export async function gravarExigencias(page: Page, gravadas: ExigenciasGravadas) {
  await page.getByRole('button', { name: /Gravar e avançar/ }).click();
  await expect.poll(() => gravadas.corpos.length).toBeGreaterThan(0);
  return gravadas.corpos.at(-1)?.[0].documento?.requisitos;
}

export function recusarValorDoPrazo(gravadas: ExigenciasGravadas): void {
  gravadas.codigoDaRecusa = 'uniplus.selecao.prazo_de_emissao.valor_invalido';
  gravadas.campoDaRecusa = 'regrasDeComprovacao[0].documento.requisitos.prazoDeEmissao.valor';
  gravadas.mensagemDaRecusa = 'Valor do prazo inválido.';
}

export async function conferirRecusaDoPrazo(page: Page): Promise<void> {
  const prazo = page.getByLabel('Prazo', { exact: true });
  const recusa = page.locator('[id$="-valor-recusas"]').getByText('Valor do prazo inválido.');
  await expect(recusa).toBeVisible();
  await expect(prazo).toHaveAttribute('aria-invalid', 'true');
  await conferirAcessibilidade(page);
  await prazo.fill('31');
  await expect(recusa).toBeHidden();
  await expect(prazo).not.toHaveAttribute('aria-invalid', 'true');
  await conferirAcessibilidade(page);
}

export async function escolherPrazoPeloTeclado(page: Page): Promise<void> {
  const abrir = page.getByRole('button', { name: 'RG', exact: true });
  await tabularAte(page, abrir);
  await page.keyboard.press('Enter');
  const escolha = page.getByLabel('Com prazo', { exact: true });
  await tabularAte(page, page.getByLabel('Sem prazo', { exact: true }));
  await page.keyboard.press('ArrowDown');
  await expect(escolha).toBeChecked();
  await tabularAte(page, page.getByLabel('Prazo', { exact: true }));
  await page.keyboard.type('30');
  await expect(page.getByLabel('Prazo', { exact: true })).toHaveValue('30');
}
