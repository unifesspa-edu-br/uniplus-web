import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const LOCAL = {
  id: '01960000-0000-7000-0000-0000000000d1',
  tipo: 'poloEad',
  codigoEmec: '999',
  campusResponsavelId: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

/** Atraso da recarga da lista após a escrita: os botões da linha ainda estão indisponíveis quando a sobreposição fecha. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

const PROBLEMA_409 = {
  type: 'about:blank',
  title: 'Local referenciado por oferta de curso ativa',
  status: 409,
  code: 'uniplus.configuracao.local_oferta.remocao_bloqueada_por_oferta_curso',
};

const PROBLEMA_500 = {
  type: 'about:blank',
  title: 'Erro interno',
  status: 500,
  code: 'uniplus.internal.unexpected',
};

const PROBLEMA_422 = {
  type: 'about:blank',
  title: 'Dados inválidos',
  status: 422,
  code: 'uniplus.validacao',
  errors: [
    {
      field: 'CodigoEmec',
      code: 'uniplus.configuracao.local_oferta.codigo_emec_tamanho',
      message: 'Código e-MEC fora do padrão.',
    },
  ],
};

type Recarga = 'com-o-local' | 'com-o-tipo-alterado' | 'sem-o-local' | 'com-falha';
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

function corpoDaRecarga(recarga: Recarga): readonly unknown[] {
  if (recarga === 'sem-o-local') return [];
  return recarga === 'com-o-tipo-alterado' ? [{ ...LOCAL, tipo: 'campusForaDeSede' }] : [LOCAL];
}

/**
 * Cada escrita consome a próxima resposta e fica retida até `liberar`; a recarga que a segue
 * responde conforme `recarga`, depois de `ATRASO_DA_RECARGA_EM_MS`.
 */
async function mockApi(page: Page, respostas: readonly Resposta[], recarga: Recarga) {
  const retidas = respostas.map(() => comporte());
  const envios: string[] = [];
  let consultas = 0;
  await page.route(/\/api\/configuracao\/campi(\?.*)?$/, (route) => responder(route, 200, []));
  await page.route(/\/api\/configuracao\/locais-oferta(\?.*)?$/, async (route) => {
    consultas += 1;
    if (consultas > 1) await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
    if (consultas > 1 && recarga === 'com-falha') {
      await responder(route, 500, PROBLEMA_500);
      return;
    }
    await responder(route, 200, consultas > 1 ? corpoDaRecarga(recarga) : [LOCAL]);
  });
  await page.route(/\/api\/configuracao\/admin\/locais-oferta\/[^/?]+$/, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    const indice = envios.length;
    envios.push(route.request().method());
    await retidas[indice].espera;
    const { status, corpo } = respostas[indice];
    await responder(route, status, corpo);
  });
  return { envios, liberar: (indice = 0) => retidas[indice].liberar() };
}

const titulo = (page: Page) => page.getByRole('heading', { name: 'Locais de oferta', level: 2 });
const editar = (page: Page, nome = /^Editar local de oferta/) =>
  page.getByRole('button', { name: nome });
const remover = (page: Page) => page.getByRole('button', { name: /^Remover local de oferta/ });
const novo = (page: Page) => page.getByRole('button', { name: 'Novo local de oferta' }).first();
/** A primeira região anuncia as escritas; a segunda, a leitura dos campi. */
const regiaoDeStatus = (page: Page) =>
  page.locator('cfg-locais-oferta-page > [role="status"]').first();

async function abrirEdicao(page: Page): Promise<Locator> {
  await page.goto('/locais-oferta');
  await editar(page).click();
  const drawer = page.getByRole('dialog', { name: 'Formulário de local de oferta' });
  await expect(drawer).toBeVisible();
  return drawer;
}

async function pedirRemocao(page: Page): Promise<{ dialogo: Locator; confirmar: Locator }> {
  await page.goto('/locais-oferta');
  await remover(page).click();
  const dialogo = page.getByRole('dialog', { name: 'Remover local de oferta' });
  return { dialogo, confirmar: dialogo.getByTestId('confirm-dialog-confirm') };
}

test.describe('Local de oferta — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('edição pendente preserva foco e valores, recusa reenvio e a recusa foca o campo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 422, corpo: PROBLEMA_422 }],
      'com-o-local',
    );
    const drawer = await abrirEdicao(page);
    const codigo = drawer.locator('input[formcontrolname="codigoEmec"]');
    await codigo.fill('12345');
    await drawer.getByRole('button', { name: 'Salvar local' }).click();
    const salvar = drawer.getByRole('button', { name: 'Salvando...' });
    await expect(codigo).toBeDisabled();
    await expect(codigo).toHaveValue('12345');
    await expect(drawer.locator('select[formcontrolname="tipo"]')).toBeDisabled();
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
    await expect(codigo).toBeEnabled();
    await expect(codigo).toBeFocused();
    await expect(codigo).toHaveAttribute('aria-invalid', 'true');
    await expect(drawer.getByText('Código e-MEC fora do padrão.')).toBeVisible();
  });

  test('Enter no campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 500, corpo: PROBLEMA_500 }],
      'com-o-local',
    );
    const drawer = await abrirEdicao(page);
    const codigo = drawer.locator('input[formcontrolname="codigoEmec"]');
    await codigo.focus();
    await page.keyboard.press('Enter');
    await expect(codigo).toBeDisabled();
    await expect(drawer.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar();
    await expect(drawer.getByText('Erro interno')).toBeVisible();
    await expect(codigo).toBeEnabled();
    await expect(drawer.getByRole('button', { name: 'Salvar local' })).toBeEnabled();
    expect(envios).toEqual(['PUT']);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, [{ status: 201 }], 'com-o-local');
    await page.goto('/locais-oferta');
    await novo(page).click();
    const drawer = page.getByRole('dialog', { name: 'Formulário de local de oferta' });
    await drawer.getByRole('button', { name: 'Criar local' }).focus();
    await page.keyboard.press('Enter');
    await expect(drawer.locator('select[formcontrolname="tipo"]')).toBeFocused();
    expect(envios).toEqual([]);
  });

  test('cadastro novo com o CEP pendente leva o foco ao CEP e não afirma que falta a cidade', async ({
    page,
  }) => {
    const { envios } = await mockApi(page, [{ status: 201 }], 'com-o-local');
    await page.goto('/locais-oferta');
    await novo(page).click();
    const drawer = page.getByRole('dialog', { name: 'Formulário de local de oferta' });
    await drawer.locator('select[formcontrolname="tipo"]').selectOption({ index: 1 });
    const cep = drawer.locator('ui-endereco-geo input[id$="-cep"]');
    await cep.fill('68507');
    await drawer.getByRole('button', { name: 'Criar local' }).click();
    await expect(cep).toBeFocused();
    await expect(drawer.getByText('Selecione a cidade do endereço')).toHaveCount(0);
    expect(envios).toEqual([]);
  });

  test('edição concluída devolve o foco ao botão da linha depois da recarga', async ({ page }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'com-o-local');
    const drawer = await abrirEdicao(page);
    await drawer.getByRole('button', { name: 'Salvar local' }).click();
    liberar();
    await expect(drawer).toBeHidden();
    await expect(editar(page)).toBeDisabled();
    await expect(editar(page)).toBeEnabled();
    await expect(editar(page)).toBeFocused();
  });

  test('edição concluída, com a recarga devolvendo o tipo alterado, devolve o foco ao botão da mesma linha', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'com-o-tipo-alterado');
    const drawer = await abrirEdicao(page);
    await drawer.getByRole('button', { name: 'Salvar local' }).click();
    liberar();
    await expect(drawer).toBeHidden();
    const alterado = editar(page, /^Editar local de oferta Campus fora de sede/);
    await expect(alterado).toBeEnabled();
    await expect(alterado).toBeFocused();
    await expect(titulo(page)).not.toBeFocused();
  });

  test('edição concluída, com falha na recarga, leva o foco ao título da lista', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'com-falha');
    const drawer = await abrirEdicao(page);
    await drawer.getByRole('button', { name: 'Salvar local' }).click();
    liberar();
    await expect(drawer).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  test('cancelar a edição devolve o foco ao botão da linha', async ({ page }) => {
    await mockApi(page, [], 'com-o-local');
    const drawer = await abrirEdicao(page);
    await drawer.getByRole('button', { name: 'Cancelar' }).click();
    await expect(drawer).toBeHidden();
    await expect(editar(page)).toBeFocused();
  });

  test('remoção pendente mantém o diálogo aberto, anuncia o andamento, recusa Esc, X e novo envio', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 204 }], 'sem-o-local');
    const { dialogo, confirmar } = await pedirRemocao(page);
    await confirmar.click();
    await expect(dialogo).toBeVisible();
    await expect(dialogo.getByRole('status')).toHaveText('Removendo o local de oferta.');
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
    await expect(regiaoDeStatus(page)).toHaveText('Local de oferta removido.');
  });

  test('remoção concluída, com o local ausente da recarga, leva o foco ao título da lista', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'sem-o-local');
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

  test('remoção recusada por conflito (409) mantém o diálogo aberto com o motivo e o foco no botão', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 409, corpo: PROBLEMA_409 }], 'com-o-local');
    const { dialogo, confirmar } = await pedirRemocao(page);
    await confirmar.click();
    liberar();
    await expect(dialogo.locator('.field__error')).toHaveText(PROBLEMA_409.title);
    await expect(dialogo.getByRole('status')).toContainText(PROBLEMA_409.title);
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
      'sem-o-local',
    );
    const { dialogo, confirmar } = await pedirRemocao(page);
    await confirmar.click();
    liberar(0);
    await expect(dialogo.locator('.field__error')).toHaveText(PROBLEMA_500.title);
    await expect(dialogo.getByRole('status')).toContainText(PROBLEMA_500.title);
    await expect(confirmar).toBeFocused();
    await expect(confirmar).not.toHaveAttribute('aria-disabled', 'true');
    await confirmar.click();
    liberar(1);
    await expect(dialogo).toBeHidden();
    await expect(titulo(page)).toBeFocused();
    expect(envios).toEqual(['DELETE', 'DELETE']);
  });

  test('cancelar a confirmação devolve o foco à lixeira', async ({ page }) => {
    await mockApi(page, [], 'com-o-local');
    const { dialogo } = await pedirRemocao(page);
    await dialogo.getByTestId('confirm-dialog-cancel').click();
    await expect(dialogo).toBeHidden();
    await expect(remover(page)).toBeFocused();
  });
});
