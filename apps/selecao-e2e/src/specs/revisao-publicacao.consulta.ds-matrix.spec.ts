import { expect, test } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import {
  conferirRolagemPorRodaForaDoConteudo,
  conferirRolagemPorTeclado,
  conferirStepperNaAlturaDaArea,
  encurtarJanela,
  medirTransbordoHorizontal,
  rolarAteOMeio,
} from '../support/rolagem-do-editor';
import { PROCESSO_ID, FASE_DE_COLETA } from '../fixtures/processo-da-revisao';
import { mockarProcesso, mockarAtoPublicado, prepararARevisao } from '../support/api-da-revisao';
import { identificadoresDe, medirTransbordo } from '../support/medicoes-do-passo';
import { irAoPasso } from '../support/navega-passo';

test.describe('Revisão e publicação — consulta ao processo publicado, matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await prepararARevisao(page, testInfo.project.name);
  });

  test('em consulta, mostra o ato publicado como texto sem violar WCAG 2.1 AA nem transbordar', async ({
    page,
  }, testInfo) => {
    await mockarAtoPublicado(page);
    await mockarProcesso(page, { status: 'publicado', cronogramaFases: [FASE_DE_COLETA] });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    const ato = page.getByRole('definition').filter({ hasText: '001/2027' });
    await expect(ato).toBeVisible();
    await expect(page.getByText('Reitor da Unifesspa')).toBeVisible();
    await expect(page.getByText('15/01/2027')).toBeVisible();
    await expect(page.getByLabel('Número do ato (opcional)', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Salvar rascunho' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Publicar' })).toHaveCount(0);

    const resultado = await runAxeWcagAA(page);
    expect(identificadoresDe(resultado)).toEqual([]);

    const medida = await medirTransbordo(page);

    expect(medida.documento).toBeLessThanOrEqual(1);
    expect(medida.scroller).toBeLessThanOrEqual(1);
  });

  test('em consulta, rola a área de trabalho pelo teclado e pela roda fora do conteúdo do passo', async ({
    page,
  }, testInfo) => {
    await mockarAtoPublicado(page);
    await mockarProcesso(page, { status: 'publicado', cronogramaFases: [FASE_DE_COLETA] });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // O passo que abre sozinho cabe na janela encurtada; o ato publicado é o que passa dela.
    await irAoPasso(page, 'Revisão e publicação', testInfo);
    await encurtarJanela(page);

    await conferirRolagemPorTeclado(page);
    await conferirRolagemPorRodaForaDoConteudo(page);

    await rolarAteOMeio(page);
    await conferirStepperNaAlturaDaArea(page);
    const resultado = await runAxeWcagAA(page);
    expect(identificadoresDe(resultado)).toEqual([]);
    const transbordo = await medirTransbordoHorizontal(page);
    expect(transbordo.documento).toBeLessThanOrEqual(1);
    expect(transbordo.areaDeTrabalho).toBeLessThanOrEqual(1);
  });
});
