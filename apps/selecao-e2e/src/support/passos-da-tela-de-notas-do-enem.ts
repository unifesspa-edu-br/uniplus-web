import { expect, type Locator, type Page } from '@playwright/test';
import type { AxeResults } from 'axe-core';
import { ERICK, FERNANDA, HELENA, KEVIN } from '../fixtures/arquivo-do-inep-sintetico';
import { ROTA_DA_TELA } from '../fixtures/notas-do-enem';

/** Passos comuns às especificações da tela de notas do ENEM do processo (UNI-REQ-0174). */

export const INSCRITAS = [FERNANDA, KEVIN, HELENA] as const;

export async function abrir(page: Page): Promise<void> {
  await page.goto(ROTA_DA_TELA);
  await expect(page.getByRole('heading', { level: 1, name: 'Notas do ENEM' })).toBeVisible();
}

export function cartaoDeEnvio(page: Page): Locator {
  return page.getByRole('region', { name: 'Enviar CPFs ao INEP' });
}

export function cartaoDeImportacao(page: Page): Locator {
  return page.getByRole('region', { name: 'Importar o retorno do INEP' });
}

export async function escolherEdicao(
  cartao: Locator,
  titulo: string,
  edicao = '2025',
): Promise<void> {
  await cartao.getByLabel('Edição do ENEM').selectOption(edicao);
  await expect(cartao.getByRole('heading', { name: titulo })).toBeVisible();
  await expect(cartao.getByRole('status').filter({ hasText: 'Carregando' })).toHaveCount(0);
}

/** Com um só leiaute ativo a tela já o escolhe e não mostra o campo; com mais, o operador escolhe. */
export async function escolherLeiauteDeRetorno(page: Page): Promise<void> {
  const campo = cartaoDeImportacao(page).getByLabel('Leiaute do arquivo de retorno');
  if ((await campo.count()) > 0) await campo.selectOption({ index: 1 });
}

export async function escolherArquivo(page: Page, nome: string, conteudo: Buffer): Promise<void> {
  await cartaoDeImportacao(page)
    .locator('input[type="file"]')
    .setInputFiles({ name: nome, mimeType: 'text/plain', buffer: conteudo });
}

export async function semNenhumCpfNaTela(page: Page): Promise<void> {
  const html = await page.content();
  for (const pessoa of [FERNANDA, KEVIN, HELENA, ERICK]) {
    expect(html).not.toContain(pessoa.cpf);
  }
}

export function identificadoresDe(resultado: AxeResults): string[] {
  return resultado.violations.map((violacao) => violacao.id);
}
