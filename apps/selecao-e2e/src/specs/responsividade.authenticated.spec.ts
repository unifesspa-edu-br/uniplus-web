import { test, expect } from '@playwright/test';

/**
 * Comportamentos que dependem de uma largura específica e da transição entre
 * elas. Ficam fora da matriz do DS — que fixa a viewport por project — para
 * poderem controlar o próprio redimensionamento.
 */
test.describe('Seleção — comportamento por largura', () => {
  /**
   * Girar o aparelho ou mudar o zoom com a lista de etapas aberta não pode
   * deixar o diálogo fora da tela com o scroll travado: ele precisa continuar
   * visível e fechável na largura nova.
   */
  test('mantém a lista de etapas utilizável ao alargar a viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('/processo-seletivo/novo');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.getByRole('button', { name: 'Abrir lista de etapas' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Etapas do cadastro' });
    await expect(dialogo).toBeVisible();

    await page.setViewportSize({ width: 1366, height: 900 });

    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('button', { name: 'Fechar lista de etapas' }).click();
    await expect(dialogo).toBeHidden();

    // O bloqueio é liberado no evento `close`, que chega depois do clique.
    await expect
      .poll(() => page.evaluate(() => document.body.classList.contains('sel-overlay-open')))
      .toBe(false);
  });

  test('usa a área útil inteira no shell administrativo em telas grandes', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const medida = await page.evaluate(() => {
      const conteudo = document.querySelector('main.page');
      if (!(conteudo instanceof HTMLElement)) return null;
      const estilo = getComputedStyle(conteudo);
      return { teto: estilo.maxWidth, padding: estilo.paddingLeft };
    });

    expect(medida).not.toBeNull();
    // Sem teto de leitura na área de trabalho administrativa (#584).
    expect(medida?.teto).toBe('none');
    expect(medida?.padding).toBe('32px');
  });
});
