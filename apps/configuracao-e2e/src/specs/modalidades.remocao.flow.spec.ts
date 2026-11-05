import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const MODALIDADE = {
  id: '01960000-0000-7000-0000-0000000000a1',
  codigo: 'AC',
  legalFixa: false,
  descricao: 'Ampla concorrência',
  naturezaLegal: 'AMPLA',
  composicaoVagas: 'RESIDUAL_DO_VO',
  composicaoOrigem: null,
  regraRemanejamento: null,
  remanejamentoDestino: null,
  remanejamentoPar: null,
  remanejamentoFallback: null,
  regraDeAplicabilidade: [],
  acaoQuandoIndeferido: null,
  baseLegal: null,
  criadoEm: '2026-07-03T12:00:00Z',
};

const PROBLEMA_409 = {
  type: 'about:blank',
  title: 'Modalidade referenciada por outra viva',
  status: 409,
  code: 'uniplus.configuracao.modalidade.remocao_bloqueada_por_referencia',
};

const PROBLEMA_500 = {
  type: 'about:blank',
  title: 'Falha ao remover a modalidade',
  status: 500,
  code: 'uniplus.erro_interno',
};

type Recarga = 'com-a-modalidade' | 'sem-a-modalidade' | 'com-falha';
type Resposta = { status: number; corpo?: unknown };

function comporte(): { espera: Promise<void>; liberar: () => void } {
  let liberar: () => void = () => undefined;
  const espera = new Promise<void>((resolve) => (liberar = resolve));
  return { espera, liberar };
}

/**
 * Cada DELETE consome a próxima resposta e fica retido até `liberarRemocao`; a recarga que o
 * segue responde conforme `recarga` e fica retida até `liberarRecarga`.
 */
async function mockRemocao(page: Page, respostas: readonly Resposta[], recarga: Recarga) {
  const remocoes: ReturnType<typeof comporte>[] = respostas.map(() => comporte());
  let recargaRetida = comporte();
  let envios = 0;
  let removeu = false;
  await page.route(/\/api\/configuracao\/fatos-candidato(\?.*)?$/, (r) =>
    r.fulfill({ status: 200, headers: CORS_HEADERS, json: [] }),
  );
  await page.route(/\/api\/configuracao\/modalidades(\?.*)?$/, async (r) => {
    if (!removeu) {
      await r.fulfill({ status: 200, headers: CORS_HEADERS, json: [MODALIDADE] });
      return;
    }
    await recargaRetida.espera;
    if (recarga === 'com-falha') {
      await r.fulfill({
        status: 500,
        headers: CORS_HEADERS,
        contentType: 'application/problem+json',
        body: JSON.stringify(PROBLEMA_500),
      });
      return;
    }
    await r.fulfill({
      status: 200,
      headers: CORS_HEADERS,
      json: recarga === 'sem-a-modalidade' ? [] : [MODALIDADE],
    });
  });
  await page.route(/\/api\/configuracao\/admin\/modalidades\/[^/?]+$/, async (r) => {
    if (r.request().method() === 'OPTIONS') {
      await r.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    const indice = envios++;
    await remocoes[indice].espera;
    const { status, corpo } = respostas[indice];
    removeu = true;
    await r.fulfill({
      status,
      headers: CORS_HEADERS,
      ...(corpo === undefined
        ? {}
        : { contentType: 'application/problem+json', body: JSON.stringify(corpo) }),
    });
  });
  return {
    envios: () => envios,
    liberarRemocao: (indice = 0) => remocoes[indice].liberar(),
    liberarRecarga: () => recargaRetida.liberar(),
    rearmarRecarga: () => (recargaRetida = comporte()),
  };
}

async function abrirDialogo(page: Page): Promise<{ acionador: Locator; dialogo: Locator }> {
  await page.goto('/modalidades');
  const acionador = page.getByRole('button', { name: 'Remover modalidade AC' });
  await acionador.click();
  return { acionador, dialogo: page.getByRole('dialog') };
}

const titulo = (page: Page) => page.getByRole('heading', { name: 'Modalidades', level: 2 });

test.describe('Modalidade — remoção e foco', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('remoção pendente mantém o botão focado e indisponível; o segundo clique não envia', async ({
    page,
  }) => {
    const mock = await mockRemocao(page, [{ status: 204 }], 'sem-a-modalidade');
    const { dialogo } = await abrirDialogo(page);
    const remover = dialogo.getByRole('button', { name: /Remov(er|endo)/ });
    await remover.click();
    await expect(remover).toBeFocused();
    await expect(remover).toHaveAttribute('aria-disabled', 'true');
    await expect(remover).toHaveAttribute('aria-busy', 'true');
    await remover.dispatchEvent('click');
    await page.keyboard.press('Enter');
    expect(mock.envios()).toBe(1);
    mock.liberarRemocao();
    mock.liberarRecarga();
    await expect(dialogo).toBeHidden();
  });

  test('remoção concluída leva o foco ao título da lista depois da recarga', async ({ page }) => {
    const mock = await mockRemocao(page, [{ status: 204 }], 'sem-a-modalidade');
    const { dialogo } = await abrirDialogo(page);
    await dialogo.getByRole('button', { name: /Remov(er|endo)/ }).click();
    mock.liberarRemocao();
    await expect(dialogo).toBeHidden();
    await expect(page.locator('.cfg-modalidades-scope')).toHaveAttribute('inert', '');
    mock.liberarRecarga();
    await expect(page.locator('.cfg-modalidades-scope')).not.toHaveAttribute('inert');
    await expect(titulo(page)).toBeFocused();
  });

  test('remoção concluída não tira o foco de quem o levou para outro ponto durante a recarga', async ({
    page,
  }) => {
    const mock = await mockRemocao(page, [{ status: 204 }], 'sem-a-modalidade');
    const { dialogo } = await abrirDialogo(page);
    await dialogo.getByRole('button', { name: /Remov(er|endo)/ }).click();
    mock.liberarRemocao();
    await expect(dialogo).toBeHidden();
    await page.evaluate(() => {
      const outro = document.createElement('button');
      outro.id = 'foco-externo';
      document.body.append(outro);
      outro.focus();
    });
    mock.liberarRecarga();
    await expect(page.locator('.cfg-modalidades-scope')).not.toHaveAttribute('inert');
    await expect(page.locator('#foco-externo')).toBeFocused();
  });

  test('remoção concluída com falha na recarga leva o foco ao título da lista', async ({
    page,
  }) => {
    const mock = await mockRemocao(page, [{ status: 204 }], 'com-falha');
    const { dialogo } = await abrirDialogo(page);
    await dialogo.getByRole('button', { name: /Remov(er|endo)/ }).click();
    mock.liberarRemocao();
    mock.liberarRecarga();
    await expect(dialogo).toBeHidden();
    await expect(page.locator('.cfg-modalidades-scope')).not.toHaveAttribute('inert');
    await expect(titulo(page)).toBeFocused();
  });

  test('remoção recusada pelo servidor (500) mantém o foco no botão, que volta a aceitar o clique', async ({
    page,
  }) => {
    const mock = await mockRemocao(
      page,
      [{ status: 500, corpo: PROBLEMA_500 }, { status: 204 }],
      'sem-a-modalidade',
    );
    const { dialogo } = await abrirDialogo(page);
    const remover = dialogo.getByRole('button', { name: /Remov(er|endo)/ });
    await remover.click();
    mock.liberarRemocao(0);
    const alerta = dialogo.locator('.alert__msg');
    await expect(alerta).toBeVisible();
    await expect(remover).not.toHaveAttribute('aria-disabled', 'true');
    await expect(remover).toBeFocused();
    await remover.click();
    await expect(alerta).toBeHidden();
    await expect(remover).toBeFocused();
    expect(mock.envios()).toBe(2);
    mock.liberarRemocao(1);
    mock.liberarRecarga();
    await expect(dialogo).toBeHidden();
  });

  test('conflito (409) com a linha ausente da recarga leva o foco a "Entendi" e, ao fechar, ao título', async ({
    page,
  }) => {
    const mock = await mockRemocao(
      page,
      [{ status: 409, corpo: PROBLEMA_409 }],
      'sem-a-modalidade',
    );
    const { dialogo } = await abrirDialogo(page);
    await dialogo.getByRole('button', { name: /Remov(er|endo)/ }).click();
    mock.liberarRemocao();
    const entendi = dialogo.getByRole('button', { name: 'Entendi' });
    await expect(entendi).toBeFocused();
    await expect(entendi).toHaveAttribute('aria-disabled', 'true');
    await expect(entendi).toHaveAttribute('aria-busy', 'true');
    await entendi.dispatchEvent('click');
    await expect(dialogo).toBeVisible();
    mock.liberarRecarga();
    await expect(entendi).not.toHaveAttribute('aria-disabled', 'true');
    await expect(entendi).toBeFocused();
    await entendi.press('Enter');
    await expect(dialogo).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  test('conflito (409) com a linha ainda na recarga devolve o foco à lixeira da linha', async ({
    page,
  }) => {
    const mock = await mockRemocao(
      page,
      [{ status: 409, corpo: PROBLEMA_409 }],
      'com-a-modalidade',
    );
    const { acionador, dialogo } = await abrirDialogo(page);
    await dialogo.getByRole('button', { name: /Remov(er|endo)/ }).click();
    mock.liberarRemocao();
    mock.liberarRecarga();
    const entendi = dialogo.getByRole('button', { name: 'Entendi' });
    await expect(entendi).not.toHaveAttribute('aria-disabled', 'true');
    await entendi.click();
    await expect(dialogo).toBeHidden();
    await expect(acionador).toBeFocused();
  });

  test('cancelar a confirmação devolve o foco à lixeira da linha', async ({ page }) => {
    await mockRemocao(page, [], 'sem-a-modalidade');
    const { acionador, dialogo } = await abrirDialogo(page);
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(acionador).toBeFocused();
  });
});
