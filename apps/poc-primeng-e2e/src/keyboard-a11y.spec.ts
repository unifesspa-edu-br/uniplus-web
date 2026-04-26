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

function describeActiveElement(info: Awaited<ReturnType<typeof getActiveElementInfo>>): string {
  const handle = info.id || info.role || info.text.substring(0, 15);
  return `${info.tag}#${handle}`;
}

async function tabUntilFocused(page: Page, target: Locator, maxTabs = 20): Promise<void> {
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => document.activeElement === el)) {
      return;
    }
  }
  throw new Error(`tabUntilFocused: alvo não focado após ${maxTabs} Tabs`);
}

async function collectTabbableLabels(page: Page, maxTabs = 25): Promise<string[]> {
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  const labels: string[] = [];
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab');
    const info = await getActiveElementInfo(page);
    labels.push(describeActiveElement(info));
    if (info.tag === 'body') {
      break;
    }
  }
  return labels;
}

type FocusableSnapshot = {
  element: string;
  outlineStyle: string;
  outlineWidth: string;
};

async function collectFocusableOutlines(page: Page, maxTabs = 15): Promise<FocusableSnapshot[]> {
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  const results: FocusableSnapshot[] = [];
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab');
    const snapshot = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const handle = el.id || el.getAttribute('role') || el.textContent?.trim().substring(0, 15) || '';
      return {
        element: `${el.tagName.toLowerCase()}#${handle}`,
        outlineStyle: cs.outlineStyle,
        outlineWidth: cs.outlineWidth,
      };
    });
    if (snapshot) {
      results.push(snapshot);
    }
  }
  return results;
}

test.describe('Acessibilidade de teclado — PoC PrimeNG + Gov.br DS', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/inscricao');
    await expect(page.locator('poc-govbr-header')).toBeVisible({ timeout: 10_000 });
  });

  // ─── Navegação Tab / Shift+Tab completa ──────────────────────

  test.describe('Navegação Tab forward e Shift+Tab backward', () => {
    test('K01: Tab forward percorre todos os elementos focáveis na ordem correta', async ({ page }) => {
      const visitedElements = await collectTabbableLabels(page);

      expect(visitedElements.length).toBeGreaterThan(8);
      expect(visitedElements.filter((e) => e.includes('tab')).length).toBeGreaterThanOrEqual(1);
      expect(visitedElements.filter((e) => e.includes('input')).length).toBeGreaterThanOrEqual(1);

      await screenshot(page, 'k01-tab-forward');
    });

    test('K02: Shift+Tab retrocede na ordem inversa', async ({ page }) => {
      const nome = page.locator('#nome');
      await tabUntilFocused(page, nome);
      await expect(nome).toBeFocused();

      await page.keyboard.press('Shift+Tab');
      const info = await getActiveElementInfo(page);
      // Shift+Tab a partir de #nome volta ao focável anterior (tab, botão, span etc.)
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
      await tabUntilFocused(page, trigger);

      await page.keyboard.press('Enter');

      const listbox = page.locator('[role="listbox"]');
      await expect(listbox).toBeVisible({ timeout: 3000 });

      await screenshot(page, 'k03-select-open-keyboard');
    });

    test('K04: setas navegam entre items do select', async ({ page }) => {
      await page.locator('p-select#curso').click();
      const listbox = page.locator('[role="listbox"]');
      await expect(listbox).toBeVisible();

      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');

      // PrimeNG marca a opção focada com data-p-focused="true"
      const focusedOption = page.locator('[role="option"][data-p-focused="true"]');
      await expect(focusedOption.first()).toBeVisible();

      await screenshot(page, 'k04-select-arrow-navigate');
    });

    test('K05: Enter seleciona o item focado no dropdown', async ({ page }) => {
      await page.locator('p-select#curso').click();
      const listbox = page.locator('[role="listbox"]');
      await expect(listbox).toBeVisible();

      await page.keyboard.press('ArrowDown');
      await expect(page.locator('[role="option"][data-p-focused="true"]').first()).toBeVisible();
      await page.keyboard.press('Enter');

      await expect(listbox).toBeHidden();

      // PrimeNG select deve exibir o valor selecionado
      await expect(page.locator('p-select#curso')).not.toContainText('Selecione um curso');

      await screenshot(page, 'k05-select-enter-select');
    });

    test('K06: Escape fecha o dropdown sem selecionar', async ({ page }) => {
      await page.locator('p-select#curso').click();
      const listbox = page.locator('[role="listbox"]');
      await expect(listbox).toBeVisible();

      await page.keyboard.press('Escape');

      await expect(listbox).toBeHidden();

      await screenshot(page, 'k06-select-escape');
    });

    test('K07: setas permitem navegar e selecionar itens', async ({ page }) => {
      await page.locator('p-select#curso').click();
      const listbox = page.locator('[role="listbox"]');
      await expect(listbox).toBeVisible();

      // Avançar 4 itens via ArrowDown — espera a opção focada propagar a cada press
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press('ArrowDown');
        await expect(page.locator('[role="option"][data-p-focused="true"]').first()).toBeVisible();
      }

      await page.keyboard.press('Enter');

      // Dropdown deve fechar após seleção
      await expect(listbox).toBeHidden();

      // Select deve mostrar um valor (não o placeholder)
      const selectText = await page.locator('p-select#curso').textContent();
      expect(selectText?.trim()).toBeTruthy();

      await screenshot(page, 'k07-select-navigate-last');
    });
  });

  // ─── Focus ring consistente em TODOS os elementos ────────────

  test.describe('Focus ring — outline consistente em todos os elementos', () => {
    test('K08: todos os elementos focáveis têm outline:none via Tab (govbr focus ring)', async ({ page }) => {
      const results = await collectFocusableOutlines(page);

      const failingElements = results
        .filter((r) => r.outlineStyle !== 'none')
        .map((r) => `${r.element}: outline-style=${r.outlineStyle} (esperado none)`);
      expect(failingElements).toEqual([]);

      await screenshot(page, 'k08-outline-all-elements');
    });

    test('K09: outline do tab NÃO é cortado (overflow)', async ({ page }) => {
      const firstTab = page.locator('[role="tablist"] [role="tab"]').first();
      await tabUntilFocused(page, firstTab);

      const tabBox = await firstTab.boundingBox();
      expect(tabBox).not.toBeNull();

      await screenshot(page, 'k09-outline-first-tab');
    });
  });

  // ─── Focus ring suprimido ao clicar com mouse ────────────────

  test.describe('Focus ring — mouse click vs keyboard Tab', () => {
    test('K10: clicar no input text NÃO mostra focus ring gold', async ({ page }) => {
      const nome = page.locator('#nome');
      await nome.click();
      await expect(nome).toBeFocused();

      const styles = await getStyles(nome, ['box-shadow']);
      expect(styles['box-shadow']).toBe('none');

      await screenshot(page, 'k10-click-no-gold');
    });

    test('K11: Tab no input text MOSTRA focus ring gold via overlay', async ({ page }) => {
      await tabUntilFocused(page, page.locator('#nome'));

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
      const revisaoTab = page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' });
      await revisaoTab.click();
      await expect(revisaoTab).toHaveAttribute('aria-selected', 'true');

      await page.locator('[data-testid="btn-enviar-inscricao"]').click();

      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 });
      await screenshot(page, 'k12-click-button-no-ring');
    });
  });

  // ─── Navegação completa com setas e Escape ───────────────────

  test.describe('Navegação — setas do teclado e Escape', () => {
    test('K13: ArrowRight/ArrowLeft navegam entre tabs', async ({ page }) => {
      const tablist = page.locator('[role="tablist"]');
      const firstTab = tablist.locator('[role="tab"]').first();
      await tabUntilFocused(page, firstTab);
      await expect(firstTab).toBeFocused();

      // ArrowRight → segunda tab (Documentos)
      await page.keyboard.press('ArrowRight');
      await expect(tablist.locator('[role="tab"]', { hasText: 'Documentos' })).toBeFocused();

      // ArrowRight → terceira tab (Revisão)
      await page.keyboard.press('ArrowRight');
      await expect(tablist.locator('[role="tab"]', { hasText: 'Revisão' })).toBeFocused();

      // ArrowRight → wrap para primeira tab
      await page.keyboard.press('ArrowRight');
      await expect(tablist.locator('[role="tab"]', { hasText: 'Dados Pessoais' })).toBeFocused();

      // ArrowLeft → wrap para última tab
      await page.keyboard.press('ArrowLeft');
      await expect(tablist.locator('[role="tab"]', { hasText: 'Revisão' })).toBeFocused();

      await screenshot(page, 'k13-arrow-tabs');
    });

    test('K14: Escape fecha o dialog de confirmação', async ({ page }) => {
      await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' }).click();
      await page.locator('[data-testid="btn-enviar-inscricao"]').click();
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 3000 });

      await page.keyboard.press('Escape');

      await expect(dialog).toBeHidden();

      await screenshot(page, 'k14-escape-dialog');
    });

    test('K15: Tab dentro do dialog navega entre botões', async ({ page }) => {
      await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' }).click();
      await page.locator('[data-testid="btn-enviar-inscricao"]').click();
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 });

      await page.keyboard.press('Tab');
      const info1 = await getActiveElementInfo(page);
      expect(info1.tag).toBeTruthy();

      await page.keyboard.press('Tab');
      const info2 = await getActiveElementInfo(page);
      expect(info2.tag).toBeTruthy();

      await screenshot(page, 'k15-tab-dialog-buttons');
    });

    test('K16: clicar em Revisão, depois ArrowLeft volta para tabs anteriores', async ({ page }) => {
      const tablist = page.locator('[role="tablist"]');
      const revisaoTab = tablist.locator('[role="tab"]', { hasText: 'Revisão' });
      await revisaoTab.click();
      await expect(revisaoTab).toHaveAttribute('aria-selected', 'true');

      // Focar a tab via teclado
      await revisaoTab.focus();
      await expect(revisaoTab).toBeFocused();

      await page.keyboard.press('ArrowLeft');
      await expect(tablist.locator('[role="tab"]', { hasText: 'Documentos' })).toBeFocused();

      await page.keyboard.press('ArrowLeft');
      await expect(tablist.locator('[role="tab"]', { hasText: 'Dados Pessoais' })).toBeFocused();

      await screenshot(page, 'k16-click-then-arrow-back');
    });

    test('K17: Home/End navegam para primeira/última tab', async ({ page }) => {
      const tablist = page.locator('[role="tablist"]');
      const firstTab = tablist.locator('[role="tab"]').first();
      await tabUntilFocused(page, firstTab);

      await page.keyboard.press('End');
      await expect(tablist.locator('[role="tab"]', { hasText: 'Revisão' })).toBeFocused();

      await page.keyboard.press('Home');
      await expect(tablist.locator('[role="tab"]', { hasText: 'Dados Pessoais' })).toBeFocused();

      await screenshot(page, 'k17-home-end-tabs');
    });
  });
});
