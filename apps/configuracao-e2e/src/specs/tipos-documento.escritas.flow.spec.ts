import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import { categoriasSeed, rgSeed as TIPO } from '../support/tipos-documento-api';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

/** Atraso da recarga da lista após a escrita: o botão da linha ainda está indisponível quando o drawer ou o diálogo fecha. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

const PROBLEMA_409_PROCESSANDO = {
  type: 'about:blank',
  title: 'Escrita em processamento',
  status: 409,
  code: 'uniplus.idempotency.processing_conflict',
};
const PROBLEMA_409_DUPLICADO = {
  type: 'about:blank',
  title: 'Já existe um tipo de documento ativo com este código',
  status: 409,
  code: 'uniplus.configuracao.tipo_documento.codigo_ja_existe',
};
const PROBLEMA_409_CONCORRENCIA = {
  type: 'about:blank',
  title: 'Conflito de concorrência',
  status: 409,
  code: 'uniplus.concorrencia.conflito',
};
const PROBLEMA_409_CONCORRENCIA_DO_TIPO = {
  ...PROBLEMA_409_CONCORRENCIA,
  code: 'uniplus.configuracao.tipo_documento.conflito_de_concorrencia',
};
const PROBLEMA_404 = {
  type: 'about:blank',
  title: 'Tipo de documento não encontrado',
  status: 404,
  code: 'uniplus.configuracao.tipo_documento.nao_encontrado',
};
const PROBLEMA_500 = {
  type: 'about:blank',
  title: 'Erro interno',
  status: 500,
  code: 'uniplus.internal.unexpected',
};
const RECUSA_DE_NOME = {
  type: 'about:blank',
  title: 'Dados inválidos',
  status: 422,
  code: 'uniplus.configuracao.tipo_documento.nome_tamanho',
  errors: [
    {
      field: 'nome',
      code: 'uniplus.configuracao.tipo_documento.nome_tamanho',
      message: 'Nome fora do padrão.',
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
  const chaves: (string | null)[] = [];
  let gravou = false;
  let consultas = 0;
  await page.route(/\/api\/configuracao\/categorias-documento(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, headers: CORS_HEADERS, json: categoriasSeed }),
  );
  await page.route(/\/api\/configuracao\/admin\/protecao-do-catalogo(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, headers: CORS_HEADERS, json: [] }),
  );
  await page.route(/\/api\/configuracao\/tipos-documento(\?.*)?$/, async (route) => {
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
      await route.fulfill({ status: 200, headers: CORS_HEADERS, json: [TIPO] });
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
    const itens = { 'com-o-item': [TIPO], 'sem-o-item': [] };
    await route.fulfill({ status: 200, headers: CORS_HEADERS, json: itens[recarga] });
  });
  const escrita = async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    const resposta = respostas[envios.length];
    envios.push(route.request().method());
    chaves.push(await route.request().headerValue('idempotency-key'));
    await retida;
    if (resposta.status < 300) gravou = true;
    const corpo = resposta.corpo;
    await route.fulfill({
      status: resposta.status,
      headers: CORS_HEADERS,
      ...(corpo === undefined
        ? resposta.status === 201
          ? { contentType: 'application/json', body: JSON.stringify('novo-id') }
          : {}
        : { contentType: 'application/problem+json', body: JSON.stringify(corpo) }),
    });
  };
  await page.route(/\/api\/configuracao\/admin\/tipos-documento\/[^/?]+$/, escrita);
  await page.route(/\/api\/configuracao\/admin\/tipos-documento(\?.*)?$/, escrita);
  return { liberar, envios, chaves };
}

const titulo = (page: Page): Locator =>
  page.getByRole('heading', { name: 'Tipos de documento', level: 2 });
const novo = (page: Page): Locator => page.getByRole('button', { name: 'Novo tipo' }).first();
const editar = (page: Page): Locator =>
  page.getByRole('button', { name: `Editar tipo de documento ${TIPO.codigo}`, exact: true });
const lixeira = (page: Page): Locator =>
  page.getByRole('button', { name: `Remover tipo de documento ${TIPO.codigo}`, exact: true });
const drawer = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Formulário de tipo de documento', exact: true });
const confirmacao = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Remover tipo de documento', exact: true });
const salvarDe = (formulario: Locator): Locator =>
  formulario.getByRole('button', { name: /^(Criar|Salvar) tipo de documento$/ });

async function abrirCadastro(page: Page): Promise<Locator> {
  await page.goto('/tipos-documento');
  await novo(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  await formulario.locator('[formControlName="codigo"]').fill('DECL_RENDA');
  await formulario.locator('[formControlName="nome"]').fill('Declaração de renda');
  await formulario.locator('[formControlName="categoria"]').selectOption('RENDA');
  await formulario.locator('[formControlName="classificacaoProtecao"]').selectOption('PESSOAL');
  await formulario
    .locator('[formControlName="hipoteseLegal"]')
    .selectOption({ label: 'Execução de políticas públicas' });
  await formulario
    .locator('[formControlName="finalidadeTratamento"]')
    .fill('Comprovar a renda do candidato.');
  return formulario;
}

async function abrirEdicao(page: Page): Promise<Locator> {
  await page.goto('/tipos-documento');
  await editar(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  return formulario;
}

async function abrirRemocao(page: Page) {
  await page.goto('/tipos-documento');
  await lixeira(page).click();
  const dialogo = confirmacao(page);
  return { dialogo, remover: dialogo.getByRole('button', { name: 'Remover', exact: true }) };
}

test.describe('Tipo de documento — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('criação pendente preserva foco e valores, recusa reenvio, Esc e X; a recusa foca o campo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 422, corpo: RECUSA_DE_NOME }],
      'com-o-item',
    );
    const formulario = await abrirCadastro(page);
    const nome = formulario.locator('[formControlName="nome"]');
    await salvarDe(formulario).click();
    const salvar = formulario.getByRole('button', { name: 'Salvando...' });
    await expect(nome).toBeDisabled();
    await expect(nome).toHaveValue('Declaração de renda');
    await expect(formulario.locator('[formControlName="categoria"]')).toBeDisabled();
    await expect(salvar).toBeFocused();
    await expect(salvar).toHaveAttribute('aria-disabled', 'true');
    await expect(salvar).toHaveAttribute('aria-busy', 'true');
    await expect(salvar).toHaveCSS('cursor', 'not-allowed');
    await expect(formulario.locator('[role="status"]').filter({ hasText: 'Salvando' })).toHaveCount(
      1,
    );
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
  });

  test('o código duplicado marca o campo Código, mantém o formulário e deixa o envio disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_409_DUPLICADO }, CRIADO],
      'com-o-item',
    );
    const formulario = await abrirCadastro(page);
    await salvarDe(formulario).click();
    liberar();
    const codigo = formulario.locator('[formControlName="codigo"]');
    await expect(codigo).toHaveAttribute('aria-invalid', 'true');
    await expect(codigo).toBeFocused();
    await expect(formulario.getByText(PROBLEMA_409_DUPLICADO.title)).toBeVisible();
    await codigo.fill('DECL_RENDA_2');
    await salvarDe(formulario).click();
    await expect(formulario).toBeHidden();
    expect(envios).toEqual(['POST', 'POST']);
  });

  test('conflito de processamento aparece no alerta, sem marcar campo, e deixa o envio disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_409_PROCESSANDO }, CRIADO],
      'com-o-item',
    );
    const formulario = await abrirCadastro(page);
    const enviar = salvarDe(formulario);
    await enviar.click();
    liberar();
    await expect(formulario.locator('.alert__msg')).toContainText('Escrita em processamento');
    await expect(formulario.locator('.field.is-error')).toHaveCount(0);
    await expect(enviar).not.toHaveAttribute('aria-disabled', 'true');
    await enviar.click();
    await expect(formulario).toBeHidden();
    expect(envios).toEqual(['POST', 'POST']);
  });

  test('o conflito de concorrência no salvamento vai ao alerta, sem marcar campo, e o reenvio usa chave nova', async ({
    page,
  }) => {
    const { liberar, envios, chaves } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_409_CONCORRENCIA_DO_TIPO }, SALVO],
      'com-o-item',
    );
    const formulario = await abrirEdicao(page);
    const enviar = salvarDe(formulario);
    await enviar.click();
    liberar();
    await expect(formulario.locator('.alert__msg')).toContainText('Conflito de concorrência');
    await expect(formulario.locator('.field.is-error')).toHaveCount(0);
    await expect(enviar).not.toHaveAttribute('aria-disabled', 'true');
    await enviar.click();
    await expect(formulario).toBeHidden();
    expect(envios).toEqual(['PUT', 'PUT']);
    expect(chaves[0]).toBeTruthy();
    expect(chaves[1]).toBeTruthy();
    expect(chaves[1]).not.toBe(chaves[0]);
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
    const nome = formulario.locator('[formControlName="nome"]');
    await nome.focus();
    await page.keyboard.press('Enter');
    await expect(nome).toBeDisabled();
    await expect(formulario.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar();
    await expect(formulario.locator('.alert__msg')).toBeVisible();
    await expect(nome).toBeEnabled();
    await expect(salvarDe(formulario)).toBeFocused();
    expect(envios).toEqual(['PUT']);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, [SALVO], 'com-o-item');
    const formulario = await abrirEdicao(page);
    const nome = formulario.locator('[formControlName="nome"]');
    await nome.fill('');
    await salvarDe(formulario).focus();
    await page.keyboard.press('Enter');
    await expect(nome).toBeFocused();
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, [], 'com-o-item', 'falha');
    await page.goto('/tipos-documento');
    const tentar = page
      .locator('ui-alert')
      .filter({ hasText: 'Não foi possível carregar os tipos de documento' })
      .getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(editar(page)).toBeVisible();
    await expect(titulo(page)).toBeFocused();
  });

  test('edição concluída devolve o foco ao acionador depois da recarga', async ({ page }) => {
    const { liberar } = await mockApi(page, [SALVO], 'com-o-item');
    const formulario = await abrirEdicao(page);
    await salvarDe(formulario).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(editar(page)).toBeDisabled();
    await expect(editar(page)).toBeEnabled();
    await expect(editar(page)).toBeFocused();
  });

  test('criação concluída devolve o foco ao botão de cadastro', async ({ page }) => {
    const { liberar } = await mockApi(page, [CRIADO], 'com-o-item');
    const formulario = await abrirCadastro(page);
    await salvarDe(formulario).click();
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
      await salvarDe(formulario).click();
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
    await expect(dialogo.getByRole('status').filter({ hasText: 'Removendo' })).toHaveCount(1);
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

  test('remoção concluída com a linha ainda na recarga devolve o foco à lixeira da linha', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [SALVO], 'com-o-item');
    const { dialogo, remover } = await abrirRemocao(page);
    await remover.click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(lixeira(page)).toBeEnabled();
    await expect(lixeira(page)).toBeFocused();
  });

  for (const recusa of [
    { status: 404, corpo: PROBLEMA_404 },
    { status: 409, corpo: PROBLEMA_409_CONCORRENCIA },
    { status: 500, corpo: PROBLEMA_500 },
  ]) {
    test(`remoção recusada (${recusa.status}) mantém o diálogo, a mensagem e o foco no botão, que volta a aceitar o clique`, async ({
      page,
    }) => {
      const { liberar, envios } = await mockApi(page, [recusa, SALVO], 'sem-o-item');
      const { dialogo, remover } = await abrirRemocao(page);
      await remover.click();
      liberar();
      const mensagem = dialogo.locator('.field__error');
      await expect(mensagem).toContainText(recusa.corpo.title);
      await expect(remover).not.toHaveAttribute('aria-disabled', 'true');
      await expect(remover).toBeFocused();
      await expect(
        dialogo.getByRole('status').filter({ hasText: 'Não foi possível remover' }),
      ).toHaveCount(1);
      await remover.click();
      await expect(mensagem).toBeHidden();
      await expect(dialogo).toBeHidden();
      expect(envios).toEqual(['DELETE', 'DELETE']);
    });
  }

  test('cancelar a confirmação devolve o foco à lixeira da linha', async ({ page }) => {
    await mockApi(page, [], 'sem-o-item');
    const { dialogo } = await abrirRemocao(page);
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(lixeira(page)).toBeFocused();
  });
});
