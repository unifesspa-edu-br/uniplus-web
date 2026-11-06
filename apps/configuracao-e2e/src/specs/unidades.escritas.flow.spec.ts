import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

interface Item {
  id: string;
  nome: string;
  alias: string | null;
  slug: string;
  sigla: string;
  codigo: string;
  unidadeSuperiorId: string | null;
  tipo: string;
  unidadeAcademica: boolean;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  criadoEm: string;
  cidadeCodigoIbge: string | null;
  cidadeNome: string | null;
  cidadeUf: string | null;
}

const REITORIA: Item = {
  id: '01960000-0000-7000-0000-0000000000a1',
  nome: 'Reitoria',
  alias: null,
  slug: 'reitoria',
  sigla: 'REIT',
  codigo: '001',
  unidadeSuperiorId: null,
  tipo: 'Reitoria',
  unidadeAcademica: false,
  vigenciaInicio: '2020-01-01',
  vigenciaFim: null,
  criadoEm: '2020-01-01T00:00:00Z',
  cidadeCodigoIbge: null,
  cidadeNome: null,
  cidadeUf: null,
};
const INSTITUTO: Item = {
  ...REITORIA,
  id: '01960000-0000-7000-0000-0000000000a2',
  nome: 'Instituto de Ciências Exatas',
  slug: 'ice',
  sigla: 'ICE',
  codigo: '002',
  tipo: 'Instituto',
};

/** Atraso da recarga da lista após a escrita: o botão da linha ainda está indisponível quando o diálogo fecha. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

const problema = (status: number, code: string, title: string) => ({
  type: 'about:blank',
  title,
  status,
  code,
});
const PROBLEMA_409_PROCESSANDO = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'Escrita em processamento',
);
const PROBLEMA_409_SIGLA = problema(
  409,
  'uniplus.organizacao.unidade.sigla_ja_existe',
  'Sigla já está em uso por outra unidade',
);
const PROBLEMA_409_SUBORDINADAS = problema(
  409,
  'uniplus.organizacao.unidade.remocao_bloqueada_por_subordinadas',
  'Unidade possui subordinadas vivas',
);
const PROBLEMA_500 = problema(500, 'uniplus.internal.unexpected', 'Erro interno');
const CODIGO_NOME_TAMANHO = 'uniplus.organizacao.unidade.nome_tamanho';
const RECUSA_DE_NOME = {
  type: 'about:blank',
  title: 'Nome fora do padrão',
  status: 422,
  code: CODIGO_NOME_TAMANHO,
  errors: [{ field: 'nome', code: CODIGO_NOME_TAMANHO, message: 'Nome fora do padrão.' }],
};

/** O que a lista devolve depois da escrita bem-sucedida: os itens, ou a falha da recarga. */
type Recarga = readonly Item[] | 'falha';
type Resposta = { status: number; corpo?: unknown };
const CRIADO: Resposta = { status: 201 };
const SALVO: Resposta = { status: 204 };

const COM_AMBAS: readonly Item[] = [REITORIA, INSTITUTO];
const SEM_A_REITORIA: readonly Item[] = [INSTITUTO];

const respostaDeProblema = (route: Route, status: number, corpo: unknown) =>
  route.fulfill({
    status,
    headers: CORS_HEADERS,
    contentType: 'application/problem+json',
    body: JSON.stringify(corpo),
  });

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
  await page.route(/\/api\/organizacao\/unidades(\?.*)?$/, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    consultas += 1;
    if (primeiraConsulta === 'falha' && consultas === 1) {
      await respostaDeProblema(route, 500, PROBLEMA_500);
      return;
    }
    if (gravou) {
      await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
    }
    if (!gravou) {
      await route.fulfill({ status: 200, headers: CORS_HEADERS, json: COM_AMBAS });
    } else if (recarga === 'falha') {
      await respostaDeProblema(route, 500, PROBLEMA_500);
    } else {
      await route.fulfill({ status: 200, headers: CORS_HEADERS, json: recarga });
    }
  });
  await page.route(/\/api\/organizacao\/admin\/unidades(\/[^?]*)?$/, async (route) => {
    const metodo = route.request().method();
    if (metodo === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    const resposta = respostas[envios.length];
    envios.push(metodo);
    await retida;
    if (resposta.status < 300) gravou = true;
    if (resposta.corpo !== undefined) {
      await respostaDeProblema(route, resposta.status, resposta.corpo);
      return;
    }
    await route.fulfill({
      status: resposta.status,
      headers: CORS_HEADERS,
      ...(resposta.status === 201
        ? { contentType: 'application/json', body: JSON.stringify('novo-id') }
        : {}),
    });
  });
  return { liberar, envios };
}

const titulo = (page: Page): Locator =>
  page.getByRole('heading', { name: 'Unidades', level: 2, exact: true });
const novo = (page: Page): Locator => page.getByRole('button', { name: 'Nova unidade' });
const editar = (page: Page): Locator =>
  page.getByRole('button', { name: `Editar unidade ${REITORIA.sigla}` });
const lixeira = (page: Page): Locator =>
  page.getByRole('button', { name: `Remover unidade ${REITORIA.sigla}` });
const drawer = (page: Page): Locator => page.getByRole('dialog', { name: 'Formulário de unidade' });
const confirmacao = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Remover unidade', exact: true });

async function abrirCadastro(page: Page): Promise<Locator> {
  await page.goto('/unidades');
  await novo(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  await formulario.locator('input[formcontrolname="sigla"]').fill('NTEC');
  await formulario.locator('input[formcontrolname="slug"]').fill('ntec');
  await formulario.locator('input[formcontrolname="codigo"]').fill('500');
  await formulario.locator('input[formcontrolname="nome"]').fill('Núcleo de Tecnologia');
  return formulario;
}

async function abrirEdicao(page: Page): Promise<Locator> {
  await page.goto('/unidades');
  await editar(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  return formulario;
}

async function abrirConfirmacao(page: Page) {
  await page.goto('/unidades');
  await lixeira(page).click();
  const dialogo = confirmacao(page);
  return { dialogo, confirmar: dialogo.getByRole('button', { name: 'Remover', exact: true }) };
}

test.describe('Unidade — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('criação pendente preserva foco e valores, recusa reenvio, Esc e X; a recusa foca o campo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 422, corpo: RECUSA_DE_NOME }],
      COM_AMBAS,
    );
    const formulario = await abrirCadastro(page);
    const nome = formulario.locator('input[formcontrolname="nome"]');
    await formulario.getByRole('button', { name: 'Criar unidade' }).click();
    const salvar = formulario.getByRole('button', { name: 'Salvando...' });
    await expect(nome).toBeDisabled();
    await expect(nome).toHaveValue('Núcleo de Tecnologia');
    await expect(salvar).toBeFocused();
    await expect(salvar).toHaveAttribute('aria-disabled', 'true');
    await expect(salvar).toHaveAttribute('aria-busy', 'true');
    await expect(salvar).toHaveCSS('cursor', 'not-allowed');
    await expect(
      formulario.locator('[role="status"]').filter({ hasText: 'Salvando' }),
    ).toBeAttached();
    await expect(formulario.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(formulario).toBeVisible();
    await expect(formulario.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await salvar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(envios).toEqual(['POST']);
    liberar();
    await expect(nome).toBeEnabled();
    await expect(nome).toBeFocused();
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
    await expect(formulario.getByText('Nome fora do padrão.')).toBeVisible();
    await expect(
      formulario.locator('[role="status"]').filter({ hasText: 'Revise os campos' }),
    ).toBeAttached();
  });

  test('sigla já em uso marca o campo de sigla e o foca', async ({ page }) => {
    const { liberar } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_409_SIGLA }],
      COM_AMBAS,
    );
    const formulario = await abrirCadastro(page);
    await formulario.getByRole('button', { name: 'Criar unidade' }).click();
    liberar();
    const sigla = formulario.locator('input[formcontrolname="sigla"]');
    await expect(sigla).toBeFocused();
    await expect(sigla).toHaveAttribute('aria-invalid', 'true');
    await expect(formulario.getByText(PROBLEMA_409_SIGLA.title)).toBeVisible();
  });

  test('conflito de processamento aparece no alerta e deixa o envio disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_409_PROCESSANDO }, CRIADO],
      COM_AMBAS,
    );
    const formulario = await abrirCadastro(page);
    const enviar = formulario.getByRole('button', { name: 'Criar unidade' });
    await enviar.click();
    liberar();
    await expect(formulario.locator('.alert__msg')).toContainText('Escrita em processamento');
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
      COM_AMBAS,
    );
    const formulario = await abrirEdicao(page);
    const nome = formulario.locator('input[formcontrolname="nome"]');
    await nome.focus();
    await page.keyboard.press('Enter');
    await expect(nome).toBeDisabled();
    await expect(formulario.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar();
    await expect(formulario.locator('.alert__msg')).toBeVisible();
    await expect(nome).toBeEnabled();
    await expect(formulario.getByRole('button', { name: 'Salvar unidade' })).toBeFocused();
    expect(envios).toEqual(['PUT']);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, [SALVO], COM_AMBAS);
    const formulario = await abrirEdicao(page);
    const sigla = formulario.locator('input[formcontrolname="sigla"]');
    await sigla.fill('');
    await formulario.getByRole('button', { name: 'Salvar unidade' }).focus();
    await page.keyboard.press('Enter');
    await expect(sigla).toBeFocused();
    await expect(sigla).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, [], COM_AMBAS, 'falha');
    await page.goto('/unidades');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(editar(page)).toBeVisible();
    await expect(titulo(page)).toBeFocused();
  });

  test('edição concluída devolve o foco ao acionador depois da recarga', async ({ page }) => {
    const { liberar } = await mockApi(page, [SALVO], COM_AMBAS);
    const formulario = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Salvar unidade' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(editar(page)).toBeDisabled();
    await expect(editar(page)).toBeEnabled();
    await expect(editar(page)).toBeFocused();
  });

  test('criação concluída devolve o foco ao botão de cadastro', async ({ page }) => {
    const { liberar } = await mockApi(page, [CRIADO], COM_AMBAS);
    const formulario = await abrirCadastro(page);
    await formulario.getByRole('button', { name: 'Criar unidade' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(novo(page)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(novo(page)).toBeFocused();
  });

  test('cancelar a edição devolve o foco ao acionador', async ({ page }) => {
    await mockApi(page, [], COM_AMBAS);
    const formulario = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Cancelar' }).click();
    await expect(formulario).toBeHidden();
    await expect(editar(page)).toBeFocused();
  });

  for (const recarga of [SEM_A_REITORIA, 'falha'] as const) {
    test(`edição concluída, com a recarga ${recarga === 'falha' ? 'com falha' : 'sem o item'}, leva o foco ao título da lista`, async ({
      page,
    }) => {
      const { liberar } = await mockApi(page, [SALVO], recarga);
      const formulario = await abrirEdicao(page);
      await formulario.getByRole('button', { name: 'Salvar unidade' }).click();
      liberar();
      await expect(formulario).toBeHidden();
      await expect(titulo(page)).toBeFocused();
    });
  }

  test('remoção pendente mantém o foco no botão, recusa reenvio, Esc, X e Cancelar e anuncia o andamento', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [SALVO], SEM_A_REITORIA);
    const { dialogo, confirmar } = await abrirConfirmacao(page);
    await confirmar.click();
    await expect(confirmar).toBeFocused();
    await expect(confirmar).toHaveAttribute('aria-disabled', 'true');
    await expect(confirmar).toHaveAttribute('aria-busy', 'true');
    await expect(confirmar).toHaveCSS('cursor', 'not-allowed');
    await expect(dialogo.getByRole('status')).toContainText('Removendo');
    await expect(dialogo.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
    await confirmar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(envios).toEqual(['DELETE']);
    liberar();
    await expect(dialogo).toBeHidden();
  });

  test('remoção concluída, com a unidade ainda na lista, leva o foco ao botão de remover da linha', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [SALVO], COM_AMBAS);
    const { dialogo, confirmar } = await abrirConfirmacao(page);
    await confirmar.click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(lixeira(page)).toBeEnabled();
    await expect(lixeira(page)).toBeFocused();
  });

  for (const recarga of [SEM_A_REITORIA, 'falha'] as const) {
    test(`remoção concluída, com a recarga ${recarga === 'falha' ? 'com falha' : 'sem o item'}, leva o foco ao título da lista`, async ({
      page,
    }) => {
      const { liberar } = await mockApi(page, [SALVO], recarga);
      const { dialogo, confirmar } = await abrirConfirmacao(page);
      await confirmar.click();
      liberar();
      await expect(dialogo).toBeHidden();
      await expect(titulo(page)).toBeFocused();
    });
  }

  for (const recusa of [
    { status: 409, corpo: PROBLEMA_409_SUBORDINADAS },
    { status: 500, corpo: PROBLEMA_500 },
  ]) {
    test(`remoção recusada (${recusa.status}) mantém o diálogo, a mensagem e o foco no botão, que volta a aceitar o clique`, async ({
      page,
    }) => {
      const { liberar, envios } = await mockApi(page, [recusa, SALVO], SEM_A_REITORIA);
      const { dialogo, confirmar } = await abrirConfirmacao(page);
      await confirmar.click();
      liberar();
      const mensagem = dialogo.locator('.field__error');
      await expect(mensagem).toContainText(recusa.corpo.title);
      await expect(confirmar).not.toHaveAttribute('aria-disabled', 'true');
      await expect(confirmar).toBeFocused();
      await expect(dialogo.getByRole('status')).toContainText('Não foi possível remover');
      await confirmar.click();
      await expect(mensagem).toBeHidden();
      await expect(dialogo).toBeHidden();
      expect(envios).toEqual(['DELETE', 'DELETE']);
    });
  }

  test('cancelar a confirmação devolve o foco ao botão de remover da linha', async ({ page }) => {
    await mockApi(page, [], SEM_A_REITORIA);
    const { dialogo } = await abrirConfirmacao(page);
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(lixeira(page)).toBeFocused();
  });
});
