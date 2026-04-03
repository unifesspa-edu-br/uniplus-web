import { test, expect } from '@playwright/test';

test('deve carregar a página inicial', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Seleção');
});

test('deve navegar para editais', async ({ page }) => {
  await page.goto('/editais');
  await expect(page.locator('h2')).toContainText('Editais');
});
