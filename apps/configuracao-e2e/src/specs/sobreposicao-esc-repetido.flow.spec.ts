import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const ITEM = {
  tipo: 'TIPO_DOCUMENTO',
  id: '01960000-0000-7000-0000-0000000000d2',
  codigo: 'LAUDO_MEDICO_COMPLEMENTAR',
  nome: 'Laudo médico complementar',
  classificacaoProtecao: 'INTERNO',
  finalidadeTratamento: 'Conferir o laudo do candidato com deficiência.',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  aprovacao: {
    situacao: 'SOLICITADA',
    solicitadaEm: '2026-11-01T12:00:00Z',
    decididaEm: null,
    classificacaoRecomendada: null,
    justificativa: null,
    aceitaEm: null,
  },
};

const DETALHE = {
  ...ITEM,
  descricao: 'Laudo que complementa o pedido de atendimento especializado.',
  fato: null,
  tipoDocumento: { categoria: 'SAUDE', formatosAceitos: 'pdf,jpg', tamanhoMaximoMb: 10 },
  atos: [],
};

const CAMPUS = {
  id: '01960000-0000-7000-0000-0000000000b1',
  sigla: 'MARABA',
  nome: 'Campus de Marabá',
  codigoEmec: '12345',
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

/** Atraso da recarga após a decisão: o drawer já fechou quando ela termina. */
const ATRASO_DA_RECARGA_EM_MS = 800;

async function responder(route: Route, status: number, corpo?: unknown): Promise<void> {
  await route.fulfill({
    status,
    headers: CORS_HEADERS,
    ...(corpo === undefined
      ? {}
      : { contentType: 'application/json', body: JSON.stringify(corpo) }),
  });
}

/** Resposta da escrita retida até `liberar`: a escrita fica pendente enquanto o teste aperta Esc. */
function retida(): { espera: Promise<void>; liberar: () => void } {
  let liberar: () => void = () => undefined;
  const espera = new Promise<void>((resolve) => (liberar = resolve));
  return { espera, liberar };
}

async function mockProtecao(page: Page): Promise<() => void> {
  const escrita = retida();
  let leituras = 0;
  await page.route(/\/api\/configuracao\/categorias-documento(\?.*)?$/, (r) =>
    responder(r, 200, []),
  );
  await page.route(
    /\/api\/configuracao\/admin\/protecao-do-catalogo\/tipos-documento\/[^/?]+$/,
    (r) => responder(r, 200, DETALHE),
  );
  await page.route(/\/api\/configuracao\/admin\/protecao-do-catalogo(\?.*)?$/, async (route) => {
    const metodo = route.request().method();
    if (metodo === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS });
    if (metodo === 'POST') {
      await escrita.espera;
      return responder(route, 204);
    }
    leituras += 1;
    if (leituras > 1) await new Promise((r) => setTimeout(r, ATRASO_DA_RECARGA_EM_MS));
    return responder(route, 200, leituras > 1 ? [] : [ITEM]);
  });
  return escrita.liberar;
}

const RECUSA_DA_REMOCAO = {
  type: 'about:blank',
  title: 'Campus em uso',
  status: 409,
  code: 'uniplus.configuracao.campus.remocao_bloqueada_por_local_oferta',
};

async function mockCampi(
  page: Page,
  resposta: { status: number; corpo?: unknown } = { status: 204 },
): Promise<() => void> {
  const escrita = retida();
  await page.route(/\/api\/configuracao\/campi(\?.*)?$/, (r) => responder(r, 200, [CAMPUS]));
  await page.route(/\/api\/configuracao\/admin\/campi(\/[^/?]+)?$/, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: CORS_HEADERS });
    }
    await escrita.espera;
    return responder(route, resposta.status, resposta.corpo);
  });
  return escrita.liberar;
}

/** Conta os fechamentos nativos do elemento: sem a proteção, o navegador o fecha no Esc tardio. */
async function contarFechamentosNativos(elemento: Locator): Promise<void> {
  await elemento.evaluate((e) => {
    const alvo = e as HTMLElement & { fechamentos?: number };
    alvo.fechamentos = 0;
    alvo.addEventListener('close', () => (alvo.fechamentos = (alvo.fechamentos ?? 0) + 1));
  });
}

/** Esc repetido, com uma pausa entre eles para os eventos `close` rodarem antes do seguinte. */
async function apertarEsc(page: Page, vezes: number): Promise<void> {
  for (let vez = 0; vez < vezes; vez += 1) {
    await page.keyboard.press('Escape');
    await page.evaluate(
      () =>
        new Promise<void>((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok()))),
    );
  }
}

/**
 * Esc repetido, sem outra interação, com a escrita já pendente. O elemento precisa continuar
 * aberto, modal e com o foco dentro, e o navegador não pode tê-lo fechado nenhuma vez.
 */
async function escRepetidoEAfirmarModal(
  page: Page,
  elemento: Locator,
  pendente: Locator,
  vezes = 6,
): Promise<void> {
  await expect(pendente).toHaveAttribute('aria-disabled', 'true');
  await contarFechamentosNativos(elemento);
  await apertarEsc(page, vezes);
  await expect(elemento).toBeVisible();
  expect(await elemento.evaluate((e) => e.matches(':modal'))).toBe(true);
  expect(await elemento.evaluate((e) => e.contains(document.activeElement))).toBe(true);
  expect(
    await elemento.evaluate((e) => (e as HTMLElement & { fechamentos?: number }).fechamentos),
  ).toBe(0);
}

test.describe('Sobreposição com escrita pendente — Esc repetido', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('o drawer continua aberto, modal e com o bloqueio de rolagem; ao concluir, fecha e leva o foco ao título da fila', async ({
    page,
  }) => {
    const liberar = await mockProtecao(page);
    await page.goto('/protecao-do-catalogo');
    const acionador = page.getByRole('button', { name: `Ver o detalhe de ${ITEM.nome}` });
    await acionador.click();
    const drawer = page.getByRole('dialog', { name: 'Detalhe do item aguardando a decisão' });
    const aprovar = drawer.getByRole('button', { name: /Aprovar/ });
    await aprovar.click();

    await escRepetidoEAfirmarModal(page, drawer, aprovar);
    await expect(page.locator('body')).toHaveClass(/uni-drawer-open/);

    liberar();
    await expect(drawer).toBeHidden();
    await expect(page.locator('body')).not.toHaveClass(/uni-drawer-open/);
    await expect(
      page.getByRole('heading', { name: 'Itens aguardando a sua decisão', level: 2 }),
    ).toBeFocused();
  });

  test('o diálogo continua aberto e modal; ao concluir, fecha e devolve o foco ao acionador', async ({
    page,
  }) => {
    const liberar = await mockCampi(page);
    await page.goto('/campi');
    const acionador = page.getByRole('button', { name: 'Remover campus MARABA' });
    await acionador.click();
    const dialogo = page.getByRole('dialog', { name: 'Remover campus' });
    const remover = dialogo.getByRole('button', { name: 'Remover', exact: true });
    await remover.click();

    await escRepetidoEAfirmarModal(page, dialogo, remover);

    liberar();
    await expect(dialogo).toBeHidden();
    await expect(acionador).toBeFocused();
  });

  test('recusada a escrita, o diálogo volta a fechar pelo Esc', async ({ page }) => {
    const liberar = await mockCampi(page, { status: 409, corpo: RECUSA_DA_REMOCAO });
    await page.goto('/campi');
    await page.getByRole('button', { name: 'Remover campus MARABA' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Remover campus' });
    const remover = dialogo.getByRole('button', { name: 'Remover', exact: true });
    await remover.click();
    await escRepetidoEAfirmarModal(page, dialogo, remover);

    liberar();
    await expect(dialogo.locator('.field__error')).toBeVisible();
    await expect(remover).not.toHaveAttribute('aria-disabled', 'true');
    await expect(dialogo).not.toHaveAttribute('closedby', /.*/);
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
  });

  test('o diálogo de decisão continua por cima do drawer de detalhe, utilizável', async ({
    page,
  }) => {
    const liberar = await mockProtecao(page);
    await page.goto('/protecao-do-catalogo');
    await page.getByRole('button', { name: `Ver o detalhe de ${ITEM.nome}` }).click();
    const drawer = page.getByRole('dialog', { name: 'Detalhe do item aguardando a decisão' });
    await drawer.getByRole('button', { name: 'Reprovar' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Reprovar a proteção de dados do item' });
    await dialogo.getByRole('textbox', { name: /Justificativa/ }).fill('Falta a base legal.');
    const confirmar = dialogo.locator('.uni-dialog__footer .btn--danger');
    await confirmar.click();

    await contarFechamentosNativos(drawer);
    await escRepetidoEAfirmarModal(page, dialogo, confirmar);
    await expect(drawer).toBeVisible();
    expect(
      await drawer.evaluate((e) => (e as HTMLElement & { fechamentos?: number }).fechamentos),
    ).toBe(0);
    const noTopo = await confirmar.evaluate((botao) => {
      const { x, y, width, height } = botao.getBoundingClientRect();
      return botao.contains(document.elementFromPoint(x + width / 2, y + height / 2));
    });
    expect(noTopo).toBe(true);
    await expect(confirmar).toHaveAttribute('aria-busy', 'true');

    liberar();
    await expect(dialogo).toBeHidden();
    await expect(drawer).toBeHidden();
  });
});
