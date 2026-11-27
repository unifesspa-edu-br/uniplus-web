import { expect, type Locator, type Page } from '@playwright/test';

export const campo = (drawer: Locator, nome: string) =>
  drawer.locator(`[formcontrolname="${nome}"]`);

export async function abrirFormulario(
  page: Page,
  caminho: string,
  nomeDoFormulario: string,
  abrir: () => Promise<void>,
): Promise<Locator> {
  await page.goto(caminho);
  await abrir();
  const drawer = page.getByRole('dialog', { name: nomeDoFormulario });
  await expect(drawer).toBeVisible();
  return drawer;
}

export async function pedirConfirmacaoDeRemocao(
  page: Page,
  caminho: string,
  nomeDoDialogo: RegExp,
  lixeira: Locator,
): Promise<{ dialogo: Locator; confirmar: Locator }> {
  await page.goto(caminho);
  await lixeira.click();
  const dialogo = page.getByRole('dialog', { name: nomeDoDialogo });
  return { dialogo, confirmar: dialogo.getByTestId('confirm-dialog-confirm') };
}
