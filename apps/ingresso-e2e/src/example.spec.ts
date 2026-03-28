import { test, expect } from '@playwright/test';

test('deve carregar a página inicial', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Ingresso');
});

test('deve navegar para chamadas', async ({ page }) => {
  await page.goto('/chamadas');
  await expect(page.locator('h2')).toContainText('Chamadas');
});
