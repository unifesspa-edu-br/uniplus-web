import { expect, test, type Page } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import { PROCESSO_ID } from '../fixtures/processo-da-revisao';
import { CORS_HEADERS, mockarProcesso, prepararARevisao } from '../support/api-da-revisao';
import { identificadoresDe, medirTransbordo } from '../support/medicoes-do-passo';
import { responderCatalogos } from '../support/responder';

/**
 * Documentos publicados pelo processo: o ato tem a data do ato (um dia, sem instante) e o
 * instante em que foi publicado. As duas colunas são dados diferentes: a data do ato não anda um
 * dia com o fuso de quem lê, e o instante da publicação aparece com a hora.
 */

const DATA_DO_ATO = '15/01/2027';
const FUSOS_EXTREMOS = ['Pacific/Pago_Pago', 'Pacific/Kiritimati'] as const;

async function abrirPublicacoes(page: Page, nomeDoProject: string): Promise<void> {
  await prepararARevisao(page, nomeDoProject);
  await responderCatalogos(
    page,
    [
      ['selecao/campos-divulgacao', []],
      ['configuracao/fases-canonicas', []],
    ],
    CORS_HEADERS,
  );
  await mockarProcesso(page, { status: 'publicado' });
  await page.goto(`/processo-seletivo/${PROCESSO_ID}/publicacoes`);
  // Abaixo de 768 px a tabela vira pilha de cartões e perde o papel de tabela: o elemento fica.
  await expect(linha(page)).toBeVisible();
}

const linha = (page: Page) => page.locator('tbody tr').first();

test.describe('Publicações do processo — data do ato e instante da publicação @ds', () => {
  test('distingue as colunas "Data do ato" e "Publicado em"', async ({ page }, testInfo) => {
    await abrirPublicacoes(page, testInfo.project.name);

    await expect(page.locator('th[scope="col"]', { hasText: 'Data do ato' })).toHaveCount(1);
    await expect(page.locator('th[scope="col"]', { hasText: 'Publicado em' })).toHaveCount(1);
    await expect(linha(page).locator('td[data-label="Data do ato"]')).toHaveText(DATA_DO_ATO);
    await expect(linha(page).locator('td[data-label="Publicado em"]')).toContainText(/\d{2}:\d{2}/);
  });

  for (const fuso of FUSOS_EXTREMOS) {
    test.describe(`leitor em ${fuso}`, () => {
      test.use({ timezoneId: fuso });

      test('a data do ato não anda um dia com o fuso de quem lê', async ({ page }, testInfo) => {
        await abrirPublicacoes(page, testInfo.project.name);

        await expect(linha(page).locator('td[data-label="Data do ato"]')).toHaveText(DATA_DO_ATO);
      });
    });
  }

  test('não viola WCAG 2.1 AA nem transborda', async ({ page }, testInfo) => {
    await abrirPublicacoes(page, testInfo.project.name);

    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
    const medida = await medirTransbordo(page);
    expect(medida.documento).toBeLessThanOrEqual(1);
  });
});
