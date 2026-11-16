import { expect, test } from '@playwright/test';
import { mockPermissoesEfetivas, runAxeWcagAA } from '@uniplus/shared-e2e';
import {
  DETALHE_PUBLICADO,
  LEITURAS,
  PROCESSO_PUBLICADO_ID,
} from '../fixtures/processo-classificado';
import {
  abrirProcessoDoCenario,
  alturaDoProject,
  controlesVisiveis,
  LARGURAS_DE_REFERENCIA,
  valorEmConsulta,
} from '../support/consulta-da-classificacao';
import { identificadoresDe } from '../support/medicoes-do-passo';
import { irAoPasso } from '../support/navega-passo';
import { PERMISSOES_DO_LEANDRO } from '../support/permissoes';
import { blocosColados } from '../support/ritmo-vertical';
import { medirTransbordoHorizontal } from '../support/rolagem-do-editor';

test.beforeEach(async ({ page }) => {
  await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);
});

/**
 * Consulta de um processo publicado (web#898, web#905): o valor gravado de cada campo aparece
 * como texto, associado ao rótulo, mesmo com o catálogo chegando depois do detalhe, e o passo
 * não oferece controle nem ação de edição.
 */
test.describe('Classificação, bônus e desempate em consulta — matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await abrirProcessoDoCenario(page, testInfo, PROCESSO_PUBLICADO_ID, DETALHE_PUBLICADO);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  for (const [passo, leituras] of Object.entries(LEITURAS)) {
    test(`${passo}: lê o valor gravado como texto, sem controle, e não transborda`, async ({
      page,
    }, testInfo) => {
      await irAoPasso(page, passo, testInfo);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(passo);

      for (const [rotulo, trecho] of Object.entries(leituras)) {
        await expect(valorEmConsulta(page, rotulo), rotulo).toContainText(trecho);
      }
      expect(await controlesVisiveis(page)).toEqual([]);
      expect(await blocosColados(page)).toEqual([]);

      const resultado = await runAxeWcagAA(page);
      expect(identificadoresDe(resultado)).toEqual([]);

      for (const largura of LARGURAS_DE_REFERENCIA) {
        await page.setViewportSize({ width: largura, height: alturaDoProject(testInfo) });
        const medida = await medirTransbordoHorizontal(page);
        expect(medida.documento, `documento em ${largura} px`).toBeLessThanOrEqual(1);
        expect(medida.areaDeTrabalho, `área de trabalho em ${largura} px`).toBeLessThanOrEqual(1);
      }
    });
  }
});
