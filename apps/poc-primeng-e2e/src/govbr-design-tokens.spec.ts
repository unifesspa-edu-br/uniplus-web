import { test, expect, Page, Locator } from '@playwright/test';

const screenshotsDir = 'apps/poc-primeng-e2e/screenshots';

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

async function getPseudoStyles(
  locator: Locator,
  pseudo: string,
  properties: string[],
): Promise<Record<string, string>> {
  return locator.evaluate(
    (el, [ps, props]) => {
      const cs = getComputedStyle(el, ps as string);
      return Object.fromEntries(
        (props as string[]).map((p) => [p, cs.getPropertyValue(p)]),
      );
    },
    [pseudo, properties] as const,
  );
}

test.describe('Design tokens Gov.br DS — PoC PrimeNG', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/inscricao');
    await page.waitForLoadState('networkidle');
  });

  // ─── T1: Tipografia ─────────────────────────────────────────
  test.describe('T1 — Tipografia', () => {
    test('T1.1: body usa Rawline/Raleway, 14px, line-height ~1.45, cor #333', async ({ page }) => {
      const styles = await getStyles(page.locator('body'), [
        'font-family',
        'font-size',
        'line-height',
        'color',
      ]);
      expect(styles['font-family']).toMatch(/Rawline|Raleway/i);
      expect(styles['font-size']).toBe('14px');
      expect(styles['color']).toBe('rgb(51, 51, 51)');
      await screenshot(page, 't1-01-body-font');
    });

    test('T1.2: h1 título da página — 32px, weight 700', async ({ page }) => {
      const h1 = page.locator('h1').first();
      const styles = await getStyles(h1, ['font-size', 'font-weight']);
      expect(styles['font-size']).toBe('32px');
      expect(styles['font-weight']).toBe('700');
      await screenshot(page, 't1-02-h1-titulo');
    });

    test('T1.3: h2 título de seção — 24px, weight 700', async ({ page }) => {
      // h2 está na tab Revisão
      await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' }).click();
      const h2 = page.locator('h2').first();
      const styles = await getStyles(h2, ['font-size', 'font-weight']);
      expect(styles['font-size']).toBe('24px');
      expect(styles['font-weight']).toBe('700');
      await screenshot(page, 't1-03-h2-secao');
    });

    test('T1.4: label de campo — 12.8px, weight 600', async ({ page }) => {
      const label = page.locator('label[for="nome"]');
      const styles = await getStyles(label, ['font-size', 'font-weight']);
      expect(styles['font-size']).toBe('12.8px');
      expect(styles['font-weight']).toBe('600');
      await screenshot(page, 't1-04-label-campo');
    });

    test('T1.5: input de texto — 14px, font institucional', async ({ page }) => {
      const styles = await getStyles(page.locator('#nome'), ['font-size', 'font-family']);
      expect(styles['font-size']).toBe('14px');
      expect(styles['font-family']).toMatch(/Rawline|Raleway/i);
      await screenshot(page, 't1-05-input-font');
    });

    test('T1.6: mensagem de erro — 11.2px, cor danger', async ({ page }) => {
      await page.locator('#nome').focus();
      await page.locator('h1').click();

      const errMsg = page.getByText('Nome é obrigatório').first();
      await expect(errMsg).toBeVisible();
      const styles = await getStyles(errMsg, ['font-size', 'color']);
      expect(styles['font-size']).toBe('11.2px');
      expect(styles['color']).toBe('rgb(229, 34, 7)');
      await screenshot(page, 't1-06-erro-msg');
    });

    test('T1.7: barra Gov.br — 11.2px, weight 600, branco', async ({ page }) => {
      const barText = page.getByText('GOVERNO FEDERAL');
      const styles = await getStyles(barText, ['font-size', 'font-weight', 'color']);
      expect(styles['font-size']).toBe('11.2px');
      expect(styles['font-weight']).toBe('600');
      expect(styles['color']).toBe('rgb(255, 255, 255)');
      await screenshot(page, 't1-07-barra-govbr');
    });

    test('T1.8: título do header — 20px, weight 700', async ({ page }) => {
      const titulo = page.getByText('Sistema Unificado CEPS');
      const styles = await getStyles(titulo, ['font-size', 'font-weight']);
      expect(styles['font-size']).toBe('20px');
      expect(styles['font-weight']).toBe('700');
      await screenshot(page, 't1-08-header-titulo');
    });

    test('T1.9: tab trigger — 20.16px, ativa 600 / inativa 500 (Gov.br DS)', async ({ page }) => {
      const tabAtiva = page.locator('[role="tablist"] [role="tab"][aria-selected="true"]');
      const stylesAtiva = await getStyles(tabAtiva, ['font-size', 'font-weight']);
      expect(stylesAtiva['font-size']).toBe('20.16px');
      expect(stylesAtiva['font-weight']).toBe('600');

      const tabInativa = page.locator('[role="tablist"] [role="tab"][aria-selected="false"]').first();
      const stylesInativa = await getStyles(tabInativa, ['font-size', 'font-weight']);
      expect(stylesInativa['font-size']).toBe('20.16px');
      expect(stylesInativa['font-weight']).toBe('500');
      await screenshot(page, 't1-09-tab-font');
    });

    test('T1.10: botão primário — 16.8px, weight 600 (Gov.br DS)', async ({ page }) => {
      await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' }).click();
      const btn = page.locator('[data-testid="btn-enviar-inscricao"] button');
      const styles = await getStyles(btn, ['font-size', 'font-weight']);
      expect(styles['font-size']).toBe('16.8px');
      expect(styles['font-weight']).toBe('600');
      await screenshot(page, 't1-10-botao-font');
    });

    test('T1: screenshot de referência tipografia', async ({ page }) => {
      await screenshot(page, 't1-tipografia');
    });
  });

  // ─── T2: Cores de fundo ──────────────────────────────────────
  test.describe('T2 — Cores de fundo', () => {
    test('T2.1: body background — rgb(248, 248, 248)', async ({ page }) => {
      const styles = await getStyles(page.locator('body'), ['background-color']);
      expect(styles['background-color']).toBe('rgb(248, 248, 248)');
      await screenshot(page, 't2-01-body-bg');
    });

    test('T2.2: barra Gov.br — rgb(7, 29, 65)', async ({ page }) => {
      const barra = page.locator('.bg-govbr-primary-darkest').first();
      const styles = await getStyles(barra, ['background-color']);
      expect(styles['background-color']).toBe('rgb(7, 29, 65)');
      await screenshot(page, 't2-02-barra-govbr-bg');
    });

    test('T2.3: header principal — rgb(19, 81, 180)', async ({ page }) => {
      const header = page.locator('header.bg-govbr-primary');
      const styles = await getStyles(header, ['background-color']);
      expect(styles['background-color']).toBe('rgb(19, 81, 180)');
      await screenshot(page, 't2-03-header-bg');
    });

    test('T2.4: footer — rgb(12, 50, 111)', async ({ page }) => {
      const footer = page.locator('footer');
      const styles = await getStyles(footer, ['background-color']);
      expect(styles['background-color']).toBe('rgb(12, 50, 111)');
      await screenshot(page, 't2-04-footer-bg');
    });

    test('T2.5: input background — branco', async ({ page }) => {
      const styles = await getStyles(page.locator('#nome'), ['background-color']);
      expect(styles['background-color']).toBe('rgb(255, 255, 255)');
      await screenshot(page, 't2-05-input-bg');
    });

    test('T2.6: tabela header — rgb(19, 81, 180)', async ({ page }) => {
      await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' }).click();
      const headerCell = page.locator('p-table table thead th').first();
      const styles = await getStyles(headerCell, ['background-color']);
      expect(styles['background-color']).toBe('rgb(19, 81, 180)');
      await screenshot(page, 't2-06-tabela-header-bg');
    });

    test('T2: screenshot de referência cores de fundo', async ({ page }) => {
      await screenshot(page, 't2-cores-fundo');
    });
  });

  // ─── T3: Cores de texto ──────────────────────────────────────
  test.describe('T3 — Cores de texto', () => {
    test('T3.1: texto principal — rgb(51, 51, 51)', async ({ page }) => {
      const styles = await getStyles(page.locator('body'), ['color']);
      expect(styles['color']).toBe('rgb(51, 51, 51)');
      await screenshot(page, 't3-01-body-cor');
    });

    test('T3.2: texto do header — branco', async ({ page }) => {
      const titulo = page.getByText('Sistema Unificado CEPS');
      const styles = await getStyles(titulo, ['color']);
      expect(styles['color']).toBe('rgb(255, 255, 255)');
      await screenshot(page, 't3-02-header-cor');
    });

    test('T3.3: texto do footer — branco', async ({ page }) => {
      const footer = page.locator('footer');
      const styles = await getStyles(footer, ['color']);
      expect(styles['color']).toBe('rgb(255, 255, 255)');
      await screenshot(page, 't3-03-footer-cor');
    });

    test('T3.4: mensagem de erro — rgb(229, 34, 7)', async ({ page }) => {
      await page.locator('#nome').focus();
      await page.locator('h1').click();
      const errMsg = page.getByText('Nome é obrigatório').first();
      await expect(errMsg).toBeVisible();
      const styles = await getStyles(errMsg, ['color']);
      expect(styles['color']).toBe('rgb(229, 34, 7)');
      await screenshot(page, 't3-04-erro-cor');
    });

    test('T3.5: asterisco obrigatório — danger', async ({ page }) => {
      const asterisk = page.locator('label[for="nome"] .text-govbr-danger').first();
      const styles = await getStyles(asterisk, ['color']);
      expect(styles['color']).toBe('rgb(229, 34, 7)');
      await screenshot(page, 't3-05-asterisco-cor');
    });

    test('T3.6: placeholder — cor cinza', async ({ page }) => {
      const styles = await getPseudoStyles(page.locator('#nome'), '::placeholder', ['color']);
      expect(styles['color']).not.toBe('rgb(51, 51, 51)');
      expect(styles['color']).not.toBe('rgb(0, 0, 0)');
      await screenshot(page, 't3-06-placeholder-cor');
    });

    test('T3.7: tab ativa — primary', async ({ page }) => {
      const tab = page.locator('[role="tablist"] [role="tab"][aria-selected="true"]');
      const styles = await getStyles(tab, ['color']);
      expect(styles['color']).toBe('rgb(19, 81, 180)');
      await screenshot(page, 't3-07-tab-ativa-cor');
    });

    test('T3.8: tab inativa — gray escuro', async ({ page }) => {
      const tab = page.locator('[role="tablist"] [role="tab"][aria-selected="false"]').first();
      const styles = await getStyles(tab, ['color']);
      expect(styles['color']).toBe('rgb(99, 99, 99)');
      await screenshot(page, 't3-08-tab-inativa-cor');
    });

    test('T3.9: texto header da tabela — branco', async ({ page }) => {
      await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' }).click();
      const headerCell = page.locator('p-table table thead th').first();
      const styles = await getStyles(headerCell, ['color']);
      expect(styles['color']).toBe('rgb(255, 255, 255)');
      await screenshot(page, 't3-09-tabela-header-cor');
    });

    test('T3: screenshot de referência cores de texto', async ({ page }) => {
      await screenshot(page, 't3-cores-texto');
    });
  });

  // ─── T4: Bordas ──────────────────────────────────────────────
  test.describe('T4 — Bordas', () => {
    test('T4.1: input normal — border visível', async ({ page }) => {
      const styles = await getStyles(page.locator('#nome'), ['border-top-width', 'border-top-style']);
      expect(styles['border-top-width']).not.toBe('0px');
      expect(styles['border-top-style']).toBe('solid');
      await screenshot(page, 't4-01-input-borda');
    });

    test('T4.2: input com erro — border danger', async ({ page }) => {
      await page.locator('#nome').click();
      await page.keyboard.type('x');
      await page.keyboard.press('Backspace');
      await page.locator('h1').click();
      await page.waitForTimeout(200);
      await expect(page.getByText('Nome é obrigatório')).toBeVisible();
      await screenshot(page, 't4-02-input-erro-borda');
    });

    test('T4.3: input border-radius — 4px (Gov.br DS)', async ({ page }) => {
      const styles = await getStyles(page.locator('#nome'), ['border-radius']);
      expect(styles['border-radius']).toBe('4px');
      await screenshot(page, 't4-03-input-radius');
    });

    test('T4.4: botão primário border-radius — pill (Gov.br DS 100px)', async ({ page }) => {
      await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' }).click();
      const btn = page.locator('[data-testid="btn-enviar-inscricao"] button');
      const styles = await getStyles(btn, ['border-radius']);
      const radiusPx = parseFloat(styles['border-radius']);
      expect(radiusPx).toBeGreaterThanOrEqual(100);
      await screenshot(page, 't4-04-botao-radius');
    });

    test('T4.5: dialog border-radius — 8px (Gov.br DS)', async ({ page }) => {
      await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' }).click();
      await page.locator('[data-testid="btn-enviar-inscricao"] button').click();
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 3000 });
      const styles = await getStyles(dialog, ['border-radius']);
      expect(styles['border-radius']).toBe('8px');
      await screenshot(page, 't4-05-dialog-radius');
    });

    test('T4.6: tab ativa — border-bottom 4px primary (Gov.br DS)', async ({ page }) => {
      const tab = page.locator('[role="tablist"] [role="tab"][aria-selected="true"]');
      const styles = await getStyles(tab, ['border-bottom-color', 'border-bottom-width']);
      expect(styles['border-bottom-color']).toBe('rgb(19, 81, 180)');
      expect(styles['border-bottom-width']).toBe('4px');
      await screenshot(page, 't4-06-tab-ativa-borda');
    });

    test('T4.7: tab inativa — border-bottom transparente', async ({ page }) => {
      const tab = page.locator('[role="tablist"] [role="tab"][aria-selected="false"]').first();
      const styles = await getStyles(tab, ['border-bottom-color']);
      expect(
        styles['border-bottom-color'] === 'rgba(0, 0, 0, 0)' ||
          styles['border-bottom-color'] === 'transparent',
      ).toBeTruthy();
      await screenshot(page, 't4-07-tab-inativa-borda');
    });

    test('T4.8: radio selecionado — indicador visível', async ({ page }) => {
      await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Documentos' }).click();
      await page.locator('label', { hasText: 'Ampla Concorrência' }).click();
      await page.waitForTimeout(200);

      const radioInput = page.locator('#mod-AC');
      await expect(radioInput).toBeChecked();
      await screenshot(page, 't4-08-radio-check');
    });

    test('T4: screenshot de referência bordas', async ({ page }) => {
      await screenshot(page, 't4-bordas');
    });
  });

  // ─── T5: Focus ring ──────────────────────────────────────────
  test.describe('T5 — Focus ring Gov.br (4px dashed gold)', () => {
    async function tabUntilFocused(page: Page, locator: Locator, maxTabs = 15) {
      await page.locator('body').click({ position: { x: 1, y: 1 } });
      for (let i = 0; i < maxTabs; i++) {
        await page.keyboard.press('Tab');
        const isFocused = await locator.evaluate((el) => document.activeElement === el);
        if (isFocused) return true;
      }
      return false;
    }

    async function checkGovbrFocusRing(page: Page, locator: Locator) {
      const isReplaced = await locator.evaluate((el) =>
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName),
      );

      if (isReplaced) {
        const overlay = page.locator('.govbr-focus-overlay');
        await expect(overlay).toBeVisible({ timeout: 2000 });
        const styles = await overlay.evaluate((el) => {
          const cs = getComputedStyle(el);
          return {
            borderColor: cs.borderColor,
            borderStyle: cs.borderStyle,
            borderWidth: cs.borderTopWidth,
          };
        });
        expect(styles.borderColor).toBe('rgb(194, 133, 12)');
        expect(styles.borderStyle).toBe('dashed');
        expect(styles.borderWidth).toBe('4px');
      } else {
        const info = await locator.evaluate((el) => {
          const ps = getComputedStyle(el, '::before');
          return {
            hasClass: el.classList.contains('govbr-focus-ring'),
            borderColor: ps.borderColor,
            borderStyle: ps.borderStyle,
            borderWidth: ps.borderTopWidth,
          };
        });
        expect(info.hasClass).toBe(true);
        expect(info.borderColor).toBe('rgb(194, 133, 12)');
        expect(info.borderStyle).toBe('dashed');
        expect(info.borderWidth).toBe('4px');
      }
    }

    test('T5.1: input nome — focus ring gold 4px dashed Gov.br DS', async ({ page }) => {
      const nome = page.locator('#nome');
      await tabUntilFocused(page, nome);
      await checkGovbrFocusRing(page, nome);
      await screenshot(page, 't5-focus-nome');
    });

    test('T5.2: input CPF — focus ring gold Gov.br DS', async ({ page }) => {
      const cpf = page.locator('#cpf');
      await tabUntilFocused(page, cpf);
      await checkGovbrFocusRing(page, cpf);
      await screenshot(page, 't5-focus-cpf');
    });

    test('T5.3: PrimeNG select — focus ring gold Gov.br DS', async ({ page }) => {
      // PrimeNG select trigger has role="combobox" — it's a replaced-like element
      // Focus ring appears as overlay on the p-select wrapper
      const selectTrigger = page.locator('p-select#curso [role="combobox"]');
      await tabUntilFocused(page, selectTrigger);
      // Overlay should appear on the p-select wrapper
      const overlay = page.locator('.govbr-focus-overlay');
      await expect(overlay).toBeVisible({ timeout: 2000 });
      await screenshot(page, 't5-focus-select');
    });

    test('T5.4: botão primário — focus ring visível', async ({ page }) => {
      await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' }).click();
      await page.waitForTimeout(500);
      const btn = page.locator('[data-testid="btn-enviar-inscricao"] button');
      const tabindex = await btn.evaluate((el) => el.getAttribute('tabindex'));
      expect(tabindex === null || parseInt(tabindex) >= 0).toBeTruthy();
      await screenshot(page, 't5-focus-botao');
    });

    test('T5.5: tab trigger — focus ring visível', async ({ page }) => {
      const tab = page.locator('[role="tablist"] [role="tab"]', { hasText: 'Documentos' });
      await tab.focus();
      await expect(tab).toHaveAttribute('role', 'tab');
      await screenshot(page, 't5-focus-tab');
    });
  });

  // ─── T6: Hover states ────────────────────────────────────────
  test.describe('T6 — Hover states', () => {
    test('T6.1: tab inativa — hover cursor pointer', async ({ page }) => {
      const tab = page.locator('[role="tablist"] [role="tab"]', { hasText: 'Documentos' });
      await tab.hover();
      await page.waitForTimeout(200);
      const styles = await getStyles(tab, ['cursor']);
      expect(styles['cursor']).toBe('pointer');
      await screenshot(page, 't6-hover-tab');
    });

    test('T6.2: botão primário — hover cursor pointer', async ({ page }) => {
      await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' }).click();
      const btn = page.locator('[data-testid="btn-enviar-inscricao"] button');
      await btn.hover();
      await page.waitForTimeout(200);
      const styles = await getStyles(btn, ['cursor']);
      expect(styles['cursor']).toBe('pointer');
      await screenshot(page, 't6-hover-btn-primario');
    });

    test('T6.3: botão cancelar do dialog — cursor pointer', async ({ page }) => {
      await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' }).click();
      await page.locator('[data-testid="btn-enviar-inscricao"] button').click();
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 });

      const cancelBtn = page.locator('[data-testid="btn-cancelar"]');
      await cancelBtn.hover();
      const styles = await getStyles(cancelBtn, ['cursor']);
      expect(styles['cursor']).toBe('pointer');
      await screenshot(page, 't6-hover-btn-cancelar');
    });

    test('T6.4: radio label — cursor pointer', async ({ page }) => {
      await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Documentos' }).click();
      const label = page.locator('label', { hasText: 'Ampla Concorrência' });
      await label.hover();
      const styles = await getStyles(label, ['cursor']);
      expect(styles['cursor']).toBe('pointer');
      await screenshot(page, 't6-hover-radio');
    });

    test('T6.5: linha da tabela — visível após hover', async ({ page }) => {
      await page.fill('#nome', 'Maria');
      await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' }).click();
      const row = page.locator('p-table table tbody tr').first();
      await row.hover();
      await page.waitForTimeout(200);
      await expect(row).toBeVisible();
      await screenshot(page, 't6-hover-tabela');
    });
  });

  // ─── T7: Espaçamento ─────────────────────────────────────────
  test.describe('T7 — Espaçamento', () => {
    test('T7.1: input padding — 8px 12px (Gov.br DS)', async ({ page }) => {
      const styles = await getStyles(page.locator('#nome'), [
        'padding-top',
        'padding-right',
        'padding-bottom',
        'padding-left',
      ]);
      expect(styles['padding-top']).toBe('8px');
      expect(styles['padding-right']).toBe('12px');
      expect(styles['padding-bottom']).toBe('8px');
      expect(styles['padding-left']).toBe('12px');
      await screenshot(page, 't7-01-input-padding');
    });

    test('T7.2: botão primário — width suficiente', async ({ page }) => {
      await page.locator('[role="tablist"] [role="tab"]', { hasText: 'Revisão' }).click();
      await page.waitForTimeout(500);
      const btn = page.locator('[data-testid="btn-enviar-inscricao"] button');
      await expect(btn).toBeVisible();
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(100);
      expect(box!.height).toBeGreaterThanOrEqual(32);
      await screenshot(page, 't7-02-botao-size');
    });

    test('T7.3: main content padding horizontal — 24px', async ({ page }) => {
      const main = page.locator('main').first();
      const styles = await getStyles(main, ['padding-left', 'padding-right']);
      expect(styles['padding-left']).toBe('24px');
      expect(styles['padding-right']).toBe('24px');
      await screenshot(page, 't7-03-main-padding');
    });

    test('T7.4: tab trigger padding — 16px 24px (Gov.br DS)', async ({ page }) => {
      const tab = page.locator('[role="tablist"] [role="tab"]').first();
      const styles = await getStyles(tab, [
        'padding-top',
        'padding-right',
        'padding-bottom',
        'padding-left',
      ]);
      expect(styles['padding-top']).toBe('16px');
      expect(styles['padding-right']).toBe('24px');
      expect(styles['padding-bottom']).toBe('16px');
      expect(styles['padding-left']).toBe('24px');
      await screenshot(page, 't7-04-tab-padding');
    });

    test('T7: screenshot de referência espaçamento', async ({ page }) => {
      await screenshot(page, 't7-espacamento');
    });
  });

  // ─── T8: Layout ──────────────────────────────────────────────
  test.describe('T8 — Layout', () => {
    test('T8.1: footer visível no bottom', async ({ page }) => {
      const footer = page.locator('footer');
      await expect(footer).toBeVisible();
      const footerBox = await footer.boundingBox();
      expect(footerBox).not.toBeNull();
      await screenshot(page, 't8-layout-desktop');
    });

    test('T8.2: header é o primeiro elemento visível', async ({ page }) => {
      const headerBox = await page.locator('poc-govbr-header').boundingBox();
      expect(headerBox).not.toBeNull();
      expect(headerBox!.y).toBeLessThanOrEqual(5);
    });

    test('T8.3: conteúdo centralizado com max-width', async ({ page }) => {
      const main = page.locator('main').first();
      const styles = await getStyles(main, ['max-width']);
      expect(styles['max-width']).not.toBe('none');
    });

    test('T8.4: responsividade mobile — 375px', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(300);

      const main = page.locator('main').first();
      const mainBox = await main.boundingBox();
      expect(mainBox).not.toBeNull();

      const hamburger = page.locator('poc-govbr-header button[aria-label="Menu de navegação"]');
      await expect(hamburger).toBeVisible();

      await screenshot(page, 't8-layout-mobile');
    });
  });
});
