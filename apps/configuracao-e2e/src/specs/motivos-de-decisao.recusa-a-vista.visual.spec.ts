import { expect, test, type Locator, type Page } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import { problema } from '../support/escritas-retidas';
import {
  abrirPainelAposARecusa,
  ENVIO_SEM_CONFIRMACAO,
  prepararMotivosComEscritaRecusada,
  RECUSA_DO_SERVIDOR,
} from '../support/avisos-no-painel-de-motivos';

const JANELA_ESTREITA = { width: 320, height: 568 };

async function bordaInferior(alvo: Locator): Promise<number> {
  return alvo.evaluate((el) => el.getBoundingClientRect().bottom);
}

async function bordaSuperior(alvo: Locator): Promise<number> {
  return alvo.evaluate((el) => el.getBoundingClientRect().top);
}

async function esperarVisivelAcimaDoRodape(alvo: Locator, painel: Locator): Promise<void> {
  await expect(alvo).toBeInViewport({ ratio: 1 });
  const topoDoRodape = await bordaSuperior(painel.locator('.form-drawer__footer'));
  expect(await bordaInferior(alvo)).toBeLessThanOrEqual(topoDoRodape);
}

async function abrirPainelDeNovoMotivo(page: Page): Promise<Locator> {
  await page.goto('/motivos-de-decisao');
  await page.locator('#cfg-motivos-tipo').selectOption('GABARITO_DA_PROVA');
  await page.locator('#cfg-motivos-de-decisao-novo').click();
  const painel = page.getByRole('dialog', { name: 'Formulário de motivo de decisão' });
  await expect(painel.getByRole('heading', { name: 'Novo motivo de decisão' })).toBeVisible();
  return painel;
}

test.describe('Novo motivo de decisão — a recusa leva a visão ao primeiro aviso, em tela estreita', () => {
  test('recusa da API sem campo e envio sem confirmação: o primeiro aviso fica à vista', async ({
    page,
  }, testInfo) => {
    await prepararMotivosComEscritaRecusada(page, testInfo, ENVIO_SEM_CONFIRMACAO);
    await page.setViewportSize(JANELA_ESTREITA);

    const painel = await abrirPainelAposARecusa(page, 2);

    await esperarVisivelAcimaDoRodape(
      painel.locator('.uni-drawer__body > ui-alert').first(),
      painel,
    );
    await expect(painel.getByRole('button', { name: 'Criar motivo' })).toBeFocused();
  });

  test('recusa definitiva da API: o aviso fica à vista', async ({ page }, testInfo) => {
    await prepararMotivosComEscritaRecusada(page, testInfo, RECUSA_DO_SERVIDOR);
    await page.setViewportSize(JANELA_ESTREITA);

    const painel = await abrirPainelAposARecusa(page, 1);

    const aviso = painel.locator('.uni-drawer__body > ui-alert').first();
    await expect(aviso).toBeVisible();
    await esperarVisivelAcimaDoRodape(aviso, painel);
  });

  test('recusa no próprio formulário: a mensagem do primeiro campo e o campo ficam à vista', async ({
    page,
  }, testInfo) => {
    await prepararMotivosComEscritaRecusada(page, testInfo, RECUSA_DO_SERVIDOR);
    await page.setViewportSize(JANELA_ESTREITA);
    const painel = await abrirPainelDeNovoMotivo(page);
    await painel
      .locator('.uni-drawer__body')
      .evaluate((el) => el.scrollTo({ top: el.scrollHeight }));

    await painel.getByRole('button', { name: 'Criar motivo' }).click();

    const campo = painel.locator('[aria-invalid="true"]').first();
    await expect(campo).toBeFocused();
    await esperarVisivelAcimaDoRodape(campo, painel);
    await esperarVisivelAcimaDoRodape(painel.locator('.field__error').first(), painel);
  });

  test('recusa da API que marca um campo: o foco e a mensagem do campo ficam à vista', async ({
    page,
  }, testInfo) => {
    await prepararMotivosComEscritaRecusada(page, testInfo, {
      status: 422,
      corpo: problema(422, 'uniplus.validacao', 'Validação', [
        { field: 'Codigo', code: 'Duplicado', message: 'Já existe um motivo com este código.' },
      ]),
    });
    await page.setViewportSize(JANELA_ESTREITA);

    const painel = await abrirPainelAposARecusa(page, 0);

    await expect(painel.locator('[aria-invalid="true"]').first()).toBeFocused();
    await esperarVisivelAcimaDoRodape(painel.locator('.field__error').first(), painel);
  });

  test('com movimento reduzido a rolagem do corpo é imediata, sem animação', async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await prepararMotivosComEscritaRecusada(page, testInfo, ENVIO_SEM_CONFIRMACAO);
    await page.setViewportSize(JANELA_ESTREITA);

    const painel = await abrirPainelAposARecusa(page, 2);

    const comportamento = await painel
      .locator('.uni-drawer__body')
      .evaluate((el) => getComputedStyle(el).scrollBehavior);
    expect(comportamento).toBe('auto');
    await esperarVisivelAcimaDoRodape(
      painel.locator('.uni-drawer__body > ui-alert').first(),
      painel,
    );
  });

  test('ampliação de 200%: o primeiro aviso fica à vista e nada rola na horizontal', async ({
    page,
  }, testInfo) => {
    await prepararMotivosComEscritaRecusada(page, testInfo, ENVIO_SEM_CONFIRMACAO);
    await page.setViewportSize({ width: 640, height: 450 });
    await page.addInitScript(() => {
      addEventListener('DOMContentLoaded', () => {
        document.documentElement.style.zoom = '2';
      });
    });

    const painel = await abrirPainelAposARecusa(page, 2);

    await esperarVisivelAcimaDoRodape(
      painel.locator('.uni-drawer__body > ui-alert').first(),
      painel,
    );
    expect(await painel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  });

  test('o painel com a recusa à vista não tem violação WCAG A e AA', async ({ page }, testInfo) => {
    await prepararMotivosComEscritaRecusada(page, testInfo, ENVIO_SEM_CONFIRMACAO);
    await page.setViewportSize(JANELA_ESTREITA);
    await abrirPainelAposARecusa(page, 2);

    const { violations } = await runAxeWcagAA(page);

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
