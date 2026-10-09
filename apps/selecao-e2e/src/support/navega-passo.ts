import { expect, Page, TestInfo } from '@playwright/test';

/** Abaixo desta largura o stepper lateral dá lugar à barra com diálogo. */
export const LARGURA_STEPPER_LATERAL = 768;

/**
 * Abaixo de 768 px o stepper lateral dá lugar à barra de etapas com diálogo, e o caminho
 * até um passo muda com ele.
 */
export async function irAoPasso(page: Page, rotulo: string, testInfo: TestInfo): Promise<void> {
  const largura = larguraDoProjeto(testInfo);

  if (largura >= LARGURA_STEPPER_LATERAL) {
    await page.locator('.wiz-nav').getByRole('button', { name: rotulo }).click();
    return;
  }

  await page.getByRole('button', { name: 'Abrir lista de etapas' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Etapas do cadastro' });
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole('button', { name: rotulo }).click();
  await expect(dialogo).toBeHidden();
}

export function larguraDoProjeto(testInfo: TestInfo): number {
  const largura = testInfo.project.use.viewport?.width;
  if (largura === undefined) {
    throw new Error(`Project ${testInfo.project.name} não declara viewport.`);
  }
  return largura;
}
