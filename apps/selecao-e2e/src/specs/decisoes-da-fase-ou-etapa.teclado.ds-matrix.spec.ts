import { expect, test } from '@playwright/test';
import { novoServidorDosTiposDeDecisao } from '../support/api-dos-tipos-de-decisao';
import { abrirAEtapa, abrirAFase, abrirOCronograma } from '../support/passo-das-decisoes';
import {
  ESCOPOS_DAS_DECISOES,
  idDoFoco,
  sombraDaCaixa,
  tabularAteAPrimeiraCaixa,
} from '../support/teclado-das-decisoes';

/**
 * Teclado nas caixas dos tipos de decisão, na fase e na etapa: Tab as percorre na ordem em que
 * são lidas, Espaço alterna e o foco aparece só na caixa alcançada, diferente do repouso.
 */

for (const escopo of ESCOPOS_DAS_DECISOES) {
  test.describe(`Decisões da ${escopo.nome}: teclado — matriz DS @ds`, () => {
    test.beforeEach(async ({ page }, testInfo) => {
      await abrirOCronograma(page, testInfo, novoServidorDosTiposDeDecisao('rascunho'));
      await abrirAFase(page);
      await abrirAEtapa(page);
    });

    test('o Tab percorre as caixas na ordem em que são lidas', async ({ page }) => {
      const ids = await tabularAteAPrimeiraCaixa(page, escopo);

      for (const id of ids.slice(1)) {
        await page.keyboard.press('Tab');
        expect(await idDoFoco(page)).toBe(id);
      }
    });

    test('o Espaço marca e desmarca a caixa que tem o foco', async ({ page }) => {
      await tabularAteAPrimeiraCaixa(page, escopo);
      const caixa = page.locator(':focus');

      await page.keyboard.press('Space');
      await expect(caixa).toBeChecked();
      await page.keyboard.press('Space');
      await expect(caixa).not.toBeChecked();
    });

    test('muda o desenho da caixa alcançada pelo teclado em relação ao repouso, e só dela', async ({
      page,
    }) => {
      const [primeira, segunda, ...demais] = await tabularAteAPrimeiraCaixa(page, escopo);
      const comFoco = await sombraDaCaixa(page, primeira);

      await page.keyboard.press('Tab');
      const emRepouso = await sombraDaCaixa(page, primeira);

      expect(comFoco).not.toBe('none');
      expect(comFoco).not.toBe(emRepouso);
      expect(await sombraDaCaixa(page, segunda)).toBe(comFoco);
      for (const id of demais) expect(await sombraDaCaixa(page, id)).toBe(emRepouso);
    });
  });
}
