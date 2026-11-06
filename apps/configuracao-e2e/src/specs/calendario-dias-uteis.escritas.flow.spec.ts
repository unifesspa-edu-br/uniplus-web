import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const CALENDARIO_ID = '019ff7ee-3c00-7976-860c-eb2f61c9b2d1';
const CALENDARIO = {
  id: CALENDARIO_ID,
  versaoDataset: '2026.1',
  vigente: true,
  criadoEm: '2026-08-13T12:00:00Z',
  diasNaoUteis: [
    {
      id: '019ff7ee-3c00-7976-860c-eb2f61c9b203',
      abrangencia: 'NACIONAL',
      municipioIbge: null,
      municipioNome: null,
      municipioUf: null,
      uf: null,
      data: '2026-09-07',
      descricao: 'Independência do Brasil',
    },
  ],
};

/** O dia clicado nos testes do diálogo: vazio no calendário original, ocupado depois da inclusão. */
const DIA_INCLUIDO = {
  id: '019ff7ee-3c00-7976-860c-eb2f61c9b204',
  abrangencia: 'NACIONAL',
  municipioIbge: null,
  municipioNome: null,
  municipioUf: null,
  uf: null,
  data: '2026-09-08',
  descricao: 'Feriado de teste',
};
const CALENDARIO_COM_O_DIA_INCLUIDO = {
  ...CALENDARIO,
  diasNaoUteis: [...CALENDARIO.diasNaoUteis, DIA_INCLUIDO],
};

/** Atraso da recarga do calendário após a escrita: o painel ainda está carregando quando o diálogo fecha. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

const problema = (status: number, code: string, title: string, errors?: unknown) => ({
  type: 'about:blank',
  title,
  status,
  code,
  ...(errors ? { errors } : {}),
});
const PROBLEMA_409_PROCESSANDO = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'Escrita em processamento',
);
const PROBLEMA_500 = problema(500, 'uniplus.erro_interno', 'Erro interno');
const VERSAO_TAMANHO = 'uniplus.configuracao.calendario_dias_uteis.versao_dataset_tamanho';
const DESCRICAO_TAMANHO = 'uniplus.configuracao.calendario_dias_uteis.descricao_tamanho';
const RECUSA_DE_VERSAO = problema(422, VERSAO_TAMANHO, 'Tamanho da versão do dataset inválido', [
  { field: 'versaoDataset', code: VERSAO_TAMANHO, message: 'Versão fora do padrão.' },
]);
const RECUSA_DE_DESCRICAO = problema(422, DESCRICAO_TAMANHO, 'Tamanho da descrição inválido', [
  { field: 'item.descricao', code: DESCRICAO_TAMANHO, message: 'Descrição fora do padrão.' },
]);

type Resposta = { status: number; corpo?: unknown };
const CRIADO: Resposta = { status: 201 };
const ADICIONADO: Resposta = { status: 200, corpo: CALENDARIO_COM_O_DIA_INCLUIDO };
type Recarga = 'ok' | 'com-falha';

/** Cada POST consome a próxima resposta e fica retido até `liberar`. */
async function mockApi(page: Page, respostas: readonly Resposta[], recarga: Recarga = 'ok') {
  let liberar: () => void = () => undefined;
  const retida = new Promise<void>((resolve) => (liberar = resolve));
  const envios: string[] = [];
  let gravou = false;
  await page.route(
    /\/api\/configuracao\/calendarios-dias-uteis(\/[^/?]+)?(\?.*)?$/,
    async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: CORS_HEADERS });
        return;
      }
      if (gravou) {
        await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
      }
      if (gravou && recarga === 'com-falha') {
        await responder(route, 500, PROBLEMA_500);
        return;
      }
      const corpo = route.request().url().includes(CALENDARIO_ID)
        ? gravou
          ? CALENDARIO_COM_O_DIA_INCLUIDO
          : CALENDARIO
        : { items: [], nextCursor: null };
      await route.fulfill({ status: 200, headers: CORS_HEADERS, json: corpo });
    },
  );
  await page.route(/\/api\/configuracao\/admin\/calendarios-dias-uteis(\/.*)?$/, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    const resposta = respostas[envios.length];
    envios.push(route.request().method());
    await retida;
    if (resposta.status < 300) gravou = true;
    if (resposta.corpo !== undefined) {
      await responder(route, resposta.status, resposta.corpo);
      return;
    }
    await route.fulfill({
      status: resposta.status,
      headers: CORS_HEADERS,
      ...(resposta.status === 201
        ? { contentType: 'application/json', body: JSON.stringify(CALENDARIO_ID) }
        : {}),
    });
  });
  return { liberar, envios };
}

function responder(route: Route, status: number, corpo: unknown) {
  return route.fulfill({
    status,
    headers: CORS_HEADERS,
    contentType: status >= 400 ? 'application/problem+json' : 'application/json',
    body: JSON.stringify(corpo),
  });
}

async function preencherDia(escopo: Locator, sufixo: string, data?: string) {
  await escopo.locator(`#abrangencia-${sufixo}`).selectOption('NACIONAL');
  if (data) await escopo.locator(`#data-${sufixo}`).fill(data);
  await escopo.locator(`#descricao-${sufixo}`).fill('Feriado de teste');
}

async function abrirNovo(page: Page): Promise<Locator> {
  await page.goto('/calendario-dias-uteis/novo');
  const formulario = page.locator('cfg-calendario-formulario');
  await expect(formulario).toBeVisible();
  await formulario.getByLabel('Versão do dataset').fill('2027.1');
  await formulario.getByRole('button', { name: 'Adicionar dia' }).click();
  await preencherDia(formulario, '0', '2027-01-01');
  return formulario;
}

async function abrirDialogo(page: Page): Promise<Locator> {
  await page.goto(`/calendario-dias-uteis/${CALENDARIO_ID}`);
  await page.getByRole('button', { name: /^8 de setembro de 2026/ }).click();
  await page.getByRole('button', { name: 'Adicionar feriado' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Adicionar novo feriado ao calendário' });
  await expect(dialogo).toBeVisible();
  await dialogo.locator('#abrangencia-novo').selectOption('NACIONAL');
  await dialogo.locator('#descricao-novo').fill('Feriado de teste');
  return dialogo;
}

test.describe('Calendário de dias úteis — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('criação pendente deixa o formulário somente leitura, recusa reenvio e foca o campo recusado', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 422, corpo: RECUSA_DE_VERSAO }]);
    const formulario = await abrirNovo(page);
    const versao = formulario.getByLabel('Versão do dataset');
    await formulario.getByRole('button', { name: 'Criar calendário' }).click();
    const salvar = formulario.getByRole('button', { name: 'Salvando...' });
    await expect(versao).toBeDisabled();
    await expect(versao).toHaveValue('2027.1');
    await expect(salvar).toBeFocused();
    await expect(salvar).toHaveAttribute('aria-disabled', 'true');
    await expect(salvar).toHaveAttribute('aria-busy', 'true');
    await expect(salvar).toHaveCSS('cursor', 'not-allowed');
    await expect(
      formulario.locator('[role="status"]').filter({ hasText: 'Criando o calendário.' }),
    ).toBeVisible();
    await expect(formulario.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await salvar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(envios).toEqual(['POST']);
    liberar();
    await expect(versao).toBeEnabled();
    await expect(versao).toBeFocused();
    await expect(versao).toHaveAttribute('aria-invalid', 'true');
    await expect(formulario.getByText('Versão fora do padrão.')).toBeVisible();
  });

  test('conflito de processamento na criação aparece no alerta e libera o reenvio', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [
      { status: 409, corpo: PROBLEMA_409_PROCESSANDO },
      CRIADO,
    ]);
    const formulario = await abrirNovo(page);
    const enviar = formulario.getByRole('button', { name: 'Criar calendário' });
    await enviar.click();
    liberar();
    await expect(formulario.locator('.alert__msg')).toBeVisible();
    await expect(formulario.locator('.field.is-error')).toHaveCount(0);
    await expect(enviar).not.toHaveAttribute('aria-disabled', 'true');
    await enviar.click();
    await expect(page).toHaveURL(/\/calendario-dias-uteis$/);
    expect(envios).toEqual(['POST', 'POST']);
  });

  test('falha 500 na criação mostra o alerta, devolve o foco ao botão de salvar e mantém o envio', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 500, corpo: PROBLEMA_500 }]);
    const formulario = await abrirNovo(page);
    await formulario.getByLabel('Versão do dataset').focus();
    await page.keyboard.press('Enter');
    await expect(formulario.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar();
    await expect(formulario.locator('.alert__msg')).toBeVisible();
    await expect(formulario.getByRole('button', { name: 'Criar calendário' })).toBeFocused();
    expect(envios).toEqual(['POST']);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, [CRIADO]);
    const formulario = await abrirNovo(page);
    const versao = formulario.getByLabel('Versão do dataset');
    await versao.fill('');
    await formulario.getByRole('button', { name: 'Criar calendário' }).click();
    await expect(versao).toBeFocused();
    await expect(versao).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('inclusão pendente deixa o diálogo somente leitura e recusa Esc, X e reenvio', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [ADICIONADO]);
    const dialogo = await abrirDialogo(page);
    const descricao = dialogo.locator('#descricao-novo');
    await dialogo.getByRole('button', { name: 'Adicionar', exact: true }).click();
    const salvar = dialogo.getByRole('button', { name: 'Salvando...' });
    await expect(descricao).toBeDisabled();
    await expect(descricao).toHaveValue('Feriado de teste');
    await expect(salvar).toBeFocused();
    await expect(salvar).toHaveAttribute('aria-disabled', 'true');
    await expect(salvar).toHaveAttribute('aria-busy', 'true');
    await expect(salvar).toHaveCSS('cursor', 'not-allowed');
    await expect(
      dialogo.locator('[role="status"]').filter({ hasText: 'Adicionando o dia não útil.' }),
    ).toBeVisible();
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await expect(dialogo.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
    await salvar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(envios).toEqual(['POST']);
    liberar();
    await expect(dialogo).toBeHidden();
  });

  test('inclusão recusada (422) foca o campo recusado; conflito de processamento e 500 mantêm o foco no botão', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [
      { status: 422, corpo: RECUSA_DE_DESCRICAO },
      { status: 409, corpo: PROBLEMA_409_PROCESSANDO },
      { status: 500, corpo: PROBLEMA_500 },
    ]);
    const dialogo = await abrirDialogo(page);
    const adicionar = dialogo.getByRole('button', { name: 'Adicionar', exact: true });
    await adicionar.click();
    liberar();
    const descricao = dialogo.locator('#descricao-novo');
    await expect(descricao).toBeFocused();
    await expect(descricao).toHaveAttribute('aria-invalid', 'true');
    await expect(dialogo.getByText('Descrição fora do padrão.')).toBeVisible();
    await adicionar.click();
    await expect(dialogo.locator('.alert__msg')).toBeVisible();
    await expect(adicionar).toBeFocused();
    await adicionar.click();
    await expect(dialogo.getByText('Erro interno').first()).toBeVisible();
    await expect(adicionar).not.toHaveAttribute('aria-disabled', 'true');
    await expect(adicionar).toBeFocused();
    expect(envios).toEqual(['POST', 'POST', 'POST']);
  });

  test('cancelar o diálogo fecha-o sem enviar', async ({ page }) => {
    const { envios } = await mockApi(page, []);
    const dialogo = await abrirDialogo(page);
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(page.getByRole('button', { name: 'Adicionar feriado' })).toBeFocused();
    expect(envios).toEqual([]);
  });

  for (const recarga of ['ok', 'com-falha'] as const) {
    const destino = recarga === 'ok' ? 'ao botão do dia' : 'ao título';
    test(`inclusão concluída, com a recarga ${recarga}, fecha o diálogo e leva o foco ${destino}`, async ({
      page,
    }) => {
      const { liberar } = await mockApi(page, [ADICIONADO], recarga);
      const dialogo = await abrirDialogo(page);
      await dialogo.getByRole('button', { name: 'Adicionar', exact: true }).click();
      liberar();
      await expect(dialogo).toBeHidden();
      const focado =
        recarga === 'ok'
          ? page.getByRole('button', { name: /^8 de setembro de 2026/ })
          : page.getByRole('heading', { name: 'Detalhes', level: 1 });
      await expect(focado).toBeFocused();
    });
  }

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    let consultas = 0;
    await page.route(/\/api\/configuracao\/calendarios-dias-uteis\/[^/?]+$/, async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: CORS_HEADERS });
        return;
      }
      consultas += 1;
      if (consultas === 1) {
        await responder(route, 500, PROBLEMA_500);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
      await route.fulfill({ status: 200, headers: CORS_HEADERS, json: CALENDARIO });
    });
    await page.goto(`/calendario-dias-uteis/${CALENDARIO_ID}`);
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('button', { name: /^7 de setembro de 2026/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Detalhes', level: 1 })).toBeFocused();
  });
});
