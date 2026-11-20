import { expect, type Page } from '@playwright/test';

export async function assertReflowContract(page: Page): Promise<void> {
  expect(await horizontalOverflow(page)).toEqual([]);

  const viewportWidth =
    page.viewportSize()?.width ?? (await page.evaluate(() => window.innerWidth));
  if (viewportWidth <= 340) {
    await assertNavigationUsable(page);
  } else if (viewportWidth >= 1024) {
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
  }
}

/**
 * O shell que trava a altura rola o conteúdo por dentro: o documento nunca fica mais alto que a
 * janela. Um descendente posicionado que escapa da área de rolagem estica a página e cria uma
 * segunda rolagem.
 */
export async function assertDocumentoSemRolagemVertical(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1,
      ),
    )
    .toBe(true);
}

export interface ExcessoHorizontal {
  readonly selector: string;
  readonly scrollWidth: number;
  readonly clientWidth: number;
}

export async function horizontalOverflow(page: Page): Promise<readonly ExcessoHorizontal[]> {
  const medidas = await Promise.all([excessoDe(page, 'html'), excessoDe(page, 'body')]);
  return medidas.filter((medida) => medida !== null);
}

async function excessoDe(page: Page, elemento: 'html' | 'body'): Promise<ExcessoHorizontal | null> {
  return page.evaluate((selector) => {
    const raiz = document.documentElement;
    const medido = selector === 'html' ? raiz : document.body;
    if (medido.scrollWidth <= raiz.clientWidth + 1) return null;
    return { selector, scrollWidth: medido.scrollWidth, clientWidth: raiz.clientWidth };
  }, elemento);
}

/**
 * Só abre a gaveta do menu quando o shell expõe um botão "Abrir menu" (padrão do shell
 * administrativo). Um shell público sem gaveta, como o do portal, só precisa manter a <nav>
 * "Navegação principal" visível e sem overflow.
 */
export async function assertNavigationUsable(page: Page): Promise<void> {
  const menuButton = page.getByRole('button', { name: 'Abrir menu', exact: true });
  if (await menuButton.isVisible()) {
    await assertDrawerNavigation(page);
    return;
  }

  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
}

async function assertDrawerNavigation(page: Page): Promise<void> {
  const menuButton = page.getByRole('button', { name: 'Abrir menu', exact: true });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(page.locator('dialog.uni-drawer[open]')).toBeVisible();
  await expect(
    page.locator('dialog.uni-drawer').getByRole('navigation', {
      name: 'Navegação principal',
    }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog.uni-drawer')).toHaveCount(0);
}
