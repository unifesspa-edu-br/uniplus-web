import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
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
   * Útil para suprimir elementos com violations conhecidas em libs de
   * terceiros (Keycloak login, PrimeNG legados) enquanto há fix em curso.
   */
  readonly exclude?: readonly string[];
}

/**
 * Roda axe-core na página atual filtrado por WCAG 2.1 A + AA. Retorna o
 * `AxeResults` para o caller asserir sobre `violations`.
 *
 * **Pattern de uso em specs:**
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
