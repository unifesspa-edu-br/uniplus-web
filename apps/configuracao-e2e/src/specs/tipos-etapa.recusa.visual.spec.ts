import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import { mockApiDeTiposEtapa, novoCapturado, tipoDeEtapa } from '../support/api-de-tipos-etapa';
import { problema } from '../support/escritas-retidas';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

type Tema = 'light' | 'dark' | 'contrast';

const CODIGO_SEM_CONCEITO = 'uniplus.configuracao.tipo_etapa.correcao_independente_sem_conceito';
const RECUSA = {
  ...problema(422, 'uniplus.validacao', 'Dados inválidos', [
    {
      field: 'conceitosAdmitidos',
      code: CODIGO_SEM_CONCEITO,
      message: 'Escolha ao menos um conceito admitido.',
    },
  ]),
  type: 'https://developers.example.test/erros/uniplus.validacao',
};

function temaDoProjeto(testInfo: TestInfo): Tema {
  const tema = testInfo.project.metadata['theme'];
  return tema === 'dark' || tema === 'contrast' ? tema : 'light';
}

async function abrirComARecusaVisivel(page: Page): Promise<void> {
  await mockApiDeTiposEtapa(page, novoCapturado(), [tipoDeEtapa({})], {
    status: 422,
    corpo: RECUSA,
  });
  await page.goto('/tipos-etapa');
  await page.getByRole('button', { name: 'Novo tipo de etapa' }).first().click();
  await page.locator('[formControlName="codigo"]').fill('CORRECAO_DA_REDACAO');
  await page.locator('[formControlName="nome"]').fill('Correção da redação');
  await page.locator('label.checkbox').filter({ hasText: 'Exige correção independente' }).click();
  await page.getByRole('button', { name: 'Criar tipo de etapa' }).click();
  await expect(page.locator('#cfg-etapa-conceitos-erro')).toBeVisible();
}

test.describe('Tipo de etapa — recusa com código e página do erro, em cada tema', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await mockConfiguracaoRuntimeConfig(page);
    await page.addInitScript((tema: Tema) => {
      window.localStorage.setItem(
        'uniplus.a11y',
        JSON.stringify({
          theme: tema === 'contrast' ? 'auto' : tema,
          contrast: tema === 'contrast',
          fontMode: 'default',
        }),
      );
    }, temaDoProjeto(testInfo));
  });

  test('a recusa visível não tem violação WCAG A e AA, contraste incluído', async ({ page }) => {
    await abrirComARecusaVisivel(page);

    expect((await runAxeWcagAA(page)).violations.map((violacao) => violacao.id)).toEqual([]);
  });

  test('o código longo e o link não geram rolagem horizontal no drawer', async ({ page }) => {
    await abrirComARecusaVisivel(page);

    const drawer = page.getByRole('dialog', { name: 'Formulário de tipo de etapa' });
    const dimensoes = await drawer.evaluate((el) => ({
      largura: el.scrollWidth,
      visivel: el.clientWidth,
    }));
    expect(dimensoes.largura).toBeLessThanOrEqual(dimensoes.visivel);
  });
});
