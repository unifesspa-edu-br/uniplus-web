import { expect, type Page } from '@playwright/test';

export async function conferirUltimaLinhaEPaginacao(page: Page): Promise<void> {
  await page.getByRole('table').hover();
  for (let giro = 0; giro < 10; giro++) {
    await page.mouse.wheel(0, 2000);
  }
  await expect(page.locator('tbody tr').last()).toBeInViewport();
  const proxima = page.locator('[data-pager="next"]');
  await expect(proxima).toBeInViewport();
  await expect(proxima).toBeEnabled();
}
