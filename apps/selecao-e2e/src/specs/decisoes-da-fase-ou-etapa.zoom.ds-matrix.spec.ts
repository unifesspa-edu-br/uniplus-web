import { expect, test } from '@playwright/test';
import { novoServidorDosTiposDeDecisao } from '../support/api-dos-tipos-de-decisao';
import { medirTransbordo } from '../support/medicoes-do-passo';
import { abrirAEtapa, abrirAFase, abrirOCronograma } from '../support/passo-das-decisoes';
import { ESCOPOS_DAS_DECISOES, textosCortados } from '../support/teclado-das-decisoes';

/**
 * Ampliação de 200% sobre uma janela de 1280 px, que o navegador entrega como 640 px de largura.
 * A janela é reduzida a esses 640 px e a página recebe o zoom de 2, o que deixa 320 px úteis:
 * o limite de reflow da WCAG 2.1. Nada rola na horizontal e legenda e rótulos aparecem inteiros.
 */

const LARGURA_DA_JANELA_A_200_POR_CENTO = 640;
const ALTURA_DA_JANELA_A_200_POR_CENTO = 450;
const FATOR_DE_ZOOM = 2;

for (const escopo of ESCOPOS_DAS_DECISOES) {
  test.describe(`Decisões da ${escopo.nome}: ampliação — matriz DS @ds`, () => {
    test('a 200% de ampliação não rola na horizontal nem corta a legenda e os rótulos', async ({
      page,
    }, testInfo) => {
      await abrirOCronograma(page, testInfo, novoServidorDosTiposDeDecisao('rascunho'));
      await abrirAFase(page);
      await abrirAEtapa(page);
      await page.setViewportSize({
        width: LARGURA_DA_JANELA_A_200_POR_CENTO,
        height: ALTURA_DA_JANELA_A_200_POR_CENTO,
      });
      await page.evaluate((fator) => {
        document.documentElement.style.zoom = String(fator);
      }, FATOR_DE_ZOOM);

      const grupo = escopo.grupo(page);
      await grupo.scrollIntoViewIfNeeded();
      await expect(grupo.locator('legend')).toHaveText(escopo.titulo);
      await expect(grupo.locator('legend')).toBeVisible();
      const medida = await medirTransbordo(page);
      expect(medida.documento).toBeLessThanOrEqual(1);
      expect(medida.scroller).toBeLessThanOrEqual(1);
      expect(await textosCortados(grupo)).toEqual([]);
    });
  });
}
