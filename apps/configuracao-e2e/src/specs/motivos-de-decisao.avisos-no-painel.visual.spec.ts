import { expect, test, type Locator } from '@playwright/test';
import {
  abrirPainelAposARecusa,
  ENVIO_SEM_CONFIRMACAO,
  medirOPainel,
  prepararMotivosComEscritaRecusada,
  RECUSA_DO_SERVIDOR,
} from '../support/avisos-no-painel-de-motivos';

const TOLERANCIA_EM_PIXELS = 1;

function esperarIgual(medido: number, esperado: number): void {
  expect(Math.abs(medido - esperado)).toBeLessThanOrEqual(TOLERANCIA_EM_PIXELS);
}

function esperarTodosIguais(medidos: readonly number[], esperado: number): void {
  for (const medido of medidos) esperarIgual(medido, esperado);
}

async function semRolagemHorizontal(painel: Locator): Promise<boolean> {
  return painel.evaluate((el) => el.scrollWidth <= el.clientWidth);
}

/**
 * Ampliação de 200% sobre uma janela de 1280 px, que o navegador entrega como 640 px de largura:
 * a janela é reduzida a 640 px e a página recebe o zoom de 2, o que deixa 320 px úteis (limite de
 * reflow da WCAG 2.1).
 */
const JANELA_A_200_POR_CENTO = { width: 640, height: 450 };
const FATOR_DE_ZOOM = 2;

test.describe('Novo motivo de decisão — avisos acima do formulário, em cada tema', () => {
  test('dois avisos: o espaço até o título, entre eles e até os campos é o recuo do formulário', async ({
    page,
  }, testInfo) => {
    await prepararMotivosComEscritaRecusada(page, testInfo, ENVIO_SEM_CONFIRMACAO);
    const painel = await abrirPainelAposARecusa(page, 2);

    const medidas = await medirOPainel(painel);

    expect(medidas.recuo).toBeGreaterThan(0);
    esperarIgual(medidas.tituloAoPrimeiroAviso, medidas.recuo);
    esperarTodosIguais(medidas.entreOsAvisos, medidas.recuo);
    esperarIgual(medidas.ultimoAvisoAoPrimeiroConteudo, medidas.recuo);
  });

  test('dois avisos: o recuo lateral é o mesmo dos campos e o rodapé segue em largura total', async ({
    page,
  }, testInfo) => {
    await prepararMotivosComEscritaRecusada(page, testInfo, ENVIO_SEM_CONFIRMACAO);
    const painel = await abrirPainelAposARecusa(page, 2);

    const medidas = await medirOPainel(painel);

    esperarIgual(medidas.recuoEsquerdoDoPrimeiroCampo, medidas.recuo);
    esperarTodosIguais(medidas.recuoEsquerdoDosAvisos, medidas.recuoEsquerdoDoPrimeiroCampo);
    esperarTodosIguais(medidas.recuoDireitoDosAvisos, medidas.recuo);
    esperarIgual(medidas.rodape.recuoEsquerdo, 0);
    esperarIgual(medidas.rodape.recuoDireito, 0);
    expect(await semRolagemHorizontal(painel)).toBe(true);
  });

  test('um aviso: o mesmo espaço acima e abaixo dele e o mesmo recuo lateral', async ({
    page,
  }, testInfo) => {
    await prepararMotivosComEscritaRecusada(page, testInfo, RECUSA_DO_SERVIDOR);
    const painel = await abrirPainelAposARecusa(page, 1);

    const medidas = await medirOPainel(painel);

    esperarIgual(medidas.tituloAoPrimeiroAviso, medidas.recuo);
    expect(medidas.entreOsAvisos).toEqual([]);
    esperarIgual(medidas.ultimoAvisoAoPrimeiroConteudo, medidas.recuo);
    esperarTodosIguais(medidas.recuoEsquerdoDosAvisos, medidas.recuo);
    esperarTodosIguais(medidas.recuoDireitoDosAvisos, medidas.recuo);
  });

  test('celular em pé: os avisos ficam inteiros na janela e o formulário rola até o último campo', async ({
    page,
  }, testInfo) => {
    await prepararMotivosComEscritaRecusada(page, testInfo, ENVIO_SEM_CONFIRMACAO);
    await page.setViewportSize({ width: 320, height: 568 });
    const painel = await abrirPainelAposARecusa(page, 2);

    for (const aviso of await painel.locator('.uni-drawer__body > ui-alert').all()) {
      await expect(aviso).toBeInViewport({ ratio: 1 });
    }
    await expect(painel.locator('.form-drawer__footer')).toBeInViewport({ ratio: 1 });
    const formulario = painel.locator('.form-drawer__form');
    await formulario.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await expect(formulario.locator('input, select, textarea').last()).toBeInViewport({ ratio: 1 });
    expect(await semRolagemHorizontal(painel)).toBe(true);
  });
  test('ampliação de 200%: os avisos ficam inteiros e nada rola na horizontal', async ({
    page,
  }, testInfo) => {
    await prepararMotivosComEscritaRecusada(page, testInfo, ENVIO_SEM_CONFIRMACAO);
    await page.setViewportSize(JANELA_A_200_POR_CENTO);
    const painel = await abrirPainelAposARecusa(page, 2);
    await page.evaluate((fator) => {
      document.documentElement.style.zoom = String(fator);
    }, FATOR_DE_ZOOM);

    for (const aviso of await painel.locator('.uni-drawer__body > ui-alert').all()) {
      await aviso.scrollIntoViewIfNeeded();
      await expect(aviso).toBeVisible();
      expect(await semRolagemHorizontal(aviso)).toBe(true);
    }
    expect(await semRolagemHorizontal(painel)).toBe(true);
    expect(await semRolagemHorizontal(painel.locator('.uni-drawer__body'))).toBe(true);
  });
});
