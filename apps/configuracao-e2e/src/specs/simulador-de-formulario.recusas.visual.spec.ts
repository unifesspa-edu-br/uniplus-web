import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import { formularioDoSimulador } from '../support/formulario-do-simulador';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

type VisualTheme = 'light' | 'dark' | 'contrast';

/**
 * Quando o servidor recusa as regras na conferência, o simulador lista todas as recusas, cada uma com
 * o campo a que se refere, e leva o foco ao título da lista. A lista é conferida nos temas e larguras
 * da matriz: sem violação de WCAG 2.1 AA e sem transbordo horizontal, nem em 320 px.
 *
 * A resposta do servidor é simulada: nada aqui depende do backend.
 */
const RECUSAS = [
  {
    code: 'uniplus.teste.primeira',
    message: 'A primeira regra foi recusada.',
    field: 'paginas[0]',
  },
  {
    code: 'uniplus.teste.segunda',
    message: 'A segunda regra foi recusada, e a mensagem é longa para conferir a quebra de linha.',
    field: 'regras.derivacoes[3].condicao.valores[12].identificador_muito_comprido_sem_espaco',
  },
  { code: 'uniplus.teste.terceira', message: 'Recusa sem campo.' },
];

test.describe('Simulador de formulário — recusas da conferência (web#1755)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await mockConfiguracaoRuntimeConfig(page);
    await instalarTema(page, metadataTheme(testInfo));
    await page.route('**/api/configuracao/admin/avaliacoes-de-formulario', (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          title: 'Regras recusadas',
          status: 422,
          code: 'uniplus.configuracao.regras_recusadas',
          errors: RECUSAS,
        }),
      }),
    );
    await page.goto('/simulador-de-formulario');
    await page.getByLabel('Arquivo JSON do formulário').setInputFiles({
      name: 'formulario.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(formularioDoSimulador())),
    });
    await page.getByRole('button', { name: 'Conferir com o servidor' }).click();
  });

  test('lista as três recusas, mostra o campo só onde há e leva o foco ao título', async ({
    page,
  }) => {
    const titulo = page.getByRole('heading', {
      name: /O servidor não conferiu a simulação: 3 recusas/,
    });
    await expect(titulo).toBeFocused();
    await expect(page.locator('.recusas-da-conferencia__lista li')).toHaveCount(3);
    await expect(page.locator('.recusas-da-conferencia__onde')).toHaveCount(2);
  });

  test('não há violação de WCAG 2.1 AA com a lista de recusas', async ({ page }) => {
    await expect(page.locator('.recusas-da-conferencia__lista')).toBeVisible();
    const { violations } = await runAxeWcagAA(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('nada transborda na horizontal em 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await expect(page.locator('.recusas-da-conferencia__lista')).toBeVisible();
    const largura = await page.evaluate(() => ({
      pagina: document.documentElement.scrollWidth,
      janela: document.documentElement.clientWidth,
    }));
    expect(largura.pagina).toBeLessThanOrEqual(largura.janela);
  });
});

async function instalarTema(page: Page, theme: VisualTheme): Promise<void> {
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
}

function metadataTheme(testInfo: TestInfo): VisualTheme {
  const theme = testInfo.project.metadata['theme'];
  if (theme === 'light' || theme === 'dark' || theme === 'contrast') return theme;
  throw new Error(`Projeto visual sem tema conhecido: ${String(theme)}`);
}
