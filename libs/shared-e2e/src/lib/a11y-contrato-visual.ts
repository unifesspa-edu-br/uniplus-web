import { expect, type Page } from '@playwright/test';

import { horizontalOverflow } from './a11y-reflow';
import { NOME_DA_SONDA, type SondaDoNavegador } from './sonda-do-navegador';
import { instalarSondaCompleta } from './sonda-de-verificacoes';

type ModoDeFonte = 'default' | 'legible';

export interface AaaVisualContractOptions {
  readonly fontMode?: ModoDeFonte;
  readonly normalTextContrast?: number;
  readonly largeTextContrast?: number;
}

export async function assertAaaVisualContract(
  page: Page,
  options: AaaVisualContractOptions = {},
): Promise<void> {
  await waitForFonts(page);
  await assertFontes(page, options.fontMode ?? (await modoDeFonteDaPagina(page)));

  const layout = await horizontalOverflow(page);
  expect(layout).toEqual([]);

  await instalarSondaCompleta(page);
  const failures = await page.evaluate(
    ({ nome, contrastes }) => {
      const sonda = (window as unknown as Record<string, SondaDoNavegador>)[nome];
      return Array.from(document.body.querySelectorAll<HTMLElement>('*'))
        .flatMap((element) => sonda.falhasTipograficas(element, contrastes))
        .slice(0, 30);
    },
    {
      nome: NOME_DA_SONDA,
      contrastes: {
        normalTextContrast: options.normalTextContrast ?? 7,
        largeTextContrast: options.largeTextContrast ?? 4.5,
      },
    },
  );

  expect(failures).toEqual([]);
}

function modoDeFonteDaPagina(page: Page): Promise<ModoDeFonte> {
  return page.evaluate(() =>
    document.documentElement.dataset['fontMode'] === 'legible' ? 'legible' : 'default',
  );
}

async function assertFontes(page: Page, expectedFontMode: ModoDeFonte): Promise<void> {
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
