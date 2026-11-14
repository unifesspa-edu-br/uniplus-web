import { expect, test } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import { PROCESSO_ID, FASE_DE_COLETA, RASCUNHO_COM_ANEXOS } from '../fixtures/processo-da-revisao';
import { mockarProcesso, mockarAtoPublicado, prepararARevisao } from '../support/api-da-revisao';
import { identificadoresDe, medirTransbordo } from '../support/medicoes-do-passo';
import { irAoPasso } from '../support/navega-passo';

test.describe('Revisão e publicação — anexos do ato, matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await prepararARevisao(page, testInfo.project.name);
  });

  test('com anexos no rascunho, lista o nome de cada um e não viola WCAG 2.1 AA nem transborda', async ({
    page,
  }, testInfo) => {
    await mockarProcesso(page, {
      cronogramaFases: [FASE_DE_COLETA],
      rascunhoDaPublicacao: RASCUNHO_COM_ANEXOS,
    });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    const nome = page.getByLabel('Nome do anexo cronograma.pdf', { exact: true });
    await expect(nome).toHaveValue('Cronograma detalhado');
    await expect(
      page.getByLabel('Nome do anexo modelo-de-recurso.docx', { exact: true }),
    ).toHaveValue('Modelo de recurso');

    // O nome que o download não aceitaria é dito no campo, ligado a ele para o leitor de tela.
    await nome.fill('pasta/cronograma');
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText(/O nome do anexo não pode ter/)).toBeVisible();
    await nome.fill('Cronograma detalhado');
    await expect(nome).not.toHaveAttribute('aria-invalid', 'true');

    const resultado = await runAxeWcagAA(page);
    expect(identificadoresDe(resultado)).toEqual([]);

    const medida = await medirTransbordo(page);
    expect(medida.documento).toBeLessThanOrEqual(1);
    expect(medida.scroller).toBeLessThanOrEqual(1);
  });

  test('em consulta, mostra como texto os anexos que a versão vigente publicou', async ({
    page,
  }, testInfo) => {
    await mockarAtoPublicado(page);
    await mockarProcesso(page, { status: 'publicado', cronogramaFases: [FASE_DE_COLETA] });
    await page.goto(`/processo-seletivo/${PROCESSO_ID}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await irAoPasso(page, 'Revisão e publicação', testInfo);

    const anexos = page.locator('sel-anexos-do-edital');
    await expect(anexos.getByText('Cronograma detalhado.pdf')).toBeVisible();
    await expect(anexos.getByText('modelo-de-recurso.pdf', { exact: false }).first()).toBeVisible();
    await expect(anexos.getByRole('textbox')).toHaveCount(0);
    await expect(
      anexos.getByRole('button', { name: /Abrir o anexo Cronograma detalhado/ }),
    ).toBeVisible();

    const resultado = await runAxeWcagAA(page);
    expect(identificadoresDe(resultado)).toEqual([]);

    const medida = await medirTransbordo(page);
    expect(medida.documento).toBeLessThanOrEqual(1);
    expect(medida.scroller).toBeLessThanOrEqual(1);
  });
});
