import { test, expect } from '@playwright/test';

test.describe('Editais — CRUD', () => {
  test('deve exibir a listagem de editais', async ({ page }) => {
    await page.goto('/editais');
    await expect(page.locator('h2')).toContainText('Editais');
  });
});
