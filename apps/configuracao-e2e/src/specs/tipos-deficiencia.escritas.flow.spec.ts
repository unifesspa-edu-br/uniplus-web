import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const VISUAL = {
  id: '01960000-0000-7000-0000-0000000000c1',
  codigo: 'VISUAL',
  nome: 'Visual',
  descricao: 'Baixa visão',
  permanente: true,
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
  'uniplus.configuracao.tipo_deficiencia.nao_encontrado',
  'Tipo de deficiência não encontrado',
);
const PROBLEMA_500 = problema(500, 'uniplus.erro_interno', 'Erro interno');
const PROBLEMA_422 = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'Nome',
    code: 'uniplus.configuracao.tipo_deficiencia.nome_tamanho',
    message: 'Nome fora do padrão.',
  },
]);
const PROBLEMA_CODIGO_DUPLICADO = problema(
  409,
  'uniplus.configuracao.tipo_deficiencia.codigo_ja_existe',
  'Já existe um tipo de deficiência ativo com este código',
);
const PROBLEMA_NOME_DUPLICADO = problema(
  409,
  'uniplus.configuracao.tipo_deficiencia.nome_ja_existe',
  'Já existe um tipo de deficiência ativo com este nome',
);
const PROBLEMA_PROCESSANDO = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'A requisição anterior ainda está em processamento',
);

type Recarga = 'com-o-tipo' | 'com-o-codigo-alterado' | 'sem-o-tipo' | 'com-falha';
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
  if (recarga === 'sem-o-tipo') return [];
  return recarga === 'com-o-codigo-alterado' ? [{ ...VISUAL, codigo: 'VISUAL_V2' }] : [VISUAL];
}

/**
 * Cada escrita consome a próxima resposta e fica retida até `liberar`; a recarga que a segue
 * responde conforme `recarga`, depois de `ATRASO_DA_RECARGA_EM_MS`.
 */
async function mockApi(page: Page, respostas: readonly Resposta[], recarga: Recarga) {
  const retidas = respostas.map(() => comporte());
  const envios: string[] = [];
  const chaves: (string | undefined)[] = [];
  let consultas = 0;
  await page.route(/\/api\/configuracao\/tipos-deficiencia(\?.*)?$/, async (route) => {
    consultas += 1;
    if (consultas > 1) await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
    if (consultas > 1 && recarga === 'com-falha') {
      await responder(route, 500, PROBLEMA_500);
      return;
    }
    await responder(route, 200, consultas > 1 ? corpoDaRecarga(recarga) : [VISUAL]);
  });
  await page.route(/\/api\/configuracao\/admin\/tipos-deficiencia(\/[^/?]+)?$/, async (route) => {
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
  });
  return { envios, chaves, liberar: (indice = 0) => retidas[indice].liberar() };
}

const titulo = (page: Page) =>
  page.getByRole('heading', { name: 'Tipos de deficiência', level: 2 });
const editar = (page: Page, nome = /^Editar tipo de deficiência VISUAL$/) =>
  page.getByRole('button', { name: nome });
const remover = (page: Page) =>
  page.getByRole('button', { name: /^Remover tipo de deficiência VISUAL$/ });
const novo = (page: Page) => page.getByRole('button', { name: 'Novo tipo' }).first();
const regiaoDeStatus = (page: Page) => page.locator('cfg-tipos-deficiencia-list > [role="status"]');
const campo = (drawer: Locator, nome: string) => drawer.locator(`[formcontrolname="${nome}"]`);

async function abrirDrawer(page: Page, abrir: () => Promise<void>): Promise<Locator> {
  await page.goto('/tipos-deficiencia');
  await abrir();
  const drawer = page.getByRole('dialog', { name: 'Formulário do tipo de deficiência' });
  await expect(drawer).toBeVisible();
  return drawer;
}
const abrirEdicao = (page: Page) => abrirDrawer(page, () => editar(page).click());
const abrirCadastro = (page: Page) => abrirDrawer(page, () => novo(page).click());

async function pedirRemocao(page: Page): Promise<{ dialogo: Locator; confirmar: Locator }> {
  await page.goto('/tipos-deficiencia');
  await remover(page).click();
  const dialogo = page.getByRole('dialog', { name: /^Remover tipo de deficiência/ });
  return { dialogo, confirmar: dialogo.getByTestId('confirm-dialog-confirm') };
}

async function preencherCadastro(drawer: Locator): Promise<void> {
  await campo(drawer, 'nome').fill('Auditiva');
  await campo(drawer, 'codigo').fill('AUDITIVA');
  await campo(drawer, 'descricao').fill('Perda auditiva');
}

test.describe('Tipo de deficiência — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('edição pendente preserva foco e valores, recusa reenvio e a recusa foca o campo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 422, corpo: PROBLEMA_422 }],
      'com-o-tipo',
    );
    const drawer = await abrirEdicao(page);
    const nome = campo(drawer, 'nome');
    await nome.fill('Visual e auditiva');
    await drawer.getByRole('button', { name: 'Salvar tipo' }).click();
    const salvar = drawer.getByRole('button', { name: 'Salvando...' });
    await expect(nome).toBeDisabled();
    await expect(nome).toHaveValue('Visual e auditiva');
    await expect(campo(drawer, 'descricao')).toBeDisabled();
    await expect(salvar).toBeFocused();
    await expect(salvar).toHaveAttribute('aria-disabled', 'true');
    await expect(salvar).toHaveAttribute('aria-busy', 'true');
    await expect(salvar).toHaveCSS('cursor', 'not-allowed');
    await expect(drawer.locator('.sr-only[role="status"]')).toHaveText(
      'Salvando tipo de deficiência.',
    );
    await expect(drawer.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await salvar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(envios).toEqual(['PUT']);
    liberar();
    await expect(nome).toBeEnabled();
    await expect(nome).toBeFocused();
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
    await expect(drawer.getByText('Nome fora do padrão.')).toBeVisible();
  });

  test('Enter no campo leva o foco ao botão de salvar e, na falha 500, o envio segue disponível com a mesma chave', async ({
    page,
  }) => {
    const { liberar, envios, chaves } = await mockApi(
      page,
      [{ status: 500, corpo: PROBLEMA_500 }, { status: 204 }],
      'com-o-tipo',
    );
    const drawer = await abrirEdicao(page);
    const nome = campo(drawer, 'nome');
    await nome.focus();
    await page.keyboard.press('Enter');
    await expect(nome).toBeDisabled();
    await expect(drawer.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar(0);
    await expect(drawer.getByText('Erro interno')).toBeVisible();
    await expect(nome).toBeEnabled();
    const salvar = drawer.getByRole('button', { name: 'Salvar tipo' });
    await expect(salvar).toBeEnabled();
    await salvar.click();
    liberar(1);
    await expect(drawer).toBeHidden();
    expect(envios).toEqual(['PUT', 'PUT']);
    expect(chaves[1]).toBe(chaves[0]);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, [{ status: 201, corpo: 'id' }], 'com-o-tipo');
    const drawer = await abrirCadastro(page);
    await drawer.getByRole('button', { name: 'Criar tipo' }).focus();
    await page.keyboard.press('Enter');
    await expect(campo(drawer, 'nome')).toBeFocused();
    await expect(campo(drawer, 'nome')).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('a recusa seguida de correção e envio concluído devolve o foco ao botão de novo tipo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [
        { status: 422, corpo: PROBLEMA_422 },
        { status: 201, corpo: 'novo-id' },
      ],
      'com-o-tipo',
    );
    const drawer = await abrirCadastro(page);
    await preencherCadastro(drawer);
    await drawer.getByRole('button', { name: 'Criar tipo' }).click();
    liberar(0);
    await expect(campo(drawer, 'nome')).toBeFocused();
    await campo(drawer, 'nome').fill('Auditiva revisada');
    await drawer.getByRole('button', { name: 'Criar tipo' }).click();
    liberar(1);
    await expect(drawer).toBeHidden();
    await expect(novo(page)).toBeEnabled();
    await expect(novo(page)).toBeFocused();
    expect(envios).toEqual(['POST', 'POST']);
  });

  test('código duplicado marca o campo do código e foca nele', async ({ page }) => {
    const { liberar } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_CODIGO_DUPLICADO }],
      'com-o-tipo',
    );
    const drawer = await abrirCadastro(page);
    await preencherCadastro(drawer);
    await drawer.getByRole('button', { name: 'Criar tipo' }).click();
    liberar();
    await expect(campo(drawer, 'codigo')).toBeFocused();
    await expect(campo(drawer, 'codigo')).toHaveAttribute('aria-invalid', 'true');
    await expect(drawer.getByText(PROBLEMA_CODIGO_DUPLICADO.title)).toBeVisible();
  });

  test('nome duplicado marca o campo do nome e foca nele', async ({ page }) => {
    const { liberar } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_NOME_DUPLICADO }],
      'com-o-tipo',
    );
    const drawer = await abrirCadastro(page);
    await preencherCadastro(drawer);
    await drawer.getByRole('button', { name: 'Criar tipo' }).click();
    liberar();
    await expect(campo(drawer, 'nome')).toBeFocused();
    await expect(campo(drawer, 'nome')).toHaveAttribute('aria-invalid', 'true');
    await expect(drawer.getByText(PROBLEMA_NOME_DUPLICADO.title)).toBeVisible();
  });

  test('conflito de processamento mostra a mensagem geral e não marca nenhum campo', async ({
    page,
  }) => {
    const { liberar } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_PROCESSANDO }],
      'com-o-tipo',
    );
    const drawer = await abrirCadastro(page);
    await preencherCadastro(drawer);
    await drawer.getByRole('button', { name: 'Criar tipo' }).click();
    liberar();
    await expect(drawer.getByText(PROBLEMA_PROCESSANDO.title)).toBeVisible();
    await expect(campo(drawer, 'codigo')).not.toHaveAttribute('aria-invalid', 'true');
    await expect(campo(drawer, 'nome')).not.toHaveAttribute('aria-invalid', 'true');
    await expect(drawer.getByRole('button', { name: 'Criar tipo' })).toBeEnabled();
  });

  test('cadastro concluído devolve o foco ao botão de novo tipo depois da recarga', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 201, corpo: 'novo-id' }], 'com-o-tipo');
    const drawer = await abrirCadastro(page);
    await preencherCadastro(drawer);
    await drawer.getByRole('button', { name: 'Criar tipo' }).click();
    liberar();
    await expect(drawer).toBeHidden();
    await expect(novo(page)).toBeDisabled();
    await expect(novo(page)).toBeEnabled();
    await expect(novo(page)).toBeFocused();
  });

  test('edição concluída devolve o foco ao botão da linha depois da recarga', async ({ page }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'com-o-tipo');
    const drawer = await abrirEdicao(page);
    await drawer.getByRole('button', { name: 'Salvar tipo' }).click();
    liberar();
    await expect(drawer).toBeHidden();
    await expect(editar(page)).toBeDisabled();
    await expect(editar(page)).toBeEnabled();
    await expect(editar(page)).toBeFocused();
  });

  test('edição concluída, com a recarga devolvendo o código alterado, devolve o foco ao botão da mesma linha', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'com-o-codigo-alterado');
    const drawer = await abrirEdicao(page);
    await drawer.getByRole('button', { name: 'Salvar tipo' }).click();
    liberar();
    await expect(drawer).toBeHidden();
    const alterado = editar(page, /^Editar tipo de deficiência VISUAL_V2$/);
    await expect(alterado).toBeEnabled();
    await expect(alterado).toBeFocused();
    await expect(titulo(page)).not.toBeFocused();
  });

  test('edição concluída, com falha na recarga, leva o foco ao título da lista', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'com-falha');
    const drawer = await abrirEdicao(page);
    await drawer.getByRole('button', { name: 'Salvar tipo' }).click();
    liberar();
    await expect(drawer).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  test('cancelar a edição devolve o foco ao botão da linha', async ({ page }) => {
    await mockApi(page, [], 'com-o-tipo');
    const drawer = await abrirEdicao(page);
    await drawer.getByRole('button', { name: 'Cancelar' }).click();
    await expect(drawer).toBeHidden();
    await expect(editar(page)).toBeFocused();
  });

  test('"Tentar novamente" bem-sucedido tira o alerta e leva o foco ao título da lista', async ({
    page,
  }) => {
    let consultas = 0;
    await page.route(/\/api\/configuracao\/tipos-deficiencia(\?.*)?$/, async (route) => {
      consultas += 1;
      if (consultas === 1) await responder(route, 500, PROBLEMA_500);
      else await responder(route, 200, [VISUAL]);
    });
    await page.goto('/tipos-deficiencia');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.focus();
    await tentar.click();
    await expect(tentar).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  test('remoção pendente mantém o diálogo aberto, anuncia o andamento, recusa Esc, X e novo envio', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 204 }], 'sem-o-tipo');
    const { dialogo, confirmar } = await pedirRemocao(page);
    await confirmar.click();
    await expect(dialogo).toBeVisible();
    await expect(dialogo.locator('.sr-only[role="status"]')).toHaveText(
      'Removendo o tipo de deficiência Visual.',
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
    await expect(regiaoDeStatus(page)).toHaveText('Tipo de deficiência Visual removido.');
  });

  test('remoção concluída, com o tipo ausente da recarga, leva o foco ao título da lista', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'sem-o-tipo');
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

  test('remoção recusada (404) mantém o diálogo aberto com o motivo e o foco no botão', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 404, corpo: PROBLEMA_404 }], 'com-o-tipo');
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
      'sem-o-tipo',
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
    await mockApi(page, [], 'com-o-tipo');
    const { dialogo } = await pedirRemocao(page);
    await dialogo.getByTestId('confirm-dialog-cancel').click();
    await expect(dialogo).toBeHidden();
    await expect(remover(page)).toBeFocused();
  });
});
