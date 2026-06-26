import { test, expect } from '@playwright/test';

test('serve runtime config do app Configuração', async ({ page }) => {
  const response = await page.goto('/assets/runtime-config.json');

  expect(response?.ok()).toBe(true);
  await expect(page.locator('body')).toContainText('configuracao-web');
  await expect(page.locator('body')).toContainText('http://localhost:5000');
  await expect(page.locator('body')).toContainText('unifesspa');
});
