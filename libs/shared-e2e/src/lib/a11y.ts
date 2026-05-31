import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import type { AxeResults } from 'axe-core';

/**
 * Tags WCAG 2.1 A + AA — combinação canônica para baseline de acessibilidade
 * de aplicações web. Cobre Success Criteria de Level A (essenciais) e Level
 * AA (intermediários), incluindo extensões da WCAG 2.1 (mobile, low vision).
 *
 * **Por que A + AA:** alinhamento com regulação federal brasileira:
 * - **e-MAG 3.1** (Portaria SLTI nº 03/2007 + atualizações) — equivalente
 *   a WCAG 2.0 AA, herdado por autarquias federais como a Unifesspa.
 * - **Lei Brasileira de Inclusão** (Lei 13.146/2015) — cita acessibilidade
 *   digital sem nível específico; AA é o piso prático adotado.
 *
 * Nível AAA não é exigido nem recomendado para baseline (regras AAA são
 * frequentemente ambíguas ou incompatíveis com design padrão).
 */
export const WCAG_A_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const;

/**
 * Superset automatizável para o contrato visual AAA do Uni+ DS. Mantém A/AA
 * como baseline regulatório e adiciona `wcag2aaa` apenas como gate visual
 * aplicável, sem declarar conformidade WCAG AAA completa.
 */
export const WCAG_AAA_APPLICABLE_TAGS = [
  ...WCAG_A_AA_TAGS,
  'wcag2aaa',
] as const;

/**
 * Configuração opcional para customizar a análise por cenário.
 */
export interface RunAxeOptions {
  /**
   * Tags WCAG/axe a aplicar. Default: WCAG 2.1 A + AA. Override apenas
   * quando um cenário específico precisa de subset (ex.: smoke rápido)
   * ou superset (ex.: best-practices em dev).
   */
  readonly tags?: readonly string[];
  /**
   * Selector CSS para limitar a análise a uma sub-árvore do DOM. Útil para
   * isolar o componente sob teste sem capturar violations de
   * header/footer/sidebar globais (que devem ter cobertura própria).
   */
  readonly include?: string;
  /**
   * Selectors CSS a excluir da análise — cada elemento do array é um
   * **seletor irmão** independente (não chain cross-frame). O helper
   * encadeia `.exclude()` por seletor porque a API
   * `AxeBuilder.exclude(SerialFrameSelector)` interpreta arrays como
   * navegação `iframe → shadowDOM`, NÃO como múltiplos seletores root.
   * Útil para suprimir elementos de terceiros com violations conhecidas
   * enquanto há correção em curso.
   */
  readonly exclude?: readonly string[];
}

export interface AaaVisualContractOptions {
  readonly fontMode?: 'default' | 'legible';
  readonly normalTextContrast?: number;
  readonly largeTextContrast?: number;
}

/**
 * Roda axe-core na página atual filtrado por WCAG 2.1 A + AA. Retorna o
 * `AxeResults` para o caller asserir sobre `violations`.
 *
 * **Exemplo de uso em specs:**
 *
 * ```ts
 * test('dashboard sem violations WCAG A/AA', async ({ page }) => {
 *   await page.goto('/dashboard');
 *   const results = await runAxeWcagAA(page);
 *   expect(results.violations).toEqual([]);
 * });
 * ```
 *
 * **Antes de chamar:** garantir que a UI sob teste está em estado estável
 * (`waitForLoadState`, `waitFor` em elementos críticos). Axe analisa o DOM
 * no momento da chamada — elementos lazy-loaded ou em transição podem ser
 * perdidos.
 */
export async function runAxeWcagAA(
  page: Page,
  options: RunAxeOptions = {},
): Promise<AxeResults> {
  let builder = new AxeBuilder({ page }).withTags([
    ...(options.tags ?? WCAG_A_AA_TAGS),
  ]);

  if (options.include) {
    builder = builder.include(options.include);
  }

  // Encadeia .exclude() por seletor — a API AxeBuilder interpreta arrays
  // como navegação cross-frame (iframe → shadowDOM), NÃO como múltiplos
  // seletores irmãos. Cada chamada acumula no exclude internal list.
  for (const selector of options.exclude ?? []) {
    builder = builder.exclude(selector);
  }

  return builder.analyze();
}

export async function runAxeWcagAAAApplicable(
  page: Page,
  options: RunAxeOptions = {},
): Promise<AxeResults> {
  return runAxeWcagAA(page, {
    ...options,
    tags: options.tags ?? WCAG_AAA_APPLICABLE_TAGS,
  });
}

export async function assertAaaVisualContract(
  page: Page,
  options: AaaVisualContractOptions = {},
): Promise<void> {
  await waitForFonts(page);

  const expectedFontMode = options.fontMode ?? await page.evaluate(() =>
    document.documentElement.dataset['fontMode'] === 'legible' ? 'legible' : 'default',
  );

  const fontState = await page.evaluate(() => {
    const bodyFamily = getComputedStyle(document.body).fontFamily;
    return {
      bodyFamily,
      interLoaded: document.fonts?.check('16px Inter') ?? true,
      atkinsonLoaded: document.fonts?.check('16px "Atkinson Hyperlegible Next"') ?? true,
    };
  });

  expect(fontState.bodyFamily.toLowerCase()).toContain(
    expectedFontMode === 'legible' ? 'atkinson hyperlegible next' : 'inter',
  );
  expect(fontState.bodyFamily.toLowerCase()).toMatch(/system-ui|sans-serif/);
  expect(fontState.interLoaded).toBe(true);
  if (expectedFontMode === 'legible') {
    expect(fontState.atkinsonLoaded).toBe(true);
  }

  const layout = await horizontalOverflow(page);
  expect(layout).toEqual([]);

  const failures = await page.evaluate(
    ({ normalTextContrast, largeTextContrast }) => {
      type Failure = {
        kind: 'contrast' | 'font-size' | 'line-height' | 'letter-spacing';
        selector: string;
        text: string;
        actual: number;
        expected: number;
      };

      type Rgba = {
        r: number;
        g: number;
        b: number;
        a: number;
      };

      const failures: Failure[] = [];
      const elements = Array.from(document.body.querySelectorAll<HTMLElement>('*'));

      for (const element of elements) {
        if (!isVisible(element) || isDisabled(element) || isIgnoredTextElement(element)) {
          continue;
        }

        const text = ownText(element);
        if (!text) continue;

        const style = getComputedStyle(element);
        const fontSize = parseFloat(style.fontSize);
        const fontWeight = parseFontWeight(style.fontWeight);
        const lineHeight = parseLineHeight(style.lineHeight, fontSize);
        const letterSpacing = parseLength(style.letterSpacing);

        const minFontSize = minimumFontSize(element);
        if (fontSize < minFontSize) {
          failures.push({
            kind: 'font-size',
            selector: selectorFor(element),
            text,
            actual: round(fontSize),
            expected: minFontSize,
          });
        }

        if (!isInteractive(element) && !isHeading(element) && lineHeight / fontSize < 1.25) {
          failures.push({
            kind: 'line-height',
            selector: selectorFor(element),
            text,
            actual: round(lineHeight / fontSize),
            expected: 1.25,
          });
        }

        if (letterSpacing < 0) {
          failures.push({
            kind: 'letter-spacing',
            selector: selectorFor(element),
            text,
            actual: round(letterSpacing),
            expected: 0,
          });
        }

        const foreground = parseColor(style.color);
        const background = effectiveBackground(element);
        if (!foreground || !background) {
          continue;
        }

        const contrast = contrastRatio(foreground, background);
        const requiredContrast = isLargeText(fontSize, fontWeight)
          ? largeTextContrast
          : normalTextContrast;

        if (contrast < requiredContrast) {
          failures.push({
            kind: 'contrast',
            selector: selectorFor(element),
            text,
            actual: round(contrast),
            expected: requiredContrast,
          });
        }
      }

      return failures.slice(0, 30);

      function isIgnoredTextElement(element: HTMLElement): boolean {
        return element.matches([
          'script',
          'style',
          'svg',
          'path',
          '[aria-hidden="true"]',
          '[hidden]',
          '.sr-only',
        ].join(','));
      }

      function isVisible(element: HTMLElement): boolean {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none'
          && style.visibility !== 'hidden'
          && Number(style.opacity) !== 0
          && rect.width > 0
          && rect.height > 0;
      }

      function isDisabled(element: HTMLElement): boolean {
        return element.matches('[disabled], [aria-disabled="true"], :disabled')
          || element.closest('[disabled], [aria-disabled="true"], :disabled') !== null;
      }

      function ownText(element: HTMLElement): string {
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          return (element.value || element.placeholder || element.getAttribute('aria-label') || '').trim();
        }

        const directText = Array.from(element.childNodes)
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent ?? '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (directText) return directText.slice(0, 80);
        if (isInteractive(element)) {
          return (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
        }
        return '';
      }

      function isInteractive(element: HTMLElement): boolean {
        return element.matches([
          'a[href]',
          'button',
          'input',
          'select',
          'textarea',
          'summary',
          '[role="button"]',
          '[role="link"]',
          '[role="menuitem"]',
          '[tabindex]:not([tabindex="-1"])',
        ].join(','));
      }

      function isHeading(element: HTMLElement): boolean {
        return /^H[1-6]$/.test(element.tagName) || element.getAttribute('role') === 'heading';
      }

      function minimumFontSize(element: HTMLElement): number {
        if (element.matches('.u-caption, .card__meta, .table-responsive__meta, .stepper__label, .institutional-bar, .institutional-bar *')) {
          return 12;
        }
        if (isInteractive(element) || element.matches('th, .u-body-sm, .page-header__desc')) {
          return 14;
        }
        if (isHeading(element)) {
          return 18;
        }
        return 14;
      }

      function parseFontWeight(fontWeight: string): number {
        if (fontWeight === 'normal') return 400;
        if (fontWeight === 'bold') return 700;
        return Number.parseInt(fontWeight, 10) || 400;
      }

      function parseLineHeight(lineHeight: string, fontSize: number): number {
        if (lineHeight === 'normal') return fontSize * 1.2;
        if (lineHeight.endsWith('px')) return parseFloat(lineHeight);
        const numeric = Number(lineHeight);
        return Number.isFinite(numeric) ? numeric * fontSize : fontSize * 1.2;
      }

      function parseLength(value: string): number {
        if (value === 'normal') return 0;
        return parseFloat(value) || 0;
      }

      function parseColor(value: string): Rgba | null {
        const rgba = value.match(/^rgba?\(([^)]+)\)$/);
        if (rgba) {
          const parts = rgba[1].split(/,\s*/).map((part) => Number(part.trim().replace('%', '')));
          if (parts.length >= 3 && parts.every((part) => Number.isFinite(part))) {
            return {
              r: parts[0],
              g: parts[1],
              b: parts[2],
              a: parts.length >= 4 ? parts[3] : 1,
            };
          }
        }

        const srgb = value.match(/^color\(srgb\s+([^)]+)\)$/);
        if (srgb) {
          const parts = srgb[1].split(/\s+/).map((part) => Number(part));
          if (parts.length >= 3 && parts.every((part) => Number.isFinite(part))) {
            return {
              r: parts[0] * 255,
              g: parts[1] * 255,
              b: parts[2] * 255,
              a: parts.length >= 4 ? parts[3] : 1,
            };
          }
        }

        return null;
      }

      function effectiveBackground(element: HTMLElement): Rgba | null {
        let color: Rgba = prefersDarkCanvas() ? { r: 0, g: 0, b: 0, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
        const chain: HTMLElement[] = [];
        let current: HTMLElement | null = element;
        while (current) {
          chain.unshift(current);
          current = current.parentElement;
        }

        for (const item of chain) {
          const background = parseColor(getComputedStyle(item).backgroundColor);
          if (background && background.a > 0) {
            color = blend(background, color);
          }
        }
        return color;
      }

      function prefersDarkCanvas(): boolean {
        const rootTheme = document.documentElement.dataset['theme'];
        return rootTheme === 'dark' || rootTheme === 'contrast';
      }

      function blend(foreground: Rgba, background: Rgba): Rgba {
        const alpha = foreground.a + background.a * (1 - foreground.a);
        if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
        return {
          r: (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha,
          g: (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha,
          b: (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha,
          a: alpha,
        };
      }

      function contrastRatio(foreground: Rgba, background: Rgba): number {
        const fg = relativeLuminance(foreground);
        const bg = relativeLuminance(background);
        const lighter = Math.max(fg, bg);
        const darker = Math.min(fg, bg);
        return (lighter + 0.05) / (darker + 0.05);
      }

      function relativeLuminance(color: Rgba): number {
        const [r, g, b] = [color.r, color.g, color.b]
          .map((channel) => channel / 255)
          .map((channel) => channel <= 0.03928
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }

      function isLargeText(fontSize: number, fontWeight: number): boolean {
        return fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
      }

      function selectorFor(element: HTMLElement): string {
        const testId = element.getAttribute('data-testid');
        if (testId) return `[data-testid="${testId}"]`;
        if (element.id) return `#${element.id}`;
        const className = Array.from(element.classList).slice(0, 2).join('.');
        return className ? `${element.localName}.${className}` : element.localName;
      }

      function round(value: number): number {
        return Math.round(value * 100) / 100;
      }
    },
    {
      normalTextContrast: options.normalTextContrast ?? 7,
      largeTextContrast: options.largeTextContrast ?? 4.5,
    },
  );

  expect(failures).toEqual([]);
}

export async function assertTextSpacingResilience(page: Page): Promise<void> {
  const styleId = 'uniplus-aaa-text-spacing';

  await page.addStyleTag({
    content: `
      #${styleId} {}
      body, body *:not(svg):not(path) {
        line-height: 1.5 !important;
        letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important;
      }
      p, li, dd, dt, blockquote {
        margin-bottom: 2em !important;
      }
    `,
  });
  await page.evaluate((id) => {
    const lastStyle = Array.from(document.head.querySelectorAll('style')).at(-1);
    if (lastStyle) lastStyle.id = id;
  }, styleId);

  try {
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await assertNavigationUsable(page);

    const overflow = await horizontalOverflow(page);
    expect(overflow).toEqual([]);

    const clipping = await page.evaluate(() => {
      type Failure = {
        selector: string;
        text: string;
        axis: 'x' | 'y';
        scrollSize: number;
        clientSize: number;
      };

      const failures: Failure[] = [];
      for (const element of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
        if (!isVisible(element) || !hasOwnText(element)) continue;

        const style = getComputedStyle(element);
        if (clips(style.overflowX) && element.scrollWidth > element.clientWidth + 1) {
          failures.push({
            selector: selectorFor(element),
            text: compactText(element),
            axis: 'x',
            scrollSize: element.scrollWidth,
            clientSize: element.clientWidth,
          });
        }
        if (clips(style.overflowY) && element.scrollHeight > element.clientHeight + 1) {
          failures.push({
            selector: selectorFor(element),
            text: compactText(element),
            axis: 'y',
            scrollSize: element.scrollHeight,
            clientSize: element.clientHeight,
          });
        }
      }
      return failures.slice(0, 20);

      function clips(value: string): boolean {
        return value === 'hidden' || value === 'clip';
      }

      function isVisible(element: HTMLElement): boolean {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none'
          && style.visibility !== 'hidden'
          && Number(style.opacity) !== 0
          && rect.width > 0
          && rect.height > 0;
      }

      function hasOwnText(element: HTMLElement): boolean {
        return Array.from(element.childNodes).some((node) =>
          node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim().length > 0,
        );
      }

      function compactText(element: HTMLElement): string {
        return (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
      }

      function selectorFor(element: HTMLElement): string {
        const testId = element.getAttribute('data-testid');
        if (testId) return `[data-testid="${testId}"]`;
        if (element.id) return `#${element.id}`;
        const className = Array.from(element.classList).slice(0, 2).join('.');
        return className ? `${element.localName}.${className}` : element.localName;
      }
    });

    expect(clipping).toEqual([]);
  } finally {
    await page.evaluate((id) => document.getElementById(id)?.remove(), styleId);
  }
}

export async function assertReflowContract(page: Page): Promise<void> {
  const overflow = await horizontalOverflow(page);
  expect(overflow).toEqual([]);

  const viewportWidth = page.viewportSize()?.width ?? await page.evaluate(() => window.innerWidth);
  if (viewportWidth <= 340) {
    await expect(page.locator('.topbar__nav')).toBeHidden();
    await assertDrawerNavigation(page);
    return;
  }

  if (viewportWidth >= 1024) {
    await expect(page.locator('.topbar__nav')).toBeVisible();
  }
}

async function waitForFonts(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.all([
      document.fonts?.load('16px Inter'),
      document.fonts?.load('16px "Atkinson Hyperlegible Next"'),
    ]);
    await document.fonts?.ready;
  });
}

async function horizontalOverflow(page: Page): Promise<readonly {
  selector: string;
  scrollWidth: number;
  clientWidth: number;
}[]> {
  return page.evaluate(() => {
    const failures = [];
    const root = document.documentElement;
    const body = document.body;

    if (root.scrollWidth > root.clientWidth + 1) {
      failures.push({
        selector: 'html',
        scrollWidth: root.scrollWidth,
        clientWidth: root.clientWidth,
      });
    }

    if (body.scrollWidth > root.clientWidth + 1) {
      failures.push({
        selector: 'body',
        scrollWidth: body.scrollWidth,
        clientWidth: root.clientWidth,
      });
    }

    return failures;
  });
}

async function assertNavigationUsable(page: Page): Promise<void> {
  const menuButton = page.getByRole('button', { name: 'Abrir menu', exact: true });
  if (await menuButton.isVisible()) {
    await assertDrawerNavigation(page);
    return;
  }

  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
}

async function assertDrawerNavigation(page: Page): Promise<void> {
  const menuButton = page.getByRole('button', { name: 'Abrir menu', exact: true });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(page.locator('dialog.uni-drawer[open]')).toBeVisible();
  await expect(page.locator('dialog.uni-drawer').getByRole('navigation', {
    name: 'Navegação principal',
  })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog.uni-drawer')).not.toHaveAttribute('open', '');
}
