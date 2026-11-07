import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const ID_DO_MODELO = '01960000-0000-7000-0000-0000000000a1';
const ID_DO_NOVO_MODELO = '01960000-0000-7000-0000-0000000000a2';
const MODELO = {
  id: ID_DO_MODELO,
  codigo: 'INSCRICAO',
  nome: 'Inscrição',
  descricao: null,
  finalidade: 'INSCRICAO',
  tipoProcessoCodigo: null,
  ativo: true,
  conteudo: {
    titulo: 'Inscrição',
    etapas: [],
    itens: [],
    termos: [],
    pressupostos: [],
    grupos: [],
    documentosExigidos: [],
  },
};

/** Atraso da recarga da lista após a escrita: o botão da linha ainda está indisponível quando a troca termina. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

const problema = (status: number, code: string, title: string, errors?: unknown[]) => ({
  type: 'about:blank',
  title,
  status,
  code,
  ...(errors === undefined ? {} : { errors }),
});

const RECUSA_DO_NOME = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'Nome',
    code: 'uniplus.configuracao.modelo_formulario.nome_invalido',
    message: 'Nome fora do padrão.',
  },
]);
const CODIGO_JA_EXISTE = problema(
  409,
  'uniplus.configuracao.modelo_formulario.codigo_ja_existe',
  'Já existe um modelo com este código',
);
const PROCESSAMENTO_EM_CURSO = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'A requisição anterior ainda está em processamento',
);
const TROCA_RECUSADA = problema(
  409,
  'uniplus.configuracao.modelo_formulario.troca_recusada',
  'O modelo não pode mudar de situação agora',
);
const ERRO_INTERNO = problema(500, 'uniplus.internal.unexpected', 'Falha ao gravar o modelo');

type Recarga = 'com-a-situacao-trocada' | 'sem-o-modelo' | 'com-falha';
type Resposta = { status: number; corpo?: unknown };

async function responder(route: Route, { status, corpo }: Resposta): Promise<void> {
  await route.fulfill({
    status,
    headers: CORS_HEADERS,
    ...(corpo === undefined
      ? {}
      : {
          contentType: status >= 400 ? 'application/problem+json' : 'application/json',
          body: JSON.stringify(corpo),
        }),
  });
}

/**
 * Cada escrita consome a próxima resposta (a última se repete) e fica retida até `liberar`. A
 * recarga que segue uma escrita aceita demora `ATRASO_DA_RECARGA_EM_MS` e responde conforme
 * `recarga`; sem escrita aceita, a lista responde com o modelo.
 */
async function mockApi(
  page: Page,
  respostas: readonly Resposta[],
  recarga: Recarga = 'com-a-situacao-trocada',
  primeiraConsulta: 'ok' | 'falha' = 'ok',
) {
  let liberar: () => void = () => undefined;
  const retida = new Promise<void>((resolve) => (liberar = resolve));
  const envios: string[] = [];
  const chaves: string[] = [];
  let aceita = false;
  let consultas = 0;
  await page.route(/\/api\/configuracao\/tipos-processo(\?.*)?$/, (r) =>
    responder(r, { status: 200, corpo: [] }),
  );
  await page.route(
    /\/api\/configuracao\/(fatos-candidato|fases-canonicas|tipos-documento|termos-consentimento)(\?.*)?$/,
    (r) => responder(r, { status: 200, corpo: [] }),
  );
  await page.route(/\/api\/configuracao\/admin\/modelos-formulario(\?.*)?$/, async (route) => {
    const requisicao = route.request();
    if (requisicao.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    if (requisicao.method() === 'POST') {
      const resposta = respostas[Math.min(envios.length, respostas.length - 1)];
      envios.push('POST');
      chaves.push(requisicao.headers()['idempotency-key'] ?? '');
      await retida;
      aceita = resposta.status < 400;
      await responder(route, resposta);
      return;
    }
    consultas += 1;
    if (primeiraConsulta === 'falha' && consultas === 1) {
      await responder(route, { status: 500, corpo: ERRO_INTERNO });
      return;
    }
    if (aceita || consultas > 1) {
      await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
    }
    if (aceita && recarga === 'com-falha') {
      await responder(route, { status: 500, corpo: ERRO_INTERNO });
      return;
    }
    const corpo =
      aceita && recarga === 'sem-o-modelo'
        ? []
        : [{ ...MODELO, ativo: aceita ? !MODELO.ativo : MODELO.ativo }];
    await responder(route, { status: 200, corpo });
  });
  await page.route(
    /\/api\/configuracao\/admin\/modelos-formulario\/[^/?]+(\/ativacao)?$/,
    async (route) => {
      const requisicao = route.request();
      if (requisicao.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: CORS_HEADERS });
        return;
      }
      if (requisicao.method() === 'GET') {
        await responder(route, { status: 200, corpo: { ...MODELO, id: ID_DO_NOVO_MODELO } });
        return;
      }
      const resposta = respostas[Math.min(envios.length, respostas.length - 1)];
      envios.push(requisicao.method());
      chaves.push(requisicao.headers()['idempotency-key'] ?? '');
      await retida;
      aceita = resposta.status < 400;
      await responder(route, resposta);
    },
  );
  return { liberar, envios, chaves };
}

const titulo = (page: Page) =>
  page.getByRole('heading', { name: 'Modelos de formulário', level: 2 });
const drawer = (page: Page) => page.getByRole('dialog', { name: 'Novo modelo de formulário' });
const anuncioDoFormulario = (formulario: Locator) =>
  formulario.locator('span.sr-only[role="status"]');
const anuncioDaPagina = (page: Page) =>
  page.locator('cfg-modelos-formulario-page > span.sr-only[role="status"]');
const desativar = (page: Page) =>
  page.getByRole('button', { name: 'Desativar o modelo INSCRICAO' });
const ativar = (page: Page) => page.getByRole('button', { name: 'Ativar o modelo INSCRICAO' });

async function abrirCriacao(page: Page): Promise<{ acionador: Locator; formulario: Locator }> {
  await page.goto('/modelos-formulario');
  const acionador = page.getByRole('button', { name: 'Novo modelo' }).first();
  await acionador.click();
  return { acionador, formulario: drawer(page) };
}

async function preencher(formulario: Locator): Promise<void> {
  await formulario.locator('input[formcontrolname="nome"]').fill('Inscrição de Medicina');
  await formulario.locator('select[formcontrolname="finalidade"]').selectOption('INSCRICAO');
}

test.describe('Modelo de formulário — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('criação pendente preserva foco e valores, recusa reenvio e a recusa foca o campo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 422, corpo: RECUSA_DO_NOME }]);
    const { formulario } = await abrirCriacao(page);
    await preencher(formulario);
    const nome = formulario.locator('input[formcontrolname="nome"]');
    await formulario.getByRole('button', { name: 'Criar e montar o formulário' }).click();
    const salvar = formulario.getByRole('button', { name: 'Criando...' });
    await expect(nome).toBeDisabled();
    await expect(nome).toHaveValue('Inscrição de Medicina');
    await expect(salvar).toBeFocused();
    await expect(salvar).toHaveAttribute('aria-disabled', 'true');
    await expect(salvar).toHaveAttribute('aria-busy', 'true');
    await expect(salvar).toHaveCSS('cursor', 'not-allowed');
    await expect(anuncioDoFormulario(formulario)).toContainText('Criando o modelo');
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
    await expect(anuncioDoFormulario(formulario)).toContainText('Revise os campos indicados');
  });

  test('Enter no campo leva o foco ao botão de criar e, na falha 500, o envio segue disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 500, corpo: ERRO_INTERNO }]);
    const { formulario } = await abrirCriacao(page);
    await preencher(formulario);
    const nome = formulario.locator('input[formcontrolname="nome"]');
    await nome.focus();
    await page.keyboard.press('Enter');
    await expect(nome).toBeDisabled();
    await expect(formulario.getByRole('button', { name: 'Criando...' })).toBeFocused();
    liberar();
    await expect(formulario.getByText('Falha ao gravar o modelo')).toBeVisible();
    await expect(nome).toBeEnabled();
    await expect(
      formulario.getByRole('button', { name: 'Criar e montar o formulário' }),
    ).toBeFocused();
    expect(envios).toEqual(['POST']);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, [{ status: 201, corpo: ID_DO_NOVO_MODELO }]);
    const { formulario } = await abrirCriacao(page);
    const criar = formulario.getByRole('button', { name: 'Criar e montar o formulário' });
    await criar.focus();
    await page.keyboard.press('Enter');
    const nome = formulario.locator('input[formcontrolname="nome"]');
    await expect(nome).toBeFocused();
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('só o código de duplicidade marca o campo e renova a chave; o conflito de processamento a mantém', async ({
    page,
  }) => {
    const { liberar, chaves } = await mockApi(page, [
      { status: 409, corpo: CODIGO_JA_EXISTE },
      { status: 409, corpo: PROCESSAMENTO_EM_CURSO },
      { status: 409, corpo: PROCESSAMENTO_EM_CURSO },
    ]);
    liberar();
    const { formulario } = await abrirCriacao(page);
    await preencher(formulario);
    const criar = formulario.getByRole('button', { name: 'Criar e montar o formulário' });
    await criar.click();
    const codigo = formulario.locator('input[formcontrolname="codigo"]');
    await expect(codigo).toHaveAttribute('aria-invalid', 'true');
    await expect(codigo).toBeFocused();
    await expect(formulario.getByText('Já existe um modelo com este código')).toBeVisible();
    await codigo.fill('INSCRICAO_2');
    await criar.click();
    await expect(
      formulario.getByText('A requisição anterior ainda está em processamento'),
    ).toBeVisible();
    await expect(formulario.locator('[aria-invalid="true"]')).toHaveCount(0);
    await criar.click();
    await expect.poll(() => chaves.length).toBe(3);
    expect(chaves[0]).not.toBe('');
    expect(chaves[1]).not.toBe(chaves[0]);
    expect(chaves[2]).toBe(chaves[1]);
  });

  test('Cancelar devolve o foco ao botão que abriu o formulário', async ({ page }) => {
    await mockApi(page, [{ status: 201, corpo: ID_DO_NOVO_MODELO }]);
    const { acionador, formulario } = await abrirCriacao(page);

    await formulario.getByRole('button', { name: 'Cancelar' }).click();

    await expect(formulario).toBeHidden();
    await expect(acionador).toBeFocused();
  });

  test('criação concluída leva à edição do modelo criado', async ({ page }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 201, corpo: ID_DO_NOVO_MODELO }]);
    const { formulario } = await abrirCriacao(page);
    await preencher(formulario);
    await formulario.getByRole('button', { name: 'Criar e montar o formulário' }).click();
    liberar();

    await expect(page).toHaveURL(new RegExp(`/modelos-formulario/${ID_DO_NOVO_MODELO}$`));
    expect(envios).toEqual(['POST']);
  });

  test('troca de situação pendente deixa a lista indisponível, anuncia o andamento e não reenvia', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [{ status: 204 }]);
    await page.goto('/modelos-formulario');
    await desativar(page).click();
    await expect(desativar(page)).toBeDisabled();
    await expect(anuncioDaPagina(page)).toContainText('Desativando o modelo INSCRICAO');
    const novo = page.getByRole('button', { name: 'Novo modelo' }).first();
    await expect(novo).toHaveAttribute('aria-disabled', 'true');
    await expect(novo).toHaveCSS('cursor', 'not-allowed');
    await expect(page.getByRole('searchbox')).toBeDisabled();
    await expect(page.getByRole('link', { name: 'Editar o modelo INSCRICAO' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await novo.dispatchEvent('click');
    await expect(drawer(page)).toBeHidden();
    await desativar(page).dispatchEvent('click');
    expect(envios).toEqual(['DELETE']);
    liberar();
    await expect(ativar(page)).toBeEnabled();
    await expect(anuncioDaPagina(page)).toContainText('Modelo desativado: INSCRICAO');
  });

  test('troca concluída devolve o foco ao botão da linha, que passa a oferecer a ação oposta', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }]);
    await page.goto('/modelos-formulario');
    await desativar(page).click();
    liberar();
    await expect(ativar(page)).toBeFocused();
  });

  test('troca concluída, com o modelo ausente da recarga, leva o foco ao título da lista', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'sem-o-modelo');
    await page.goto('/modelos-formulario');
    await desativar(page).click();
    liberar();
    await expect(titulo(page)).toBeFocused();
  });

  test('troca concluída, com falha na recarga, leva o foco ao título da lista', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [{ status: 204 }], 'com-falha');
    await page.goto('/modelos-formulario');
    await desativar(page).click();
    liberar();
    await expect(page.getByText('Não foi possível carregar os modelos')).toBeVisible();
    await expect(titulo(page)).toBeFocused();
  });

  for (const [status, corpo] of [
    [409, TROCA_RECUSADA],
    [500, ERRO_INTERNO],
  ] as const) {
    test(`troca recusada com ${status} libera a linha e devolve o foco ao botão`, async ({
      page,
    }) => {
      const { liberar } = await mockApi(page, [{ status, corpo }]);
      await page.goto('/modelos-formulario');
      await desativar(page).click();
      await expect(desativar(page)).toBeDisabled();
      liberar();
      await expect(desativar(page)).toBeEnabled();
      await expect(desativar(page)).toBeFocused();
      await expect(anuncioDaPagina(page)).toContainText(
        'Não foi possível alterar a situação do modelo INSCRICAO',
      );
    });
  }

  test('"Tentar novamente" fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, [{ status: 204 }], 'com-a-situacao-trocada', 'falha');
    await page.goto('/modelos-formulario');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(desativar(page)).toBeVisible();
    await expect(titulo(page)).toBeFocused();
  });
});
