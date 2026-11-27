import { expect, test } from '@playwright/test';
import {
  combinarDocumentos,
  conferirAcessibilidade,
  prepararCenario,
} from '../support/cenario-das-regras-de-comprovacao';
import {
  cancelarRemocao,
  confirmarRemocao,
  conferirRecusaDosFormatos,
  escolherFormatos,
  fecharRemocaoComEscape,
  gravarEConferirCombinacao,
  gravarEConferirFormatos,
  marcarFormatoPeloTeclado,
  recusarFormatoDaSegundaExigencia,
  removerPeloTeclado,
} from '../support/conferencia-das-regras-de-comprovacao';

test.describe('Cronograma: regras de comprovação — matriz DS @ds', () => {
  test('grava uma combinação de três documentos com consequência e norma', async ({
    page,
  }, testInfo) => {
    const gravadas = await prepararCenario(page, testInfo);
    await combinarDocumentos(page);
    await page.getByLabel('Se não for entregue').first().selectOption('ELIMINA_DO_PROCESSO');
    await page.getByRole('button', { name: 'Acrescentar outra norma', exact: true }).click();
    await page
      .getByRole('textbox', { name: 'Norma que exige o grupo', exact: true })
      .fill('Edital nº 1/2027');
    await conferirAcessibilidade(page);
    await gravarEConferirCombinacao(page, gravadas);
  });

  test('grava PDF e PNG com limite de cinco megabytes', async ({ page }, testInfo) => {
    const gravadas = await prepararCenario(page, testInfo);
    await escolherFormatos(page);
    await conferirAcessibilidade(page);
    await gravarEConferirFormatos(page, gravadas);
  });

  test('explica a remoção, permite cancelar e conserva os outros documentos', async ({
    page,
  }, testInfo) => {
    await prepararCenario(page, testInfo);
    await combinarDocumentos(page);
    await page.getByRole('button', { name: 'Passaporte', exact: true }).click();
    await cancelarRemocao(page);
    await fecharRemocaoComEscape(page);
    await confirmarRemocao(page);
    await conferirAcessibilidade(page);
  });

  test('mostra a recusa nos formatos da segunda exigência e a limpa ao editar', async ({
    page,
  }, testInfo) => {
    const gravadas = await prepararCenario(page, testInfo);
    recusarFormatoDaSegundaExigencia(gravadas);
    await page.getByRole('button', { name: /Gravar e avançar/ }).click();
    await conferirRecusaDosFormatos(page);
  });

  test('mantém os controles visíveis com ampliação de 200%', async ({ page }, testInfo) => {
    await prepararCenario(page, testInfo);
    await page.setViewportSize({ width: 640, height: 450 });
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    await escolherFormatos(page);
    await expect(page.getByLabel('PDF', { exact: true })).toBeVisible();
    await conferirAcessibilidade(page);
  });

  test('abre, escolhe formatos e confirma a remoção pelo teclado', async ({ page }, testInfo) => {
    await prepararCenario(page, testInfo);
    await marcarFormatoPeloTeclado(page);
    await removerPeloTeclado(page);
    await conferirAcessibilidade(page);
  });
});
