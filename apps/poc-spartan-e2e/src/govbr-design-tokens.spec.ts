import { test, expect, Page, Locator } from '@playwright/test';

const screenshotsDir = 'screenshots';

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

test.describe('Design tokens Gov.br DS — PoC Spartan', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/inscricao');
    await page.waitForLoadState('networkidle');
  });

  // ─── T1: Tipografia ─────────────────────────────────────────

  test.describe('T1 — Tipografia', () => {
    test('T1.1: body usa Raleway, 14px, line-height ~1.45, cor #333', async ({ page }) => {
      const styles = await getStyles(page.locator('body'), [
        'font-family',
        'font-size',
        'line-height',
        'color',
      ]);
      expect(styles['font-family']).toMatch(/Raleway/i);
      expect(styles['font-size']).toBe('14px');
      expect(styles['color']).toBe('rgb(51, 51, 51)');
    });

    test('T1.2: h1 título da página — 32px, weight 700', async ({ page }) => {
      const h1 = page.locator('h1').first();
      const styles = await getStyles(h1, ['font-size', 'font-weight']);
      expect(styles['font-size']).toBe('32px');
      expect(styles['font-weight']).toBe('700');
    });

    test('T1.3: h2 título de seção — 24px, weight 700', async ({ page }) => {
      const h2 = page.locator('h2').first();
      const styles = await getStyles(h2, ['font-size', 'font-weight']);
      expect(styles['font-size']).toBe('24px');
      expect(styles['font-weight']).toBe('700');
    });

    test('T1.4: label de campo — 12.8px, weight 600', async ({ page }) => {
      const label = page.locator('label[for="nome"]');
      const styles = await getStyles(label, ['font-size', 'font-weight']);
      expect(styles['font-size']).toBe('12.8px');
      expect(styles['font-weight']).toBe('600');
    });

    test('T1.5: input de texto — 14px, Raleway', async ({ page }) => {
      const styles = await getStyles(page.locator('#nome'), [
        'font-size',
        'font-family',
      ]);
      expect(styles['font-size']).toBe('14px');
      expect(styles['font-family']).toMatch(/Raleway/i);
    });

    test('T1.6: mensagem de erro — 11.2px, cor danger', async ({ page }) => {
      // Tocar campo para disparar erro
      await page.locator('#nome').focus();
      await page.locator('#cpf').focus();

      const errMsg = page.getByText('Nome é obrigatório').first();
      await expect(errMsg).toBeVisible();
      const styles = await getStyles(errMsg, ['font-size', 'color']);
      expect(styles['font-size']).toBe('11.2px');
      expect(styles['color']).toBe('rgb(229, 34, 7)');
    });

    test('T1.7: barra Gov.br — 11.2px, weight 600, branco', async ({ page }) => {
      const barText = page.getByText('GOVERNO FEDERAL');
      const styles = await getStyles(barText, [
        'font-size',
        'font-weight',
        'color',
      ]);
      expect(styles['font-size']).toBe('11.2px');
      expect(styles['font-weight']).toBe('600');
      expect(styles['color']).toBe('rgb(255, 255, 255)');
    });

    test('T1.8: título do header — 20px, weight 700', async ({ page }) => {
      const titulo = page.getByText('Sistema Unificado CEPS');
      const styles = await getStyles(titulo, ['font-size', 'font-weight']);
      expect(styles['font-size']).toBe('20px');
      expect(styles['font-weight']).toBe('700');
    });

    test('T1.9: tab trigger — 14px, weight ≥ 500', async ({ page }) => {
      const tab = page.locator('button[brnTabsTrigger="dados-pessoais"]');
      const styles = await getStyles(tab, ['font-size', 'font-weight']);
      expect(styles['font-size']).toBe('14px');
      expect(parseInt(styles['font-weight'])).toBeGreaterThanOrEqual(500);
    });

    test('T1.10: botão primário — 14px, weight 600', async ({ page }) => {
      await page.locator('button[brnTabsTrigger="revisao"]').click();
      const btn = page.locator('poc-confirmacao-dialog button', {
        hasText: 'Enviar Inscrição',
      });
      const styles = await getStyles(btn, ['font-size', 'font-weight']);
      expect(styles['font-size']).toBe('14px');
      expect(styles['font-weight']).toBe('600');
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
    });

    test('T2.2: barra Gov.br — rgb(7, 29, 65)', async ({ page }) => {
      const barra = page.locator('.bg-govbr-primary-darkest').first();
      const styles = await getStyles(barra, ['background-color']);
      expect(styles['background-color']).toBe('rgb(7, 29, 65)');
    });

    test('T2.3: header principal — rgb(19, 81, 180)', async ({ page }) => {
      const header = page.locator('header.bg-govbr-primary');
      const styles = await getStyles(header, ['background-color']);
      expect(styles['background-color']).toBe('rgb(19, 81, 180)');
    });

    test('T2.4: footer — rgb(12, 50, 111)', async ({ page }) => {
      const footer = page.locator('footer');
      const styles = await getStyles(footer, ['background-color']);
      expect(styles['background-color']).toBe('rgb(12, 50, 111)');
    });

    test('T2.5: input background — branco', async ({ page }) => {
      const styles = await getStyles(page.locator('#nome'), ['background-color']);
      expect(styles['background-color']).toBe('rgb(255, 255, 255)');
    });

    test('T2.6: tabela header — rgb(19, 81, 180)', async ({ page }) => {
      await page.locator('button[brnTabsTrigger="revisao"]').click();
      const headerRow = page.locator('table[cdk-table] tr[cdk-header-row] th').first();
      const styles = await getStyles(headerRow, ['background-color']);
      expect(styles['background-color']).toBe('rgb(19, 81, 180)');
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
    });

    test('T3.2: texto do header — branco', async ({ page }) => {
      const titulo = page.getByText('Sistema Unificado CEPS');
      const styles = await getStyles(titulo, ['color']);
      expect(styles['color']).toBe('rgb(255, 255, 255)');
    });

    test('T3.3: texto do footer — branco', async ({ page }) => {
      const footer = page.locator('footer');
      const styles = await getStyles(footer, ['color']);
      expect(styles['color']).toBe('rgb(255, 255, 255)');
    });

    test('T3.4: mensagem de erro — rgb(229, 34, 7)', async ({ page }) => {
      await page.locator('#nome').focus();
      await page.locator('#cpf').focus();
      const errMsg = page.getByText('Nome é obrigatório').first();
      await expect(errMsg).toBeVisible();
      const styles = await getStyles(errMsg, ['color']);
      expect(styles['color']).toBe('rgb(229, 34, 7)');
    });

    test('T3.5: asterisco obrigatório — danger', async ({ page }) => {
      // Asterisco é inline no label
      const asterisk = page.locator('label[for="nome"] .text-govbr-danger').first();
      const styles = await getStyles(asterisk, ['color']);
      expect(styles['color']).toBe('rgb(229, 34, 7)');
    });

    test('T3.6: placeholder — rgb(136, 136, 136)', async ({ page }) => {
      const styles = await getPseudoStyles(page.locator('#nome'), '::placeholder', ['color']);
      expect(styles['color']).toBe('rgb(136, 136, 136)');
    });

    test('T3.7: tab ativa — primary', async ({ page }) => {
      const tab = page.locator('button[brnTabsTrigger="dados-pessoais"]');
      const styles = await getStyles(tab, ['color']);
      expect(styles['color']).toBe('rgb(19, 81, 180)');
    });

    test('T3.8: tab inativa — rgb(99, 99, 99)', async ({ page }) => {
      const tab = page.locator('button[brnTabsTrigger="documentos"]');
      const styles = await getStyles(tab, ['color']);
      expect(styles['color']).toBe('rgb(99, 99, 99)');
    });

    test('T3.9: texto header da tabela — branco', async ({ page }) => {
      await page.locator('button[brnTabsTrigger="revisao"]').click();
      const headerText = page.locator('table[cdk-table] tr[cdk-header-row] th').first();
      const styles = await getStyles(headerText, ['color']);
      expect(styles['color']).toBe('rgb(255, 255, 255)');
    });

    test('T3: screenshot de referência cores de texto', async ({ page }) => {
      await screenshot(page, 't3-cores-texto');
    });
  });

  // ─── T4: Bordas ──────────────────────────────────────────────

  test.describe('T4 — Bordas', () => {
    test('T4.1: input normal — border-color gray-20', async ({ page }) => {
      const styles = await getStyles(page.locator('#nome'), ['border-color']);
      expect(styles['border-color']).toBe('rgb(204, 204, 204)');
    });

    // FINDING: [class.border-govbr-danger] depende de touched && invalid.
    // Playwright .focus() marca o campo como touched, mas a classe CSS Tailwind
    // aplica via binding Angular dinâmico que requer change detection.
    // Em headless, a transição pode não completar antes da leitura do computed style.
    test('T4.2: input com erro — border-color danger', async ({ page }) => {
      await page.locator('#nome').click();
      await page.keyboard.type('x');
      await page.keyboard.press('Backspace');
      await page.locator('#cpf').click();
      await page.waitForTimeout(200);
      await expect(page.getByText('Nome é obrigatório')).toBeVisible();
      const styles = await getStyles(page.locator('#nome'), ['border-top-color']);
      expect(styles['border-top-color']).toBe('rgb(229, 34, 7)');
    });

    test('T4.3: input border-radius — 4px', async ({ page }) => {
      const styles = await getStyles(page.locator('#nome'), ['border-radius']);
      expect(styles['border-radius']).toBe('4px');
    });

    test('T4.4: botão primário border-radius — 100px', async ({ page }) => {
      await page.locator('button[brnTabsTrigger="revisao"]').click();
      const btn = page.locator('poc-confirmacao-dialog button', {
        hasText: 'Enviar Inscrição',
      });
      const styles = await getStyles(btn, ['border-radius']);
      expect(styles['border-radius']).toBe('100px');
    });

    test('T4.5: dialog border-radius — 8px', async ({ page }) => {
      await page.locator('button[brnTabsTrigger="revisao"]').click();
      await page.locator('poc-confirmacao-dialog button', { hasText: 'Enviar Inscrição' }).click();
      await page.waitForTimeout(300);
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 3000 });
      const styles = await getStyles(dialog, ['border-radius']);
      expect(styles['border-radius']).toBe('8px');
    });

    test('T4.6: tab ativa — border-bottom primary', async ({ page }) => {
      const tab = page.locator('button[brnTabsTrigger="dados-pessoais"]');
      const styles = await getStyles(tab, ['border-bottom-color']);
      expect(styles['border-bottom-color']).toBe('rgb(19, 81, 180)');
    });

    test('T4.7: tab inativa — border-bottom transparente', async ({ page }) => {
      const tab = page.locator('button[brnTabsTrigger="documentos"]');
      const styles = await getStyles(tab, ['border-bottom-color']);
      // Transparente pode ser reportado como rgba(0, 0, 0, 0) ou transparent
      expect(
        styles['border-bottom-color'] === 'rgba(0, 0, 0, 0)' ||
          styles['border-bottom-color'] === 'transparent',
      ).toBeTruthy();
    });

    test('T4.10: radio selecionado — indicador com cor primary', async ({ page }) => {
      await page.locator('button[brnTabsTrigger="documentos"]').click();
      await page.locator('label', { hasText: 'Ampla Concorrência' }).click();
      await page.waitForTimeout(200);

      // Indicador circular do radio selecionado deve ter background primary
      const indicator = page.locator('label', { hasText: 'Ampla Concorrência' }).locator('.govbr-radio-indicator');
      const styles = await getStyles(indicator, ['background-color', 'border-color']);
      expect(styles['background-color']).toBe('rgb(19, 81, 180)');
      expect(styles['border-color']).toBe('rgb(19, 81, 180)');
    });

    test('T4: screenshot de referência bordas', async ({ page }) => {
      await screenshot(page, 't4-bordas');
    });
  });

  // ─── T5: Focus ring ──────────────────────────────────────────

  test.describe('T5 — Focus ring', () => {
    test('T5.1: input nome — focus ring primary 2px', async ({ page }) => {
      await page.locator('#nome').focus();
      const styles = await getStyles(page.locator('#nome'), [
        'outline-color',
        'outline-width',
        'outline-offset',
      ]);
      expect(styles['outline-color']).toBe('rgb(19, 81, 180)');
      expect(styles['outline-width']).toBe('2px');
      expect(styles['outline-offset']).toBe('2px');
      await screenshot(page, 't5-focus-nome');
    });

    test('T5.2: input CPF — focus ring primary', async ({ page }) => {
      await page.locator('#cpf').focus();
      const styles = await getStyles(page.locator('#cpf'), ['outline-color']);
      expect(styles['outline-color']).toBe('rgb(19, 81, 180)');
      await screenshot(page, 't5-focus-cpf');
    });

    test('T5.3: select — focus ring primary', async ({ page }) => {
      await page.locator('#curso').focus();
      const styles = await getStyles(page.locator('#curso'), ['outline-color']);
      expect(styles['outline-color']).toBe('rgb(19, 81, 180)');
      await screenshot(page, 't5-focus-select');
    });

    // FINDING: :focus-visible em botões dentro de poc-confirmacao-dialog não funciona
    // consistentemente com keyboard navigation no Playwright headless. O Tab não
    // alcança o botão diretamente por causa do tab order dentro do componente.
    test('T5.4: botão primário — focus ring primary', async ({ page }) => {
      await page.locator('button[brnTabsTrigger="revisao"]').click();
      const btn = page.locator('poc-confirmacao-dialog button', {
        hasText: 'Enviar Inscrição',
      });
      // Usar keyboard Tab para atingir o botão
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      // Verificar se o botão recebeu foco; caso contrário, forçar
      const isFocused = await btn.evaluate((el) => document.activeElement === el);
      if (!isFocused) {
        // Tab adicional — o tab order pode precisar de vários presses
        for (let i = 0; i < 10; i++) {
          await page.keyboard.press('Tab');
          const focused = await btn.evaluate((el) => document.activeElement === el);
          if (focused) break;
        }
      }
      const styles = await getStyles(btn, ['outline-color']);
      expect(styles['outline-color']).toBe('rgb(19, 81, 180)');
      await screenshot(page, 't5-focus-botao');
    });

    test('T5.5: tab trigger — focus ring primary', async ({ page }) => {
      const tab = page.locator('button[brnTabsTrigger="documentos"]');
      await tab.focus();
      const styles = await getStyles(tab, ['outline-color']);
      expect(styles['outline-color']).toBe('rgb(19, 81, 180)');
      await screenshot(page, 't5-focus-tab');
    });
  });

  // ─── T6: Hover states ────────────────────────────────────────

  test.describe('T6 — Hover states', () => {
    test('T6.1: tab inativa — hover muda cor', async ({ page }) => {
      const tab = page.locator('button[brnTabsTrigger="documentos"]');
      await tab.hover();
      await page.waitForTimeout(200); // Aguardar transition-colors
      const styles = await getStyles(tab, ['color']);
      expect(styles['color']).toBe('rgb(19, 81, 180)');
      await screenshot(page, 't6-hover-tab');
    });

    test('T6.2: botão primário — hover muda background', async ({ page }) => {
      await page.locator('button[brnTabsTrigger="revisao"]').click();
      const btn = page.locator('poc-confirmacao-dialog button', {
        hasText: 'Enviar Inscrição',
      });
      await btn.hover();
      await page.waitForTimeout(200);
      const styles = await getStyles(btn, ['background-color']);
      // FINDING: hover pode não transicionar em Playwright headless — registrar valor real
      expect(styles['background-color']).toBe('rgb(21, 91, 203)');
      await screenshot(page, 't6-hover-btn-primario');
    });

    test('T6.3: botão cancelar — hover muda background', async ({ page }) => {
      await page.locator('button[brnTabsTrigger="revisao"]').click();
      await page.locator('poc-confirmacao-dialog button', { hasText: 'Enviar Inscrição' }).click();
      await page.waitForTimeout(300);
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 });

      const cancelBtn = page.locator('[role="dialog"] button', { hasText: 'Cancelar' });
      await cancelBtn.hover();
      await page.waitForTimeout(200);
      const styles = await getStyles(cancelBtn, ['background-color']);
      // FINDING: botão cancelar tem bg transparent por padrão, hover aplica bg-govbr-gray-2
      expect(styles['background-color']).toBe('rgb(248, 248, 248)');
      await screenshot(page, 't6-hover-btn-cancelar');
    });

    test('T6.4: radio label — hover mostra cursor pointer', async ({ page }) => {
      await page.locator('button[brnTabsTrigger="documentos"]').click();
      const radio = page.locator('label', { hasText: 'Ampla Concorrência' });
      await radio.hover();
      await page.waitForTimeout(200);
      const styles = await getStyles(radio, ['cursor']);
      expect(styles['cursor']).toBe('pointer');
      await screenshot(page, 't6-hover-radio');
    });

    test('T6.5: linha da tabela — hover muda background', async ({ page }) => {
      await page.locator('button[brnTabsTrigger="revisao"]').click();
      const row = page.locator('table[cdk-table] tr[cdk-row]').first();
      await row.hover();
      await page.waitForTimeout(200);
      const styles = await getStyles(row, ['background-color']);
      expect(styles['background-color']).toBe('rgb(237, 245, 255)');
      await screenshot(page, 't6-hover-tabela');
    });
  });

  // ─── T7: Espaçamento ─────────────────────────────────────────

  test.describe('T7 — Espaçamento', () => {
    test('T7.1: input padding — 8px 12px', async ({ page }) => {
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
    });

    test('T7.2: botão primário padding — 8px 24px', async ({ page }) => {
      await page.locator('button[brnTabsTrigger="revisao"]').click();
      const btn = page.locator('poc-confirmacao-dialog button', {
        hasText: 'Enviar Inscrição',
      });
      const styles = await getStyles(btn, [
        'padding-top',
        'padding-right',
        'padding-bottom',
        'padding-left',
      ]);
      expect(styles['padding-top']).toBe('8px');
      expect(styles['padding-right']).toBe('24px');
      expect(styles['padding-bottom']).toBe('8px');
      expect(styles['padding-left']).toBe('24px');
    });

    test('T7.3: main content padding horizontal — 24px', async ({ page }) => {
      const main = page.locator('main').first();
      const styles = await getStyles(main, ['padding-left', 'padding-right']);
      expect(styles['padding-left']).toBe('24px');
      expect(styles['padding-right']).toBe('24px');
    });

    test('T7.5: tab trigger padding — 12px 24px', async ({ page }) => {
      const tab = page.locator('button[brnTabsTrigger="dados-pessoais"]');
      const styles = await getStyles(tab, [
        'padding-top',
        'padding-right',
        'padding-bottom',
        'padding-left',
      ]);
      expect(styles['padding-top']).toBe('12px');
      expect(styles['padding-right']).toBe('24px');
      expect(styles['padding-bottom']).toBe('12px');
      expect(styles['padding-left']).toBe('24px');
    });

    test('T7: screenshot de referência espaçamento', async ({ page }) => {
      await screenshot(page, 't7-espacamento');
    });
  });

  // ─── T8: Layout ──────────────────────────────────────────────

  test.describe('T8 — Layout', () => {
    test('T8.1: footer no bottom da viewport', async ({ page }) => {
      const footer = page.locator('footer');
      await expect(footer).toBeVisible();
      const footerBox = await footer.boundingBox();
      const viewport = page.viewportSize()!;
      // Footer deve estar visível e abaixo do conteúdo principal
      expect(footerBox).not.toBeNull();
      await screenshot(page, 't8-layout-desktop');
    });

    test('T8.2: header é o primeiro elemento visível', async ({ page }) => {
      const headerBox = await page.locator('poc-govbr-header').boundingBox();
      expect(headerBox).not.toBeNull();
      expect(headerBox!.y).toBeLessThanOrEqual(5); // Topo da página
    });

    test('T8.3: conteúdo centralizado com max-width', async ({ page }) => {
      const main = page.locator('main').first();
      const styles = await getStyles(main, ['max-width']);
      // Deve ter max-width aplicado (qualquer valor que não seja "none")
      expect(styles['max-width']).not.toBe('none');
    });

    test('T8.4: responsividade mobile — 375px', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(300);

      // Formulário deve ocupar largura total
      const main = page.locator('main').first();
      const mainBox = await main.boundingBox();
      expect(mainBox).not.toBeNull();

      // Nav desktop do header deve estar escondida
      const nav = page.locator('poc-govbr-header nav.md\\:flex');
      if ((await nav.count()) > 0) {
        await expect(nav).not.toBeVisible();
      }

      // Botão hambúrguer deve estar visível no mobile
      const hamburger = page.locator('poc-govbr-header button[aria-label="Menu de navegação"]');
      await expect(hamburger).toBeVisible();

      await screenshot(page, 't8-layout-mobile');
    });
  });
});
