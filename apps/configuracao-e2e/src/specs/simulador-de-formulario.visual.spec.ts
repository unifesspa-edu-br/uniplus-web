import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import { formularioDoSimulador } from '../support/formulario-do-simulador';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

type VisualTheme = 'light' | 'dark' | 'contrast';

/**
 * A tela de simulação de formulário (web#1027) nos temas e larguras da matriz: o formulário importado é
 * desenhado seção a seção, o campo condicionado aparece e some com a resposta e é anunciado, o aviso de
 * que nada é gravado fica visível, e nada transborda na horizontal, nem em 320 px. A acessibilidade é
 * conferida pelo axe sobre todas as violações de WCAG 2.1 AA, como pedem os specs novos.
 *
 * O arquivo é aberto no navegador e a simulação não chama a API: nada aqui depende do backend.
 */
const FORMULARIO = formularioDoSimulador();

test.describe('Simulador de formulário — temas, larguras e acessibilidade (web#1027)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const theme = metadataTheme(testInfo);
    await mockConfiguracaoRuntimeConfig(page);
    await page.addInitScript((dsTheme: VisualTheme) => {
      window.localStorage.setItem(
        'uniplus.a11y',
        JSON.stringify({
          theme: dsTheme === 'contrast' ? 'auto' : dsTheme,
          contrast: dsTheme === 'contrast',
          fontMode: 'default',
        }),
      );
    }, theme);

    await page.goto('/simulador-de-formulario');
    await expect(
      page.getByRole('heading', { name: 'Simulador de formulário', level: 1 }),
    ).toBeVisible();
    await page.getByLabel('Arquivo JSON do formulário').setInputFiles({
      name: 'formulario.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(FORMULARIO)),
    });
    await expect(page.getByRole('heading', { name: /Endereço/, level: 3 })).toBeVisible();
  });

  test('o campo condicionado aparece com a resposta e é anunciado, e o aviso de simulação fica visível', async ({
    page,
  }) => {
    await expect(page.getByRole('note')).toContainText('nada é gravado');
    await expect(page.getByLabel('Nome da aldeia')).toHaveCount(0);

    await page.locator('label', { hasText: 'Aldeia indígena' }).click();

    await expect(page.getByLabel('Nome da aldeia')).toBeVisible();
    // O formulário anuncia em duas regiões vivas, uma para os campos e outra para as modalidades,
    // para que um anúncio não apague o outro quando a mesma resposta muda os dois.
    await expect(
      page
        .locator('.formulario-candidato > [aria-live="polite"]')
        .filter({ hasText: 'Apareceu: Nome da aldeia.' }),
    ).toHaveCount(1);
  });

  test('não há violação de WCAG 2.1 AA na seção e no grupo repetível', async ({ page }) => {
    await page.locator('label', { hasText: 'Aldeia indígena' }).click();
    await semViolacoes(page);

    await page.getByRole('button', { name: 'Próxima seção' }).click();
    await page.getByRole('button', { name: /Acrescentar a integrante/ }).click();
    await expect(page.getByLabel('Renda mensal')).toBeVisible();
    await semViolacoes(page);
  });

  test('nada transborda na horizontal em 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.locator('label', { hasText: 'Aldeia indígena' }).click();
    await page.getByRole('button', { name: 'Próxima seção' }).click();
    await page.getByRole('button', { name: /Acrescentar a integrante/ }).click();

    const largura = await page.evaluate(() => ({
      pagina: document.documentElement.scrollWidth,
      janela: document.documentElement.clientWidth,
    }));
    expect(largura.pagina).toBeLessThanOrEqual(largura.janela);
  });
});

async function semViolacoes(page: Page): Promise<void> {
  const { violations } = await runAxeWcagAA(page);
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

function metadataTheme(testInfo: TestInfo): VisualTheme {
  const theme = testInfo.project.metadata['theme'];
  if (theme === 'light' || theme === 'dark' || theme === 'contrast') return theme;
  throw new Error(`Projeto visual sem tema conhecido: ${String(theme)}`);
}
