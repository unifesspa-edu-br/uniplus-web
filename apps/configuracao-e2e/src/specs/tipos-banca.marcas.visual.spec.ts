import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import {
  assertOrdemDeFocoSegueOLeiaute,
  assertReflowContract,
  mockPermissoesEfetivas,
  runAxeWcagAA,
} from '@uniplus/shared-e2e';
import {
  mockarTiposDeBanca,
  TIPO_ENTREVISTA,
  TIPO_HETEROIDENTIFICACAO,
} from '../support/api-dos-tipos-de-banca';
import { PERMISSOES_DE_QUEM_ADMINISTRA_OS_TIPOS_DE_BANCA } from '../support/permissoes';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

type VisualTheme = 'light' | 'dark' | 'contrast';

const LARGURA_MINIMA_DO_REFLOW = 320;

function metadataTheme(testInfo: TestInfo): VisualTheme {
  const theme = testInfo.project.metadata['theme'];
  return theme === 'dark' || theme === 'contrast' ? theme : 'light';
}

const formulario = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Formulário de tipo de banca' });

async function abrirFormularioDaHeteroidentificacao(page: Page): Promise<Locator> {
  await page.goto('/tipos-banca');
  await page
    .getByRole('button', { name: `Editar tipo de banca ${TIPO_HETEROIDENTIFICACAO.codigo.rotulo}` })
    .click();
  const drawer = formulario(page);
  await expect(drawer).toBeVisible();
  await expect(drawer.locator('#cfg-papel')).toHaveValue('AVALIA_O_MERITO');
  await drawer.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((animacao) => animacao.finished)),
  );
  return drawer;
}

async function semViolacoes(page: Page): Promise<void> {
  const { violations } = await runAxeWcagAA(page);
  expect(
    violations.map((violacao) => violacao.id),
    JSON.stringify(violations, null, 2),
  ).toEqual([]);
}

test.describe('Tipos de banca — marcas, acessibilidade e reflow', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await mockConfiguracaoRuntimeConfig(page);
    await mockPermissoesEfetivas(page, PERMISSOES_DE_QUEM_ADMINISTRA_OS_TIPOS_DE_BANCA);
    await mockarTiposDeBanca(page, [TIPO_ENTREVISTA, TIPO_HETEROIDENTIFICACAO]);
    await page.addInitScript((theme: VisualTheme) => {
      window.localStorage.setItem(
        'uniplus.a11y',
        JSON.stringify({
          theme: theme === 'contrast' ? 'auto' : theme,
          contrast: theme === 'contrast',
          fontMode: 'default',
        }),
      );
    }, metadataTheme(testInfo));
  });

  test('a lista com a coluna de marcas não viola WCAG 2.1 A/AA', async ({ page }) => {
    await page.goto('/tipos-banca');
    await expect(page.locator('table tbody tr')).toHaveCount(2);

    await semViolacoes(page);
  });

  test('o formulário com as marcas não viola WCAG 2.1 A/AA e o Tab segue a ordem de leitura', async ({
    page,
  }) => {
    const drawer = await abrirFormularioDaHeteroidentificacao(page);

    await semViolacoes(page);
    await assertOrdemDeFocoSegueOLeiaute(drawer.locator('form'), page);
  });

  test('a lista e o formulário cabem em 320 px sem rolagem horizontal', async ({ page }) => {
    await page.setViewportSize({ width: LARGURA_MINIMA_DO_REFLOW, height: 720 });
    await page.goto('/tipos-banca');
    await expect(page.locator('table tbody tr')).toHaveCount(2);
    await assertReflowContract(page);

    const drawer = await abrirFormularioDaHeteroidentificacao(page);

    const medidas = await drawer.evaluate((el) => ({
      largura: el.scrollWidth,
      visivel: el.clientWidth,
    }));
    expect(medidas.largura).toBeLessThanOrEqual(medidas.visivel + 1);
    const excessoDoDocumento = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(excessoDoDocumento).toBeLessThanOrEqual(1);
  });
});
