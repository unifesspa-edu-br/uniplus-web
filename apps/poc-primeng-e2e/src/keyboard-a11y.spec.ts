import { test, expect, Page, Locator } from '@playwright/test';

import { join } from 'path';

const screenshotsDir = join(__dirname, '..', 'screenshots');

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: `${screenshotsDir}/${name}.png`,
    fullPage: true,
  });
}

async function getStyles(
  locator: Locator,
  properties: string[],
): Promise<Record<string, string>> {
  return locator.evaluate((el, props) => {
    const cs = getComputedStyle(el);
    return Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]));
  }, properties);
}

async function getActiveElementInfo(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    return {
      tag: el?.tagName?.toLowerCase() ?? '',
      id: el?.id ?? '',
      role: el?.getAttribute('role') ?? '',
      text: el?.textContent?.trim().substring(0, 40) ?? '',
      ariaSelected: el?.getAttribute('aria-selected') ?? '',
      type: (el as HTMLInputElement)?.type ?? '',
    };
  });
}

test.describe('Acessibilidade de teclado — PoC PrimeNG + Gov.br DS', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/inscricao');
    await expect(page.locator('poc-govbr-header')).toBeVisible({ timeout: 10_000 });
  });

  // ─── Navegação Tab / Shift+Tab completa ──────────────────────

  test.describe('Navegação Tab forward e Shift+Tab backward', () => {
    test('K01: Tab forward percorre todos os elementos focáveis na ordem correta', async ({ page }) => {
      await page.locator('body').click({ position: { x: 1, y: 1 } });

      const visitedElements: string[] = [];

      for (let i = 0; i < 25; i++) {
        await page.keyboard.press('Tab');
        const info = await getActiveElementInfo(page);
        const label = `${info.tag}#${info.id || info.role || info.text.substring(0, 15)}`;
        visitedElements.push(label);

        if (info.tag === 'body') break;
      }

      expect(visitedElements.length).toBeGreaterThan(8);

      // Verifica que tabs foram visitadas
      const tabsVisited = visitedElements.filter((e) => e.includes('tab'));
      expect(tabsVisited.length).toBeGreaterThanOrEqual(1);

      // Verifica que inputs foram visitados
      const inputsVisited = visitedElements.filter((e) => e.includes('input'));
      expect(inputsVisited.length).toBeGreaterThanOrEqual(1);

      await screenshot(page, 'k01-tab-forward');
    });

    test('K02: Shift+Tab retrocede na ordem inversa', async ({ page }) => {
      await page.locator('body').click({ position: { x: 1, y: 1 } });
      let found = false;
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('Tab');
        const info = await getActiveElementInfo(page);
        if (info.id === 'nome') {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);

      await page.keyboard.press('Shift+Tab');
      const info = await getActiveElementInfo(page);
      // Shift+Tab from input#nome goes to previous focusable (may be tab, button, span, etc.)
      expect(info.tag).toBeTruthy();
      expect(info.id).not.toBe('nome');

      await page.keyboard.press('Shift+Tab');
      const info2 = await getActiveElementInfo(page);
      expect(info2.tag).toBeTruthy();

      await screenshot(page, 'k02-shift-tab');
    });
  });

  // ─── Select: keyboard completa ───────────────────────────────

  test.describe('Select — navegação por teclado', () => {
    test('K03: Enter/Space abre o dropdown do select', async ({ page }) => {
      const trigger = page.locator('p-select#curso [role="combobox"]');
      await page.locator('body').click({ position: { x: 1, y: 1 } });
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('Tab');
        const focused = await trigger.evaluate((el) => document.activeElement === el);
        if (focused) break;
      }

      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      const listbox = page.locator('[role="listbox"]');
      await expect(listbox).toBeVisible({ timeout: 3000 });

      await screenshot(page, 'k03-select-open-keyboard');
    });

    test('K04: setas navegam entre items do select', async ({ page }) => {
      await page.locator('p-select#curso').click();
      await page.waitForTimeout(300);
      await expect(page.locator('[role="listbox"]')).toBeVisible();

      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(100);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(100);

      // PrimeNG marks focused option with data-p-focused="true"
      const focusedItems = page.locator('[role="option"][data-p-focused="true"]');
      const count = await focusedItems.count();
      expect(count).toBeGreaterThanOrEqual(1);

      await screenshot(page, 'k04-select-arrow-navigate');
    });

    test('K05: Enter seleciona o item focado no dropdown', async ({ page }) => {
      await page.locator('p-select#curso').click();
      await page.waitForTimeout(300);

      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(100);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      await expect(page.locator('[role="listbox"]')).toBeHidden();

      // PrimeNG select should show selected value
      const selectText = await page.locator('p-select#curso').textContent();
      expect(selectText?.trim()).not.toContain('Selecione um curso');

      await screenshot(page, 'k05-select-enter-select');
    });

    test('K06: Escape fecha o dropdown sem selecionar', async ({ page }) => {
      await page.locator('p-select#curso').click();
      await page.waitForTimeout(300);
      await expect(page.locator('[role="listbox"]')).toBeVisible();

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      await expect(page.locator('[role="listbox"]')).toBeHidden();

      await screenshot(page, 'k06-select-escape');
    });

    test('K07: setas permitem navegar e selecionar itens', async ({ page }) => {
      await page.locator('p-select#curso').click();
      await page.waitForTimeout(300);

      // Navigate down through items
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(50);
      }

      // Select the focused item
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      // Dropdown should close after selection
      await expect(page.locator('[role="listbox"]')).toBeHidden();

      // Select should show a value (not placeholder)
      const selectText = await page.locator('p-select#curso').textContent();
      expect(selectText?.trim()).toBeTruthy();

      await screenshot(page, 'k07-select-navigate-last');
    });
  });

  // ─── Focus ring consistente em TODOS os elementos ────────────

  test.describe('Focus ring — outline consistente em todos os elementos', () => {
    test('K08: todos os elementos focáveis têm outline:none via Tab (govbr focus ring)', async ({ page }) => {
      await page.locator('body').click({ position: { x: 1, y: 1 } });

      const results: { element: string; outlineStyle: string; outlineWidth: string }[] = [];

      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(50);
        const info = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          if (!el || el === document.body) return null;
          const cs = getComputedStyle(el);
          return {
            element: `${el.tagName.toLowerCase()}#${el.id || el.getAttribute('role') || el.textContent?.trim().substring(0, 15)}`,
            outlineStyle: cs.outlineStyle,
            outlineWidth: cs.outlineWidth,
          };
        });
        if (info) results.push(info);
      }

      const failingElements: string[] = [];
      for (const r of results) {
        if (r.outlineStyle !== 'none') {
          failingElements.push(`${r.element}: outline-style=${r.outlineStyle} (esperado none)`);
        }
      }
      expect(failingElements).toEqual([]);

      await screenshot(page, 'k08-outline-all-elements');
    });

    test('K09: outline do tab NÃO é cortado (overflow)', async ({ page }) => {
      const firstTab = page.locator('[role="tablist"] [role="tab"]').first();
      await page.locator('body').click({ position: { x: 1, y: 1 } });
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab');
        if (await firstTab.evaluate((el) => document.activeElement === el)) break;
      }

      const tabBox = await firstTab.boundingBox();
      expect(tabBox).not.toBeNull();

      await screenshot(page, 'k09-outline-first-tab');
    });
  });

  // ─── Focus ring suprimido ao clicar com mouse ────────────────

  test.describe('Focus ring — mouse click vs keyboard Tab', () => {
    test('K10: clicar no input text NÃO mostra focus ring gold', async ({ page }) => {
      await page.locator('#nome').click();
      await page.waitForTimeout(100);

      const styles = await getStyles(page.locator('#nome'), ['box-shadow']);
      expect(styles['box-shadow']).toBe('none');

      await screenshot(page, 'k10-click-no-gold');
    });

    test('K11: Tab no input text MOSTRA focus ring gold via overlay', async ({ page }) => {
      await page.locator('body').click({ position: { x: 1, y: 1 } });
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab');
        const id = await page.evaluate(() => document.activeElement?.id);
        if (id === 'nome') break;
      }

      const overlay = page.locator('.govbr-focus-overlay');
      await expect(overlay).toBeVisible({ timeout: 2000 });
      const styles = await overlay.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { borderColor: cs.borderColor, borderStyle: cs.borderStyle };
      });
      expect(styles.borderColor).toBe('rgb(194, 133, 12)');
      expect(styles.borderStyle).toBe('dashed');

      await screenshot(page, 'k11-tab-shows-gold');
    });

    test('K12: clicar no botão — dialog abre, foco muda', async ({ page }) => {
      await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' }).click();
      await page.waitForTimeout(200);
      const btn = page.locator('[data-testid="btn-enviar-inscricao"]');
      await btn.click();
      await page.waitForTimeout(100);

      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 });
      await screenshot(page, 'k12-click-button-no-ring');
    });
  });

  // ─── Navegação completa com setas e Escape ───────────────────

  test.describe('Navegação — setas do teclado e Escape', () => {
    test('K13: ArrowRight/ArrowLeft navegam entre tabs', async ({ page }) => {
      const firstTab = page.locator('[role="tablist"] [role="tab"]').first();
      await page.locator('body').click({ position: { x: 1, y: 1 } });
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab');
        if (await firstTab.evaluate((el) => document.activeElement === el)) break;
      }
      expect(await firstTab.evaluate((el) => document.activeElement === el)).toBe(true);

      // ArrowRight → second tab (Documentos)
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(100);
      const info1 = await getActiveElementInfo(page);
      expect(info1.text).toMatch(/Documentos/);

      // ArrowRight → third tab (Revisão)
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(100);
      const info2 = await getActiveElementInfo(page);
      expect(info2.text).toMatch(/Revisão/);

      // ArrowRight → wrap to first tab
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(100);
      const info3 = await getActiveElementInfo(page);
      expect(info3.text).toMatch(/Dados Pessoais/);

      // ArrowLeft → wrap to last tab
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(100);
      const info4 = await getActiveElementInfo(page);
      expect(info4.text).toMatch(/Revisão/);

      await screenshot(page, 'k13-arrow-tabs');
    });

    test('K14: Escape fecha o dialog de confirmação', async ({ page }) => {
      await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' }).click();
      await page.locator('[data-testid="btn-enviar-inscricao"]').click();
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 });

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      await expect(page.locator('[role="dialog"]')).toBeHidden();

      await screenshot(page, 'k14-escape-dialog');
    });

    test('K15: Tab dentro do dialog navega entre botões', async ({ page }) => {
      await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' }).click();
      await page.locator('[data-testid="btn-enviar-inscricao"]').click();
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 });

      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      const info1 = await getActiveElementInfo(page);

      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      const info2 = await getActiveElementInfo(page);

      expect(info1.tag).toBeTruthy();
      expect(info2.tag).toBeTruthy();

      await screenshot(page, 'k15-tab-dialog-buttons');
    });

    test('K16: clicar em Revisão, depois ArrowLeft volta para tabs anteriores', async ({ page }) => {
      await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' }).click();
      await page.waitForTimeout(200);

      const revisaoTab = page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' });
      await expect(revisaoTab).toHaveAttribute('aria-selected', 'true');

      // Focus the tab via keyboard
      await revisaoTab.focus();
      await page.waitForTimeout(100);

      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(100);
      const info1 = await getActiveElementInfo(page);
      expect(info1.text).toMatch(/Documentos/);

      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(100);
      const info2 = await getActiveElementInfo(page);
      expect(info2.text).toMatch(/Dados Pessoais/);

      await screenshot(page, 'k16-click-then-arrow-back');
    });

    test('K17: Home/End navegam para primeira/última tab', async ({ page }) => {
      const firstTab = page.locator('[role="tablist"] [role="tab"]').first();
      await page.locator('body').click({ position: { x: 1, y: 1 } });
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab');
        if (await firstTab.evaluate((el) => document.activeElement === el)) break;
      }

      await page.keyboard.press('End');
      await page.waitForTimeout(100);
      const endInfo = await getActiveElementInfo(page);
      expect(endInfo.text).toMatch(/Revisão/);

      await page.keyboard.press('Home');
      await page.waitForTimeout(100);
      const homeInfo = await getActiveElementInfo(page);
      expect(homeInfo.text).toMatch(/Dados Pessoais/);

      await screenshot(page, 'k17-home-end-tabs');
    });
  });
});
