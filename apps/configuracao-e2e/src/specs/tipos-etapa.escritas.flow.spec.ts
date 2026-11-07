import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const TIPO = {
  id: '01960000-0000-7000-0000-0000000000e1',
  codigo: 'PROVA',
  nome: 'Prova',
  descricao: null,
  ativo: true,
  admitePontuacao: true,
  admiteEliminacao: true,
  notaDeOrigemNoEnem: false,
  criadoEm: '2026-08-11T00:00:00Z',
};

/** Atraso da recarga da lista após a escrita: o botão da linha ainda está indisponível quando o diálogo fecha. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

const PROBLEMA_409_PROCESSANDO = {
  type: 'about:blank',
  title: 'Escrita em processamento',
  status: 409,
  code: 'uniplus.idempotency.processing_conflict',
};
const PROBLEMA_409_CODIGO = {
  type: 'about:blank',
  title: 'Código do tipo de etapa já está reservado',
  status: 409,
  code: 'uniplus.configuracao.tipo_etapa.codigo_ja_existe',
};
const PROBLEMA_422_NOTA_DO_ENEM = {
  type: 'about:blank',
  title: 'Tipo de etapa com nota de origem no ENEM não pode ser desativado',
  status: 422,
  code: 'uniplus.configuracao.tipo_etapa.nota_de_origem_no_enem_nao_desativa',
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
  code: 'uniplus.validacao',
  errors: [
    {
      field: 'Nome',
      code: 'uniplus.configuracao.tipo_etapa.nome_tamanho',
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
  let gravou = false;
  let consultas = 0;
  await page.route(/\/api\/configuracao\/tipos-etapa(\?.*)?$/, async (route) => {
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
  await page.route(/\/api\/configuracao\/admin\/tipos-etapa\/[^/?]+$/, escrita);
  await page.route(/\/api\/configuracao\/admin\/tipos-etapa(\?.*)?$/, escrita);
  return { liberar, envios };
}

const titulo = (page: Page): Locator =>
  page.getByRole('heading', { name: 'Tipos de etapa', level: 2 });
const novo = (page: Page): Locator => page.getByRole('button', { name: 'Novo tipo de etapa' });
const editar = (page: Page): Locator =>
  page.getByRole('button', { name: `Editar tipo de etapa ${TIPO.codigo}` });
const lixeira = (page: Page): Locator =>
  page.getByRole('button', { name: `Remover tipo de etapa ${TIPO.codigo}` });
const drawer = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Formulário de tipo de etapa' });
const confirmacao = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Remover tipo de etapa' });

async function abrirCadastro(page: Page): Promise<Locator> {
  await page.goto('/tipos-etapa');
  await novo(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  await formulario.locator('input[formcontrolname="codigo"]').fill('NOVA_PROVA');
  await formulario.locator('input[formcontrolname="nome"]').fill('Nova prova');
  return formulario;
}

async function abrirEdicao(page: Page): Promise<Locator> {
  await page.goto('/tipos-etapa');
  await editar(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  return formulario;
}

async function abrirRemocao(page: Page) {
  await page.goto('/tipos-etapa');
  await lixeira(page).click();
  const dialogo = confirmacao(page);
  return { dialogo, remover: dialogo.getByRole('button', { name: 'Remover', exact: true }) };
}

test.describe('Tipo de etapa — escritas', () => {
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
    const nome = formulario.locator('input[formcontrolname="nome"]');
    await formulario.getByRole('button', { name: 'Criar tipo de etapa' }).click();
    const salvar = formulario.getByRole('button', { name: 'Salvando...' });
    await expect(nome).toBeDisabled();
    await expect(nome).toHaveValue('Nova prova');
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
    await expect(nome).toBeEnabled();
    await expect(nome).toBeFocused();
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
    await expect(formulario.getByText('Nome fora do padrão.')).toBeVisible();
  });

  test('código já reservado marca o campo de código e o foca', async ({ page }) => {
    const { liberar } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_409_CODIGO }],
      'com-o-item',
    );
    const formulario = await abrirCadastro(page);
    await formulario.getByRole('button', { name: 'Criar tipo de etapa' }).click();
    liberar();
    const codigo = formulario.locator('input[formcontrolname="codigo"]');
    await expect(codigo).toBeFocused();
    await expect(codigo).toHaveAttribute('aria-invalid', 'true');
    await expect(formulario.getByText('Código do tipo de etapa já está reservado')).toBeVisible();
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
    const enviar = formulario.getByRole('button', { name: 'Criar tipo de etapa' });
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
    const nome = formulario.locator('input[formcontrolname="nome"]');
    await nome.focus();
    await page.keyboard.press('Enter');
    await expect(nome).toBeDisabled();
    await expect(formulario.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar();
    await expect(formulario.locator('.alert__msg')).toBeVisible();
    await expect(nome).toBeEnabled();
    await expect(formulario.getByRole('button', { name: 'Salvar tipo de etapa' })).toBeFocused();
    expect(envios).toEqual(['PUT']);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, [SALVO], 'com-o-item');
    const formulario = await abrirEdicao(page);
    const nome = formulario.locator('input[formcontrolname="nome"]');
    await nome.fill('');
    await formulario.getByRole('button', { name: 'Salvar tipo de etapa' }).focus();
    await page.keyboard.press('Enter');
    await expect(nome).toBeFocused();
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, [], 'com-o-item', 'falha');
    await page.goto('/tipos-etapa');
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
    await formulario.getByRole('button', { name: 'Salvar tipo de etapa' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(editar(page)).toBeDisabled();
    await expect(editar(page)).toBeEnabled();
    await expect(editar(page)).toBeFocused();
  });

  test('criação concluída devolve o foco ao botão de cadastro', async ({ page }) => {
    const { liberar } = await mockApi(page, [CRIADO], 'com-o-item');
    const formulario = await abrirCadastro(page);
    await formulario.getByRole('button', { name: 'Criar tipo de etapa' }).click();
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
      await formulario.getByRole('button', { name: 'Salvar tipo de etapa' }).click();
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

  for (const recusa of [
    { status: 422, corpo: PROBLEMA_422_NOTA_DO_ENEM },
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
      await expect(dialogo.getByRole('status')).toContainText('Não foi possível remover');
      await remover.click();
      await expect(mensagem).toBeHidden();
      await expect(dialogo).toBeHidden();
      expect(envios).toEqual(['DELETE', 'DELETE']);
    });
  }

  test('cancelar a confirmação devolve o foco ao botão de remover da linha', async ({ page }) => {
    await mockApi(page, [], 'sem-o-item');
    const { dialogo } = await abrirRemocao(page);
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(lixeira(page)).toBeFocused();
  });
});
