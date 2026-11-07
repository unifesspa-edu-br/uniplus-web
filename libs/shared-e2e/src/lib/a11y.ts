import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import type { AxeResults, RuleObject } from 'axe-core';

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
 * Regras marcadas como `experimental` no axe-core vêm com `enabled: false` e
 * **não rodam só por estarem na tag** — precisam ser habilitadas caso a caso.
 *
 * `label-content-name-mismatch` cobre o SC 2.5.3 (Label in Name, **nível A**):
 * o nome acessível precisa conter o texto visível, sob pena de quem usa
 * comando de voz dizer o rótulo que lê na tela e não ativar o elemento. É a
 * única regra da tag `wcag21a` no axe-core 4.12.x, então sem esta habilitação
 * a tag não acrescenta cobertura nenhuma e o gate roda verde sobre a violação.
 *
 * Nível A é piso regulatório (e-MAG 3.1, Lei 13.146/2015) — a regra ser
 * experimental no axe-core não a torna opcional para autarquia federal.
 *
 * Deliberadamente não exportada: habilitar por spec recria o furo que ela
 * fecha. O caminho é passar por `runAxeWcagAA`.
 */
const REGRAS_EXPERIMENTAIS_HABILITADAS: Readonly<RuleObject> = {
  'label-content-name-mismatch': { enabled: true },
};

/**
 * Superset automatizável para o contrato visual AAA do Uni+ DS. Mantém A/AA
 * como baseline regulatório e adiciona `wcag2aaa` apenas como gate visual
 * aplicável, sem declarar conformidade WCAG AAA completa.
 */
export const WCAG_AAA_APPLICABLE_TAGS = [...WCAG_A_AA_TAGS, 'wcag2aaa'] as const;

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
 * no momento da chamada — elementos lazy-loaded podem ser perdidos. As
 * animações finitas em curso, como a abertura de um diálogo, são esperadas
 * aqui antes da análise.
 */
export async function runAxeWcagAA(page: Page, options: RunAxeOptions = {}): Promise<AxeResults> {
  // Tags e regras num único `RunOptions`. Encadear `.withTags()` com
  // `.options()` também funcionaria, mas só numa ordem: `.options()`
  // substitui o objeto de opções do AxeBuilder, enquanto `.withTags()`
  // escreve `runOnly` dentro dele.
  let builder = new AxeBuilder({ page }).options({
    runOnly: { type: 'tag', values: [...(options.tags ?? WCAG_A_AA_TAGS)] },
    rules: { ...REGRAS_EXPERIMENTAIS_HABILITADAS },
  });

  if (options.include) {
    builder = builder.include(options.include);
  }

  // Encadeia .exclude() por seletor — a API AxeBuilder interpreta arrays
  // como navegação cross-frame (iframe → shadowDOM), NÃO como múltiplos
  // seletores irmãos. Cada chamada acumula no exclude internal list.
  for (const selector of options.exclude ?? []) {
    builder = builder.exclude(selector);
  }

  await esperarAnimacoesFinitas(page);
  return builder.analyze();
}

/**
 * Espera o fim das animações e transições finitas em curso. O axe mede o
 * contraste pela cor composta no instante da análise: um painel que ainda está
 * aparecendo por opacidade mistura o texto com o fundo e produz uma violação
 * que some quando a animação termina. As animações infinitas (indicadores de
 * carregamento) ficam de fora, porque nunca terminam.
 */
async function esperarAnimacoesFinitas(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animacao) => animacao.effect?.getComputedTiming().iterations !== Infinity)
        .map((animacao) => animacao.finished.catch(() => undefined)),
    ),
  );
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
