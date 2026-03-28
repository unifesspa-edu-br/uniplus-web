import { test, expect } from '@playwright/test';

test('deve carregar a página inicial', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Portal do Candidato');
});

test('deve navegar para processos seletivos', async ({ page }) => {
  await page.goto('/processos');
  await expect(page.locator('h2')).toContainText('Processos Seletivos');
});
