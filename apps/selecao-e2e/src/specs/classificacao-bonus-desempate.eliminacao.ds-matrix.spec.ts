import { expect, test, type Route } from '@playwright/test';
import { mockPermissoesEfetivas, runAxeWcagAA } from '@uniplus/shared-e2e';
import { RESOLUCAO_PESO_AREA } from '../fixtures/catalogos-da-classificacao';
import {
  ETAPA_ENTREVISTA_ID,
  DETALHE_PUBLICADO,
  PROCESSO_AUSENCIA_ID,
} from '../fixtures/processo-classificado';
import { CORS_DE_LEITURA } from '../support/processo-mockado';
import {
  abrirProcessoDoCenario,
  abrirProcessoNovo,
  alturaDoProject,
  declararFormulaLocal,
  LARGURAS_DE_REFERENCIA,
} from '../support/consulta-da-classificacao';
import { identificadoresDe } from '../support/medicoes-do-passo';
import { irAoPasso } from '../support/navega-passo';
import { isolarDaApi } from '../support/isolar-da-api';
import { PERMISSOES_DO_LEANDRO } from '../support/permissoes';
import { medirTransbordoHorizontal } from '../support/rolagem-do-editor';

test.beforeEach(async ({ page }) => {
  await isolarDaApi(page);
  await mockPermissoesEfetivas(page, PERMISSOES_DO_LEANDRO);
});

test.describe('Classificação, bônus e desempate — matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await abrirProcessoNovo(page, testInfo);
  });

  test.describe('Eliminação', () => {
    /** ELIM-ZERO-EM-AREA não usa argumento — a única regra que dispensa etapa persistida. */
    test('não viola WCAG 2.1 AA com uma regra de eliminação sem argumento', async ({
      page,
    }, testInfo) => {
      await irAoPasso(page, 'Fórmula e precisão', testInfo);
      await declararFormulaLocal(page);
      await page.getByLabel('Classificação baseada em provas').check();

      await irAoPasso(page, 'Eliminação', testInfo);
      await page.getByRole('button', { name: '+ Acrescentar regra de eliminação' }).click();
      await page
        .getByLabel('Regra de eliminação', { exact: true })
        .selectOption('ELIM-ZERO-EM-AREA|1.0');

      const resultado = await runAxeWcagAA(page);
      expect(identificadoresDe(resultado)).toEqual([]);
    });

    test('corte por área: oferece as áreas do quadro, sugere o corte e não viola WCAG 2.1 AA', async ({
      page,
    }, testInfo) => {
      await irAoPasso(page, 'Fórmula e precisão', testInfo);
      await declararFormulaLocal(page);
      await page.getByLabel('Classificação baseada em provas').check();
      await page
        .getByLabel('Resolução de Peso por Área', { exact: true })
        .selectOption(RESOLUCAO_PESO_AREA);

      await irAoPasso(page, 'Eliminação', testInfo);
      await page.getByRole('button', { name: '+ Acrescentar regra de eliminação' }).click();
      await page
        .getByLabel('Regra de eliminação', { exact: true })
        .selectOption('ELIM-CORTE-EM-AREA|1.0');
      await page.getByLabel('Área do ENEM', { exact: true }).selectOption('REDACAO');

      const minimo = page.getByLabel('Nota mínima em Redação', { exact: true });
      await expect(minimo).toHaveValue('400');
      await expect(page.getByText(/dá o corte 400 para esta área/)).toBeVisible();

      const resultado = await runAxeWcagAA(page);
      expect(identificadoresDe(resultado)).toEqual([]);
    });

    test('avisa quando nenhuma etapa do cronograma compõe a nota', async ({ page }, testInfo) => {
      await irAoPasso(page, 'Fórmula e precisão', testInfo);
      await declararFormulaLocal(page);

      await irAoPasso(page, 'Eliminação', testInfo);

      await expect(page.getByRole('alert').filter({ hasText: 'Nenhuma etapa' })).toBeVisible();
    });
  });

  test('não transborda horizontalmente na Eliminação', async ({ page }, testInfo) => {
    await irAoPasso(page, 'Eliminação', testInfo);

    const medida = await page.evaluate(() => {
      const documento = document.documentElement;
      const scroller = document.querySelector('.wiz-content');
      return {
        documento: documento.scrollWidth - documento.clientWidth,
        scroller: scroller instanceof HTMLElement ? scroller.scrollWidth - scroller.clientWidth : 0,
      };
    });

    expect(medida.documento).toBeLessThanOrEqual(1);
    expect(medida.scroller).toBeLessThanOrEqual(1);
  });
});

/**
 * Eliminação por ausência na etapa, em rascunho: a escolha da etapa oferece as que não são do
 * ENEM, a regra não pede nota mínima, e a recusa do servidor aparece junto do campo da etapa.
 */
test.describe('Eliminação por ausência na etapa em edição — matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await abrirProcessoDoCenario(page, testInfo, PROCESSO_AUSENCIA_ID, {
      ...DETALHE_PUBLICADO,
      id: PROCESSO_AUSENCIA_ID,
      status: 'rascunho',
    });
    await irAoPasso(page, 'Eliminação', testInfo);
  });

  test('oferece só etapas fora do ENEM, não pede nota mínima e não viola WCAG 2.1 AA', async ({
    page,
  }, testInfo) => {
    await page.getByRole('button', { name: '+ Acrescentar regra de eliminação' }).click();
    await page.locator('#elim-regra-2').selectOption('ELIM-AUSENCIA-NA-ETAPA|1.0');

    const etapa = page.locator('#elim-etapa-2');
    await expect(etapa.locator('option')).toHaveText(['— escolher —']);
    await expect(page.getByLabel('Nota mínima', { exact: true })).toHaveCount(0);

    // A etapa gravada na regra 2 não é oferecida de novo, e a do ENEM nunca.
    const gravada = page.locator('#elim-etapa-1');
    await expect(gravada.locator('option')).toHaveText(['— escolher —', 'Entrevista']);
    await expect(gravada).toHaveValue(ETAPA_ENTREVISTA_ID);

    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
    for (const largura of LARGURAS_DE_REFERENCIA) {
      await page.setViewportSize({ width: largura, height: alturaDoProject(testInfo) });
      const medida = await medirTransbordoHorizontal(page);
      expect(medida.documento, `documento em ${largura} px`).toBeLessThanOrEqual(1);
    }
  });

  test('põe a recusa do servidor junto do campo da etapa', async ({ page }) => {
    await page.route(
      `**/api/selecao/processos-seletivos/${PROCESSO_AUSENCIA_ID}/classificacao`,
      async (route: Route) => {
        const cabecalhos = { ...CORS_DE_LEITURA, 'access-control-allow-methods': 'PUT, OPTIONS' };
        if (route.request().method() === 'OPTIONS') {
          await route.fulfill({ status: 204, headers: cabecalhos });
          return;
        }
        await route.fulfill({
          status: 422,
          contentType: 'application/problem+json',
          headers: cabecalhos,
          body: JSON.stringify({
            type: 'about:blank',
            title: 'Recusada.',
            status: 422,
            code: 'uniplus.validacao',
            traceId: 't',
            errors: [
              {
                field: 'regrasEliminacao[0].etapaRef',
                code: 'uniplus.selecao.configuracao_classificacao.ausencia_na_etapa_repetida',
                message: 'repetida',
              },
            ],
          }),
        });
      },
    );
    // A regra de zero em área só vale no ENEM e travaria a gravação antes de a API ser chamada.
    await page.getByRole('button', { name: 'Remover regra de eliminação 1' }).click();

    await page.getByRole('button', { name: 'Gravar e avançar' }).click();
    await page.getByRole('button', { name: 'Gravar classificação' }).click();

    const etapa = page.locator('#elim-etapa-0');
    await expect(etapa).toHaveAttribute('aria-invalid', 'true');
    await expect(etapa).toHaveAttribute('aria-describedby', /elim-etapa-erro-0/);
    await expect(page.locator('#elim-etapa-erro-0')).toContainText('já foi declarada');
  });
});
