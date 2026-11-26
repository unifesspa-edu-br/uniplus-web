import { expect, test } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import { PROCESSO_ID, FASE_DE_COLETA } from '../fixtures/processo-da-revisao';
import { mockarProcesso, prepararARevisao } from '../support/api-da-revisao';
import { identificadoresDe, medirTransbordo } from '../support/medicoes-do-passo';
import { irAoPasso } from '../support/navega-passo';
import {
  preencherAtoEPeriodo,
  conferirChecklistConforme,
  conferirPendencias,
  mockarPendencias,
  mockarAviso,
} from '../support/passos-da-revisao-conformidade';

/**
 * Matriz do Uni+ DS para o passo Revisão e Publicação (`#486`). O preflight —
 * checklist estrutural, conformidade legal, documento confirmado e tipo de
 * ato — só existe com um processo já criado, então a suíte entra pela rota de
 * retomada (`/processo-seletivo/{id}`) em vez de `/novo`, com o detalhe,
 * os documentos e os dois checklists mockados por rota.
 */
test.describe('Revisão e publicação — conformidade, matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await prepararARevisao(page, testInfo.project.name);
  });

  test('não viola WCAG 2.1 AA com checklist estrutural e legal conformes', async ({
    page,
  }, testInfo) => {
    await mockarProcesso(page, { cronogramaFases: [FASE_DE_COLETA] });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    await conferirChecklistConforme(page);

    const resultado = await runAxeWcagAA(page);
    expect(identificadoresDe(resultado)).toEqual([]);
  });

  test('não viola WCAG 2.1 AA sem fase de coleta — período de inscrição pedido nesta tela', async ({
    page,
  }, testInfo) => {
    await mockarProcesso(page, { cronogramaFases: [] });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    await preencherAtoEPeriodo(page);

    const resultado = await runAxeWcagAA(page);
    expect(identificadoresDe(resultado)).toEqual([]);
  });

  test('não viola WCAG 2.1 AA com pendências no checklist estrutural e legal', async ({
    page,
  }, testInfo) => {
    await mockarPendencias(page);
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    await conferirPendencias(page);

    const resultado = await runAxeWcagAA(page);
    expect(identificadoresDe(resultado)).toEqual([]);
  });

  test('não viola WCAG 2.1 AA com aviso de conformidade e checklist conforme', async ({
    page,
  }, testInfo) => {
    await mockarAviso(page);
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    await expect(page.getByRole('heading', { name: 'Avisos para conferir' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Ir para Cronograma/ })).toBeVisible();

    const resultado = await runAxeWcagAA(page);
    expect(identificadoresDe(resultado)).toEqual([]);
  });

  test('a frase de publicação simulada não existe mais', async ({ page }, testInfo) => {
    await mockarProcesso(page, { cronogramaFases: [FASE_DE_COLETA] });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    await expect(
      page.getByText(
        'A publicação será habilitada quando a integração com a API estiver disponível.',
      ),
    ).toHaveCount(0);
  });

  test('não transborda horizontalmente', async ({ page }, testInfo) => {
    await mockarProcesso(page, { cronogramaFases: [FASE_DE_COLETA] });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    const medida = await medirTransbordo(page);

    expect(medida.documento).toBeLessThanOrEqual(1);
    expect(medida.scroller).toBeLessThanOrEqual(1);
  });
});
