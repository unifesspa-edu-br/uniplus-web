import { expect, type Page } from '@playwright/test';

/**
 * Na consulta do passo Formulários, cada campo é uma linha com o nome e, ao lado, a
 * obrigatoriedade em texto de ajuda. Confere que a obrigatoriedade está à vista na linha do campo.
 */
export async function conferirObrigatoriedadeDoCampo(
  page: Page,
  campo: string,
  obrigatoriedade: string,
): Promise<void> {
  const ajuda = page
    .locator('.wiz-content .doc-item')
    .filter({ has: page.getByText(campo, { exact: true }) })
    .locator('.field__hint');
  await expect(ajuda).toBeVisible();
  await expect(ajuda).toContainText(obrigatoriedade);
}

/**
 * Só o passo Formulários tem obrigatoriedade a conferir; nos demais passos nada é verificado.
 * Mantém a escolha fora do corpo do teste.
 */
export async function conferirObrigatoriedadeSeInformada(
  page: Page,
  campo: string,
  obrigatoriedade: string | undefined,
): Promise<void> {
  if (obrigatoriedade) await conferirObrigatoriedadeDoCampo(page, campo, obrigatoriedade);
}
