import { expect, test, type Page } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import { salvarADefinicaoRecusada } from '../support/definicao-do-fato';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/** --space-4: o espaço medido entre os dois avisos seguidos da definição, que não pode diminuir. */
const ESPACO_MINIMO_EM_PX = 16;

const LARGURAS = [
  { largura: 320, altura: 700 },
  { largura: 1366, altura: 900 },
] as const;

async function distanciaEntreOsAvisos(page: Page): Promise<number> {
  return page.evaluate(() => {
    const fimDoPrimeiro = document
      .querySelector('#cfg-fato-def-citacoes .alert')
      ?.getBoundingClientRect().bottom;
    const inicioDoSegundo = document
      .querySelector('#cfg-fato-def-recusa .alert')
      ?.getBoundingClientRect().top;
    if (fimDoPrimeiro === undefined || inicioDoSegundo === undefined) {
      throw new Error('Os dois avisos precisam estar na tela.');
    }
    return inicioDoSegundo - fimDoPrimeiro;
  });
}

test.describe('Fato do candidato — dois avisos seguidos na definição', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  for (const { largura, altura } of LARGURAS) {
    test(`com ${largura} px os avisos têm espaço entre si e o painel não rola na horizontal`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: largura, height: altura });
      const painel = await salvarADefinicaoRecusada(page);
      await page.locator('#cfg-fato-def-recusa').scrollIntoViewIfNeeded();

      expect(await distanciaEntreOsAvisos(page)).toBeGreaterThanOrEqual(ESPACO_MINIMO_EM_PX);
      const corpo = painel.locator('.uni-drawer__body');
      expect(await corpo.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(await painel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    });
  }

  test('os dois avisos juntos não têm violação WCAG A e AA', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await salvarADefinicaoRecusada(page);

    const { violations } = await runAxeWcagAA(page);

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
