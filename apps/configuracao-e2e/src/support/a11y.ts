import { expect, type Page } from '@playwright/test';
import { runAxeWcagAA, type RunAxeOptions } from '@uniplus/shared-e2e';

/**
 * Gate reduzido, restrito ao `configuracao-e2e`: assere apenas violações de
 * impacto `serious`/`critical`.
 *
 * **Isto é débito, não convenção.** `impact` é severidade do axe, não nível de
 * conformidade — filtrar por ele deixa passar violação de WCAG 2.1 A/AA
 * classificada como `moderate`. Hoje escapam cinco regras de nível A/AA:
 * `no-autoplay-audio` (1.4.2), `form-field-multiple-labels` (3.3.2),
 * `html-xml-lang-mismatch` (3.1.1), `aria-deprecated-role` e
 * `server-side-image-map`.
 *
 * A convenção do workspace é asserir sobre `violations` inteiro, como fazem
 * `selecao-e2e`, `portal-e2e` e `ingresso-e2e` — e como o spec da rota de
 * lista de calendários já faz. Este helper existe só para dar um nome ao
 * filtro herdado enquanto as telas restantes não são auditadas sem ele; specs
 * novos não devem usá-lo.
 */
export async function assertSemViolacoesGraves(
  page: Page,
  options: RunAxeOptions = {},
): Promise<void> {
  const { violations } = await runAxeWcagAA(page, options);
  const graves = violations.filter(
    ({ impact }) => impact === 'serious' || impact === 'critical',
  );
  expect(graves, JSON.stringify(graves, null, 2)).toEqual([]);
}
