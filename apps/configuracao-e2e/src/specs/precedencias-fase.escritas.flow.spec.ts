import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const ARESTA = {
  id: '01960000-0000-7000-0000-0000000000a1',
  antecessoraCodigo: 'INSCRICAO',
  sucessoraCodigo: 'HOMOLOGACAO',
  permiteSobreposicao: false,
  criadoEm: '2026-07-15T12:00:00Z',
};

/** Atraso da recarga da lista após a escrita: o botão da linha ainda está indisponível quando o diálogo fecha. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

const PROBLEMA_409_PROCESSANDO = {
  type: 'about:blank',
  title: 'Escrita em processamento',
  status: 409,
  code: 'uniplus.idempotency.processing_conflict',
};
const PROBLEMA_422_DUPLICADA = {
  type: 'about:blank',
  title: 'Já existe uma aresta de precedência viva com este par de fases',
  status: 422,
  code: 'uniplus.configuracao.precedencia_fase.aresta_duplicada',
};
const PROBLEMA_403_REMOCAO = {
  type: 'about:blank',
  title: 'Acesso negado',
  status: 403,
  code: 'uniplus.auth.forbidden',
};
const PROBLEMA_404 = {
  type: 'about:blank',
  title: 'Aresta de precedência não encontrada',
  status: 404,
  code: 'uniplus.configuracao.precedencia_fase.nao_encontrada',
};
const PROBLEMA_500 = {
  type: 'about:blank',
  title: 'Erro interno',
  status: 500,
  code: 'uniplus.internal.unexpected',
};
const RECUSA_DE_SUCESSORA = {
  type: 'about:blank',
  title: 'Código da fase sucessora em formato inválido',
  status: 422,
  code: 'uniplus.configuracao.precedencia_fase.sucessora_codigo_formato_invalido',
  errors: [
    {
      field: 'sucessoraCodigo',
      code: 'uniplus.configuracao.precedencia_fase.sucessora_codigo_formato_invalido',
      message: 'Sucessora fora do padrão.',
    },
  ],
};

type Recarga = 'com-o-item' | 'sem-o-item' | 'com-falha';
type Resposta = { status: number; corpo?: unknown };
const CRIADO: Resposta = { status: 201 };
const SALVO: Resposta = { status: 204 };

/** Cada POST, PUT ou DELETE consome a próxima resposta e fica retido até `liberar`. */
async function mockApi(
  page: Page,
  respostas: readonly Resposta[],
  recarga: Recarga,
  primeiraConsulta: 'ok' | 'falha' = 'ok',
) {
  let liberar: () => void = () => undefined;
  const retida = new Promise<void>((resolve) => (liberar = resolve));
  const envios: string[] = [];
  let gravou = false;
  let consultas = 0;
  await page.route(/\/api\/configuracao\/fases-canonicas(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, headers: CORS_HEADERS, json: [] }),
  );
  await page.route(/\/api\/configuracao\/precedencias-fase(\?.*)?$/, async (route) => {
    consultas += 1;
    if (primeiraConsulta === 'falha' && consultas === 1) {
      await route.fulfill({
        status: 500,
        headers: CORS_HEADERS,
        contentType: 'application/problem+json',
        body: JSON.stringify(PROBLEMA_500),
      });
      return;
    }
    if (gravou || consultas > 1) {
      await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
    }
    if (!gravou) {
      await route.fulfill({ status: 200, headers: CORS_HEADERS, json: [ARESTA] });
      return;
    }
    if (recarga === 'com-falha') {
      await route.fulfill({
        status: 500,
        headers: CORS_HEADERS,
        contentType: 'application/problem+json',
        body: JSON.stringify(PROBLEMA_500),
      });
      return;
    }
    const itens = { 'com-o-item': [ARESTA], 'sem-o-item': [] };
    await route.fulfill({ status: 200, headers: CORS_HEADERS, json: itens[recarga] });
  });
  const escrita = async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    const resposta = respostas[envios.length];
    envios.push(route.request().method());
    await retida;
    if (resposta.status < 300 || resposta.status === 404) gravou = true;
    const corpo = resposta.corpo;
    await route.fulfill({
      status: resposta.status,
      headers: CORS_HEADERS,
      ...(corpo === undefined
        ? resposta.status === 201
          ? { contentType: 'application/json', body: JSON.stringify('nova-aresta-id') }
          : {}
        : { contentType: 'application/problem+json', body: JSON.stringify(corpo) }),
    });
  };
  await page.route(/\/api\/configuracao\/admin\/precedencias-fase\/[^/?]+$/, escrita);
  await page.route(/\/api\/configuracao\/admin\/precedencias-fase(\?.*)?$/, escrita);
  return { liberar, envios };
}

const NOME_DO_PAR = `precedência entre ${ARESTA.antecessoraCodigo} e ${ARESTA.sucessoraCodigo}`;
const titulo = (page: Page): Locator =>
  page.getByRole('heading', { name: 'Arestas de precedência', level: 2 });
const novo = (page: Page): Locator => page.locator('#cfg-precedencias-fase-nova');
const editar = (page: Page): Locator => page.getByRole('button', { name: `Editar ${NOME_DO_PAR}` });
const lixeira = (page: Page): Locator =>
  page.getByRole('button', { name: `Remover ${NOME_DO_PAR}` });
const drawer = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Formulário de aresta de precedência' });
const confirmacao = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Remover aresta de precedência' });

async function abrirCadastro(page: Page): Promise<Locator> {
  await page.goto('/precedencias-fase');
  await novo(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  await formulario.locator('select[formcontrolname="antecessoraCodigo"]').selectOption('AVALIACAO');
  await formulario
    .locator('select[formcontrolname="sucessoraCodigo"]')
    .selectOption('CLASSIFICACAO');
  return formulario;
}

async function abrirEdicao(page: Page): Promise<Locator> {
  await page.goto('/precedencias-fase');
  await editar(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  return formulario;
}

async function abrirRemocao(page: Page) {
  await page.goto('/precedencias-fase');
  await lixeira(page).click();
  const dialogo = confirmacao(page);
  return { dialogo, remover: dialogo.getByRole('button', { name: 'Remover', exact: true }) };
}

test.describe('Precedência de fase — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('criação pendente preserva foco e valores, recusa reenvio, Esc e X; a recusa foca o campo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 422, corpo: RECUSA_DE_SUCESSORA }],
      'com-o-item',
    );
    const formulario = await abrirCadastro(page);
    const sucessora = formulario.locator('select[formcontrolname="sucessoraCodigo"]');
    await formulario.getByRole('button', { name: 'Criar aresta' }).click();
    const salvar = formulario.getByRole('button', { name: 'Salvando...' });
    await expect(sucessora).toBeDisabled();
    await expect(sucessora).toHaveValue('CLASSIFICACAO');
    await expect(salvar).toBeFocused();
    await expect(salvar).toHaveAttribute('aria-disabled', 'true');
    await expect(salvar).toHaveAttribute('aria-busy', 'true');
    await expect(salvar).toHaveCSS('cursor', 'not-allowed');
    await expect(formulario.locator('[role="status"]').first()).toContainText('Salvando');
    await expect(formulario.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(formulario).toBeVisible();
    await expect(formulario.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await salvar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(envios).toEqual(['POST']);
    liberar();
    await expect(sucessora).toBeEnabled();
    await expect(sucessora).toBeFocused();
    await expect(sucessora).toHaveAttribute('aria-invalid', 'true');
    await expect(formulario.getByText('Sucessora fora do padrão.')).toBeVisible();
  });

  test('aresta duplicada marca a sucessora e a foca', async ({ page }) => {
    const { liberar } = await mockApi(
      page,
      [{ status: 422, corpo: PROBLEMA_422_DUPLICADA }],
      'com-o-item',
    );
    const formulario = await abrirCadastro(page);
    await formulario.getByRole('button', { name: 'Criar aresta' }).click();
    liberar();
    const sucessora = formulario.locator('select[formcontrolname="sucessoraCodigo"]');
    await expect(sucessora).toBeFocused();
    await expect(sucessora).toHaveAttribute('aria-invalid', 'true');
    await expect(formulario.getByText(PROBLEMA_422_DUPLICADA.title)).toBeVisible();
  });

  test('conflito de processamento aparece no alerta e deixa o envio disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_409_PROCESSANDO }, CRIADO],
      'com-o-item',
    );
    const formulario = await abrirCadastro(page);
    const enviar = formulario.getByRole('button', { name: 'Criar aresta' });
    await enviar.click();
    liberar();
    await expect(formulario.locator('.alert__msg')).toBeVisible();
    await expect(formulario.locator('.field.is-error')).toHaveCount(0);
    await expect(enviar).not.toHaveAttribute('aria-disabled', 'true');
    await enviar.click();
    await expect(formulario).toBeHidden();
    expect(envios).toEqual(['POST', 'POST']);
  });

  test('Enter no campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 500, corpo: PROBLEMA_500 }],
      'com-o-item',
    );
    const formulario = await abrirEdicao(page);
    const antecessora = formulario.locator('input[formcontrolname="antecessoraCodigo"]');
    await antecessora.focus();
    await page.keyboard.press('Enter');
    await expect(antecessora).toBeDisabled();
    await expect(formulario.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar();
    await expect(formulario.locator('.alert__msg')).toBeVisible();
    await expect(formulario.getByRole('button', { name: 'Salvar aresta' })).toBeFocused();
    expect(envios).toEqual(['PUT']);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, [CRIADO], 'com-o-item');
    await page.goto('/precedencias-fase');
    await novo(page).click();
    const formulario = drawer(page);
    await formulario.getByRole('button', { name: 'Criar aresta' }).focus();
    await page.keyboard.press('Enter');
    const antecessora = formulario.locator('select[formcontrolname="antecessoraCodigo"]');
    await expect(antecessora).toBeFocused();
    await expect(antecessora).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, [], 'com-o-item', 'falha');
    await page.goto('/precedencias-fase');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(editar(page)).toBeVisible();
    await expect(titulo(page)).toBeFocused();
  });

  test('edição concluída devolve o foco ao acionador depois da recarga', async ({ page }) => {
    const { liberar } = await mockApi(page, [SALVO], 'com-o-item');
    const formulario = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Salvar aresta' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(editar(page)).toBeDisabled();
    await expect(editar(page)).toBeEnabled();
    await expect(editar(page)).toBeFocused();
  });

  test('criação concluída devolve o foco ao botão de cadastro', async ({ page }) => {
    const { liberar } = await mockApi(page, [CRIADO], 'com-o-item');
    const formulario = await abrirCadastro(page);
    await formulario.getByRole('button', { name: 'Criar aresta' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(novo(page)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(novo(page)).toBeFocused();
  });

  test('cancelar a edição devolve o foco ao acionador', async ({ page }) => {
    await mockApi(page, [], 'com-o-item');
    const formulario = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Cancelar' }).click();
    await expect(formulario).toBeHidden();
    await expect(editar(page)).toBeFocused();
  });

  for (const recarga of ['sem-o-item', 'com-falha'] as const) {
    test(`edição concluída, com a recarga ${recarga}, leva o foco ao título da lista`, async ({
      page,
    }) => {
      const { liberar } = await mockApi(page, [SALVO], recarga);
      const formulario = await abrirEdicao(page);
      await formulario.getByRole('button', { name: 'Salvar aresta' }).click();
      liberar();
      await expect(formulario).toBeHidden();
      await expect(titulo(page)).toBeFocused();
    });
  }

  test('remoção pendente mantém o foco no botão, recusa reenvio, Esc, X e Cancelar e anuncia o andamento', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [SALVO], 'sem-o-item');
    const { dialogo, remover } = await abrirRemocao(page);
    await remover.click();
    await expect(remover).toBeFocused();
    await expect(remover).toHaveAttribute('aria-disabled', 'true');
    await expect(remover).toHaveAttribute('aria-busy', 'true');
    await expect(remover).toHaveCSS('cursor', 'not-allowed');
    await expect(dialogo.getByRole('status')).toContainText('Removendo');
    await expect(dialogo.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
    await remover.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(envios).toEqual(['DELETE']);
    liberar();
    await expect(dialogo).toBeHidden();
  });

  for (const recarga of ['sem-o-item', 'com-falha'] as const) {
    test(`remoção concluída, com a recarga ${recarga}, leva o foco ao título da lista`, async ({
      page,
    }) => {
      const { liberar } = await mockApi(page, [SALVO], recarga);
      const { dialogo, remover } = await abrirRemocao(page);
      await remover.click();
      liberar();
      await expect(dialogo).toBeHidden();
      await expect(titulo(page)).toBeFocused();
    });
  }

  test('remoção recusada (403) leva à página de acesso negado', async ({ page }) => {
    const { liberar } = await mockApi(
      page,
      [{ status: 403, corpo: PROBLEMA_403_REMOCAO }],
      'sem-o-item',
    );
    const { dialogo, remover } = await abrirRemocao(page);
    await remover.click();
    liberar();
    await expect(page).toHaveURL(/\/acesso-negado$/);
    await expect(dialogo).toBeHidden();
  });

  test('remoção recusada (500) mantém o diálogo, a mensagem e o foco no botão, que volta a aceitar o clique', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 500, corpo: PROBLEMA_500 }, SALVO],
      'sem-o-item',
    );
    const { dialogo, remover } = await abrirRemocao(page);
    await remover.click();
    liberar();
    const mensagem = dialogo.locator('.field__error');
    await expect(mensagem).toContainText(PROBLEMA_500.title);
    await expect(remover).not.toHaveAttribute('aria-disabled', 'true');
    await expect(remover).toBeFocused();
    await expect(dialogo.getByRole('status')).toContainText('Não foi possível remover');
    await remover.click();
    await expect(mensagem).toBeHidden();
    await expect(dialogo).toBeHidden();
    expect(envios).toEqual(['DELETE', 'DELETE']);
  });

  test('aresta já removida por outra pessoa (404) mantém a mensagem no diálogo, que ainda pode ser cancelado', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 404, corpo: PROBLEMA_404 }], 'sem-o-item');
    const { dialogo, remover } = await abrirRemocao(page);
    await remover.click();
    liberar();
    await expect(dialogo.locator('.field__error')).toContainText(PROBLEMA_404.title);
    await expect(remover).not.toHaveAttribute('aria-disabled', 'true');
    await expect(novo(page)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(lixeira(page)).toHaveCount(0);
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  test('aresta já removida por outra pessoa (404) ao salvar mantém o drawer, e cancelar leva o foco ao título', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 404, corpo: PROBLEMA_404 }], 'sem-o-item');
    const formulario = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Salvar aresta' }).click();
    liberar();
    await expect(formulario.locator('ui-alert')).toContainText(PROBLEMA_404.title);
    await expect(novo(page)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(editar(page)).toHaveCount(0);
    await formulario.getByRole('button', { name: 'Cancelar' }).click();
    await expect(formulario).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  test('cancelar a confirmação devolve o foco ao botão de remover da linha', async ({ page }) => {
    await mockApi(page, [], 'sem-o-item');
    const { dialogo } = await abrirRemocao(page);
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(lixeira(page)).toBeFocused();
  });
});
