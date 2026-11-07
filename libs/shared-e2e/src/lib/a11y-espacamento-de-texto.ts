import { expect, type Page } from '@playwright/test';

import { assertNavigationUsable, horizontalOverflow } from './a11y-reflow';
import { NOME_DA_SONDA, type SondaDoNavegador } from './sonda-do-navegador';
import { instalarSondaCompleta } from './sonda-de-verificacoes';

const ID_DO_ESTILO = 'uniplus-aaa-text-spacing';

/** Os espaçamentos de texto do SC 1.4.12 (WCAG 2.1 AA), aplicados com `!important` à página inteira. */
const ESTILO_DE_ESPACAMENTO = `
      #${ID_DO_ESTILO} {}
      body, body *:not(svg):not(path) {
        line-height: 1.5 !important;
        letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important;
      }
      p, li, dd, dt, blockquote {
        margin-bottom: 2em !important;
      }
    `;

export async function assertTextSpacingResilience(page: Page): Promise<void> {
  await page.addStyleTag({ content: ESTILO_DE_ESPACAMENTO });
  await page.evaluate((id) => {
    const lastStyle = Array.from(document.head.querySelectorAll('style')).at(-1);
    if (lastStyle) lastStyle.id = id;
  }, ID_DO_ESTILO);

  try {
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await assertNavigationUsable(page);

    const overflow = await horizontalOverflow(page);
    expect(overflow).toEqual([]);

    await instalarSondaCompleta(page);
    const clipping = await page.evaluate((nome) => {
      const sonda = (window as unknown as Record<string, SondaDoNavegador>)[nome];
      return Array.from(document.body.querySelectorAll<HTMLElement>('*'))
        .flatMap((element) => sonda.falhasDeCorte(element))
        .slice(0, 20);
    }, NOME_DA_SONDA);

    expect(clipping).toEqual([]);
  } finally {
    await page.evaluate((id) => document.getElementById(id)?.remove(), ID_DO_ESTILO);
  }
}
