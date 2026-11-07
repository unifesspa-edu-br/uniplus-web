import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const CENSO = {
  id: '01960000-0000-7000-0000-0000000000e1',
  censoReferencia: '2022',
  ppiPercentual: 78.5,
  quilombolaPercentual: 1.2,
  pcdPercentual: 8.4,
  baseLegal: 'Lei 12.711/2012, art. 10, III',
  criadoEm: '2026-06-10T12:00:00Z',
};

/** Atraso da recarga da lista após a escrita: os botões da linha ainda estão indisponíveis quando a sobreposição fecha. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

const problema = (status: number, code: string, title: string, errors?: unknown[]) => ({
  type: 'about:blank',
  title,
  status,
  code,
  errors,
});
const PROBLEMA_404 = problema(
  404,
  'uniplus.configuracao.referencia_reserva_demografica.nao_encontrada',
  'Referência de reserva demográfica não encontrada',
);
const PROBLEMA_500 = problema(500, 'uniplus.internal.unexpected', 'Erro interno');
const PROBLEMA_422 = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'PpiPercentual',
    code: 'uniplus.configuracao.referencia_reserva_demografica.percentual_fora_de_faixa',
    message: 'Percentual recusado.',
  },
]);
const PROBLEMA_DUPLICADO = problema(
  409,
  'uniplus.configuracao.referencia_reserva_demografica.censo_ja_existe',
  'Já existe uma referência ativa para este Censo',
);
const PROBLEMA_PROCESSANDO = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'A requisição anterior ainda está em processamento',
);

type Recarga = 'com-o-censo' | 'sem-o-censo' | 'com-falha';
type Resposta = { status: number; corpo?: unknown };

function comporte(): { espera: Promise<void>; liberar: () => void } {
  let liberar: () => void = () => undefined;
  const espera = new Promise<void>((resolve) => (liberar = resolve));
  return { espera, liberar };
}

async function responder(route: Route, status: number, corpo?: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: status >= 400 ? 'application/problem+json' : 'application/json',
    headers: CORS_HEADERS,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
}

/**
 * Cada escrita consome a próxima resposta e fica retida até `liberar`; a recarga que a segue
 * responde conforme `recarga`, depois de `ATRASO_DA_RECARGA_EM_MS`.
 */
async function mockApi(
  page: Page,
  respostas: readonly Resposta[],
  recarga: Recarga,
  primeiraConsulta: 'ok' | 'falha' = 'ok',
) {
  const retidas = respostas.map(() => comporte());
  const envios: string[] = [];
  const chaves: (string | undefined)[] = [];
  let consultas = 0;
  await page.route(
    /\/api\/configuracao\/referencias-reserva-demografica(\?.*)?$/,
    async (route) => {
      consultas += 1;
      if (primeiraConsulta === 'falha' && consultas === 1) {
        await responder(route, 500, PROBLEMA_500);
        return;
      }
      if (consultas > 1)
        await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
      if (consultas > 1 && recarga === 'com-falha') {
        await responder(route, 500, PROBLEMA_500);
        return;
      }
      await responder(route, 200, consultas > 1 && recarga === 'sem-o-censo' ? [] : [CENSO]);
    },
  );
  await page.route(
    /\/api\/configuracao\/admin\/referencias-reserva-demografica(\/[^/?]+)?$/,
    async (route) => {
      const requisicao = route.request();
      if (requisicao.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: CORS_HEADERS });
        return;
      }
      const indice = envios.length;
      envios.push(requisicao.method());
      chaves.push(requisicao.headers()['idempotency-key']);
      await retidas[indice].espera;
      const { status, corpo } = respostas[indice];
      await responder(route, status, corpo);
    },
  );
  return { envios, chaves, liberar: (indice = 0) => retidas[indice].liberar() };
}

const titulo = (page: Page) => page.getByRole('heading', { name: 'Referências', level: 2 });
const editar = (page: Page) =>
  page.getByRole('button', { name: 'Editar reserva demográfica do censo 2022', exact: true });
const remover = (page: Page) =>
  page.getByRole('button', { name: 'Remover reserva demográfica do censo 2022', exact: true });
const novo = (page: Page) => page.getByRole('button', { name: 'Novo censo' }).first();
const regiaoDeStatus = (page: Page) =>
  page.locator('cfg-reserva-demografica-page > [role="status"]');
const campo = (drawer: Locator, nome: string) => drawer.locator(`[formcontrolname="${nome}"]`);

async function abrirDrawer(page: Page, abrir: () => Promise<void>): Promise<Locator> {
  await page.goto('/reserva-demografica');
  await abrir();
  const drawer = page.getByRole('dialog', { name: 'Formulário de referência demográfica' });
  await expect(drawer).toBeVisible();
  return drawer;
}
const abrirEdicao = (page: Page) => abrirDrawer(page, () => editar(page).click());
const abrirCadastro = (page: Page) => abrirDrawer(page, () => novo(page).click());

async function pedirRemocao(page: Page): Promise<{ dialogo: Locator; confirmar: Locator }> {
  await page.goto('/reserva-demografica');
  await remover(page).click();
  const dialogo = page.getByRole('dialog', { name: 'Remover referência demográfica' });
  return { dialogo, confirmar: dialogo.getByTestId('confirm-dialog-confirm') };
}

async function preencherCadastro(drawer: Locator): Promise<void> {
  await campo(drawer, 'censoReferencia').fill('2010');
  await campo(drawer, 'ppiPercentual').fill('70');
  await campo(drawer, 'quilombolaPercentual').fill('1');
  await campo(drawer, 'pcdPercentual').fill('8');
}

test.describe('Reserva demográfica — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('edição pendente preserva foco e valores, recusa reenvio e a recusa foca o campo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 422, corpo: PROBLEMA_422 }],
      'com-o-censo',
    );
    const drawer = await abrirEdicao(page);
    const ppi = campo(drawer, 'ppiPercentual');
    await ppi.fill('80');
    await drawer.getByRole('button', { name: 'Salvar referência' }).click();
    const salvar = drawer.getByRole('button', { name: 'Salvando...' });
    await expect(ppi).toBeDisabled();
    await expect(ppi).toHaveValue('80');
    await expect(campo(drawer, 'baseLegal')).toBeDisabled();
    await expect(salvar).toBeFocused();
    await expect(salvar).toHaveAttribute('aria-disabled', 'true');
    await expect(salvar).toHaveAttribute('aria-busy', 'true');
    await expect(salvar).toHaveCSS('cursor', 'not-allowed');
    await expect(drawer.getByRole('status').filter({ hasText: 'Salvando' })).toHaveCount(1);
    await expect(drawer.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await salvar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(envios).toEqual(['PUT']);
    liberar();
    await expect(ppi).toBeEnabled();
    await expect(ppi).toBeFocused();
    await expect(ppi).toHaveAttribute('aria-invalid', 'true');
    await expect(drawer.getByText('Percentual recusado.')).toBeVisible();
  });

  test('Enter no campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível com a mesma chave', async ({
    page,
  }) => {
    const { liberar, envios, chaves } = await mockApi(
      page,
      [{ status: 500, corpo: PROBLEMA_500 }, { status: 204 }],
      'com-o-censo',
    );
    const drawer = await abrirEdicao(page);
    const base = campo(drawer, 'baseLegal');
    await base.focus();
    await page.keyboard.press('Enter');
    await expect(base).toBeDisabled();
    await expect(drawer.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar(0);
    await expect(drawer.getByText('Erro interno')).toBeVisible();
    await expect(base).toBeEnabled();
    const salvar = drawer.getByRole('button', { name: 'Salvar referência' });
    await expect(salvar).toBeFocused();
    await salvar.click();
    liberar(1);
    await expect(drawer).toBeHidden();
    expect(envios).toEqual(['PUT', 'PUT']);
    expect(chaves[1]).toBe(chaves[0]);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, [{ status: 201, corpo: 'id' }], 'com-o-censo');
    const drawer = await abrirCadastro(page);
    await drawer.getByRole('button', { name: 'Criar referência' }).focus();
    await page.keyboard.press('Enter');
    await expect(campo(drawer, 'censoReferencia')).toBeFocused();
    await expect(campo(drawer, 'censoReferencia')).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('censo duplicado marca o campo do censo e foca nele', async ({ page }) => {
    const { liberar } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_DUPLICADO }],
      'com-o-censo',
    );
    const drawer = await abrirCadastro(page);
    await preencherCadastro(drawer);
    await drawer.getByRole('button', { name: 'Criar referência' }).click();
    liberar();
    await expect(campo(drawer, 'censoReferencia')).toBeFocused();
    await expect(campo(drawer, 'censoReferencia')).toHaveAttribute('aria-invalid', 'true');
    await expect(drawer.getByText(PROBLEMA_DUPLICADO.title)).toBeVisible();
  });

  test('conflito de processamento mostra a mensagem geral e não marca o censo', async ({
    page,
  }) => {
    const { liberar } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_PROCESSANDO }],
      'com-o-censo',
    );
    const drawer = await abrirCadastro(page);
    await preencherCadastro(drawer);
    await drawer.getByRole('button', { name: 'Criar referência' }).click();
    liberar();
    await expect(drawer.getByText(PROBLEMA_PROCESSANDO.title)).toBeVisible();
    await expect(campo(drawer, 'censoReferencia')).not.toHaveAttribute('aria-invalid', 'true');
    await expect(drawer.getByRole('button', { name: 'Criar referência' })).toBeEnabled();
  });

  test('o censo fica desabilitado na edição', async ({ page }) => {
    await mockApi(page, [], 'com-o-censo');
    const drawer = await abrirEdicao(page);
    await expect(campo(drawer, 'censoReferencia')).toBeDisabled();
    await expect(campo(drawer, 'ppiPercentual')).toBeEnabled();
  });

  test('cadastro concluído devolve o foco ao botão de novo censo depois da recarga', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 201, corpo: 'novo-id' }], 'com-o-censo');
    const drawer = await abrirCadastro(page);
    await preencherCadastro(drawer);
    await drawer.getByRole('button', { name: 'Criar referência' }).click();
    liberar();
    await expect(drawer).toBeHidden();
    await expect(novo(page)).toBeDisabled();
    await expect(novo(page)).toBeEnabled();
    await expect(novo(page)).toBeFocused();
  });

  test('edição concluída devolve o foco ao botão da linha depois da recarga', async ({ page }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'com-o-censo');
    const drawer = await abrirEdicao(page);
    await drawer.getByRole('button', { name: 'Salvar referência' }).click();
    liberar();
    await expect(drawer).toBeHidden();
    await expect(editar(page)).toBeDisabled();
    await expect(editar(page)).toBeEnabled();
    await expect(editar(page)).toBeFocused();
  });

  test('edição concluída, com falha na recarga, leva o foco ao título da lista', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'com-falha');
    const drawer = await abrirEdicao(page);
    await drawer.getByRole('button', { name: 'Salvar referência' }).click();
    liberar();
    await expect(drawer).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  test('cancelar a edição devolve o foco ao botão da linha', async ({ page }) => {
    await mockApi(page, [], 'com-o-censo');
    const drawer = await abrirEdicao(page);
    await drawer.getByRole('button', { name: 'Cancelar' }).click();
    await expect(drawer).toBeHidden();
    await expect(editar(page)).toBeFocused();
  });

  test('cancelar o cadastro devolve o foco ao botão de novo censo', async ({ page }) => {
    await mockApi(page, [], 'com-o-censo');
    const drawer = await abrirCadastro(page);
    await drawer.getByRole('button', { name: 'Cancelar' }).click();
    await expect(drawer).toBeHidden();
    await expect(novo(page)).toBeFocused();
  });

  test('remoção pendente mantém o diálogo aberto, anuncia o andamento, recusa Esc, X e novo envio', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 204 }], 'sem-o-censo');
    const { dialogo, confirmar } = await pedirRemocao(page);
    await confirmar.click();
    await expect(dialogo).toBeVisible();
    await expect(dialogo.locator('.sr-only[role="status"]')).toHaveText(
      'Removendo a referência do Censo 2022.',
    );
    await expect(confirmar).toBeFocused();
    await expect(confirmar).toHaveAttribute('aria-disabled', 'true');
    await expect(confirmar).toHaveAttribute('aria-busy', 'true');
    await expect(confirmar).toHaveCSS('cursor', 'not-allowed');
    await expect(dialogo.getByTestId('confirm-dialog-cancel')).toBeDisabled();
    await expect(dialogo.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
    await confirmar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await expect(remover(page)).toBeDisabled();
    await expect(editar(page)).toBeDisabled();
    await expect(novo(page)).toBeDisabled();
    expect(envios).toEqual(['DELETE']);
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(regiaoDeStatus(page)).toHaveText('Referência do Censo 2022 removida.');
  });

  test('remoção concluída, com o censo ausente da recarga, leva o foco ao título da lista', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'sem-o-censo');
    const { confirmar } = await pedirRemocao(page);
    await confirmar.click();
    liberar();
    await expect(remover(page)).toHaveCount(0);
    await expect(titulo(page)).toBeFocused();
  });

  test('remoção concluída, com falha na recarga, leva o foco ao título da lista', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'com-falha');
    const { confirmar } = await pedirRemocao(page);
    await confirmar.click();
    liberar();
    await expect(remover(page)).toHaveCount(0);
    await expect(titulo(page)).toBeFocused();
  });

  test('remoção recusada pelo servidor (404) mantém o diálogo aberto com o motivo e o foco no botão', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 404, corpo: PROBLEMA_404 }], 'com-o-censo');
    const { dialogo, confirmar } = await pedirRemocao(page);
    await confirmar.click();
    liberar();
    await expect(dialogo.locator('.field__error')).toHaveText(PROBLEMA_404.title);
    await expect(dialogo.locator('.sr-only[role="status"]')).toContainText(PROBLEMA_404.title);
    await expect(dialogo).toBeVisible();
    await expect(confirmar).not.toHaveAttribute('aria-disabled', 'true');
    await expect(confirmar).toBeFocused();
  });

  test('remoção recusada por falha do servidor (500) mantém o diálogo aberto e aceita nova tentativa', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 500, corpo: PROBLEMA_500 }, { status: 204 }],
      'sem-o-censo',
    );
    const { dialogo, confirmar } = await pedirRemocao(page);
    await confirmar.click();
    liberar(0);
    await expect(dialogo.locator('.field__error')).toHaveText(PROBLEMA_500.title);
    await expect(dialogo.locator('.sr-only[role="status"]')).toContainText(PROBLEMA_500.title);
    await expect(confirmar).toBeFocused();
    await expect(confirmar).not.toHaveAttribute('aria-disabled', 'true');
    await confirmar.click();
    liberar(1);
    await expect(dialogo).toBeHidden();
    await expect(titulo(page)).toBeFocused();
    expect(envios).toEqual(['DELETE', 'DELETE']);
  });

  test('cancelar a confirmação devolve o foco à lixeira', async ({ page }) => {
    await mockApi(page, [], 'com-o-censo');
    const { dialogo } = await pedirRemocao(page);
    await dialogo.getByTestId('confirm-dialog-cancel').click();
    await expect(dialogo).toBeHidden();
    await expect(remover(page)).toBeFocused();
  });

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, [], 'com-o-censo', 'falha');
    await page.goto('/reserva-demografica');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(editar(page)).toBeVisible();
    await expect(titulo(page)).toBeFocused();
  });
});
