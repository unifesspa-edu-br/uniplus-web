import { expect, test, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * Escritas dos fatos do candidato num navegador real: com a escrita em curso o formulário é só
 * leitura e o drawer não fecha; a recusa leva o foco ao campo; o foco só muda depois do desfecho;
 * e o cancelamento o devolve a quem abriu. API mockada por `page.route`; autenticação real pelo
 * projeto `fluxo-chromium`.
 */

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const FATO = {
  id: '01960000-0000-7000-0000-0000000000a1',
  codigo: 'TRABALHA',
  nome: 'Trabalha',
  descricao: 'Se o candidato trabalha.',
  componenteExibicao: null,
  dominio: 'BOOLEANO',
  origem: 'DECLARADO',
  cardinalidade: 'ESCALAR',
  fonteValores: null,
  formato: null,
  pontoResolucao: 'INSCRICAO',
  binding: 'CAMPO_INSCRICAO:TRABALHA',
  escopo: 'CANDIDATO',
  classificacaoProtecao: 'PESSOAL',
  finalidadeTratamento: 'Classificar a reserva de vagas.',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  sistema: false,
  ativo: true,
  valores: [],
  regrasPadrao: [],
  aprovacao: {
    situacao: 'APROVADA',
    solicitadaEm: null,
    decididaEm: null,
    classificacaoRecomendada: null,
    justificativa: null,
    aceitaEm: null,
  },
};

const FASES = [{ id: 'f1', codigo: 'INSCRICAO', nome: 'Inscrição', descricao: null }];

/** Atraso da recarga da lista após a escrita: o foco só pode mudar quando ela termina. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

const ERRO_INTERNO = {
  type: 'about:blank',
  title: 'Erro interno',
  status: 500,
  code: 'uniplus.internal.unexpected',
};

const CONFLITO = {
  type: 'about:blank',
  title: 'Conflito de concorrência',
  status: 409,
  code: 'uniplus.concorrencia.conflito',
};

const RECUSA_DE_NOME = {
  type: 'about:blank',
  title: 'Requisição inválida',
  status: 422,
  code: 'uniplus.validation_failed',
  traceId: 'e2e',
  errors: [
    {
      field: 'nome',
      code: 'uniplus.configuracao.fato_candidato.nome_tamanho',
      message: 'Nome fora do padrão.',
    },
  ],
};

async function responder(route: Route, status: number, corpo?: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: status >= 400 ? 'application/problem+json' : 'application/json',
    headers: CORS_HEADERS,
    body: status === 204 || corpo === undefined ? undefined : JSON.stringify(corpo),
  });
}

type Recarga = 'com-o-fato' | 'sem-o-fato' | 'com-falha';

/** A escrita fica retida até `liberar()`, para observar a tela enquanto ela está em curso. */
async function mockApi(
  page: Page,
  resposta: { status: number; corpo?: unknown },
  recarga: Recarga = 'com-o-fato',
) {
  let liberar: () => void = () => undefined;
  const retida = new Promise<void>((resolve) => (liberar = resolve));
  const envios: string[] = [];
  let consultas = 0;
  let escrito = false;
  await page.route(/\/api\/configuracao\/fases-canonicas(\?.*)?$/, (r) => responder(r, 200, FASES));
  await page.route(/\/api\/configuracao\/fatos-candidato(\?.*)?$/, (r) => responder(r, 200, []));
  await page.route(/\/api\/configuracao\/admin\/protecao-do-catalogo(\?.*)?$/, (r) =>
    responder(r, 200, []),
  );
  await page.route(/\/api\/configuracao\/admin\/fatos-candidato(\?.*)?$/, async (route) => {
    const metodo = route.request().method();
    if (metodo === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    if (metodo !== 'GET') {
      envios.push(metodo);
      await retida;
      escrito = resposta.status < 400 || recarga === 'sem-o-fato';
      await responder(route, resposta.status, resposta.corpo);
      return;
    }
    consultas += 1;
    if (consultas > 1) await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
    if (consultas > 1 && recarga === 'com-falha') {
      await responder(route, 500, ERRO_INTERNO);
      return;
    }
    await responder(route, 200, escrito && recarga === 'sem-o-fato' ? [] : [FATO]);
  });
  await page.route(
    /\/api\/configuracao\/admin\/fatos-candidato\/[^/?]+(\/[^?]*)?(\?.*)?$/,
    async (route) => {
      const metodo = route.request().method();
      if (metodo === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: CORS_HEADERS });
        return;
      }
      if (metodo === 'GET') {
        await responder(route, 200, FATO);
        return;
      }
      envios.push(metodo);
      await retida;
      escrito = resposta.status < 400 || recarga === 'sem-o-fato';
      await responder(route, resposta.status, resposta.corpo);
    },
  );
  return { liberar, envios };
}

const tituloDaLista = (page: Page) => page.locator('#cfg-fatos-list-title');
const formulario = (page: Page) => page.getByRole('dialog', { name: 'Fato do candidato' });
const confirmacao = (page: Page) => page.getByRole('dialog', { name: /Desativar fato/ });
const editar = (page: Page) => page.getByRole('button', { name: 'Editar o fato TRABALHA' });
const desativar = (page: Page) => page.getByRole('button', { name: 'Desativar o fato TRABALHA' });

async function preencherCriacao(page: Page): Promise<void> {
  // O input do rádio é escondido pelo estilo; quem recebe o clique é o rótulo.
  await page.getByText('Derivado por regra de outros fatos').click();
  await expect(page.locator('input[type="radio"][value="DERIVADO"]')).toBeChecked();
  await page.locator('input[formcontrolname="nome"]').fill('Perfil socioeconômico');
  await page.locator('input[formcontrolname="codigo"]').fill('PERFIL');
  await page.locator('textarea[formcontrolname="descricao"]').fill('Perfil que define a reserva.');
  await page.locator('select[formcontrolname="dominio"]').selectOption('BOOLEANO');
  await page.locator('#cfg-fato-pontoResolucao').selectOption('INSCRICAO');
  await page.locator('select[formcontrolname="classificacaoProtecao"]').selectOption('PESSOAL');
  await page
    .locator('select[formcontrolname="hipoteseLegal"]')
    .selectOption('EXECUCAO_POLITICAS_PUBLICAS');
  await page.locator('[formcontrolname="finalidadeTratamento"]').fill('Classificar a reserva.');
}

test.describe('Fato do candidato — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('criação pendente deixa o formulário só leitura, sem reenvio, e a recusa leva o foco ao campo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, { status: 422, corpo: RECUSA_DE_NOME });
    await page.goto('/fatos-candidato');
    await page.locator('#cfg-fatos-novo').click();
    const drawer = formulario(page);
    await preencherCriacao(page);

    await drawer.getByRole('button', { name: 'Criar fato' }).focus();
    await drawer.getByRole('button', { name: 'Criar fato' }).click();

    const nome = page.locator('input[formcontrolname="nome"]');
    const criando = drawer.getByRole('button', { name: 'Criando...' });
    await expect(nome).toBeDisabled();
    await expect(nome).toHaveValue('Perfil socioeconômico');
    await expect(criando).toBeFocused();
    await expect(criando).toHaveAttribute('aria-disabled', 'true');
    await expect(criando).toHaveAttribute('aria-busy', 'true');
    await expect(criando).toHaveCSS('cursor', 'not-allowed');
    await expect(drawer.locator('[role="status"]').filter({ hasText: 'Criando fato' })).toHaveCount(
      1,
    );
    await expect(drawer.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await expect(drawer.getByRole('button', { name: 'Fechar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeVisible();
    await criando.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await page.evaluate(() => new Promise((resolver) => requestAnimationFrame(resolver)));
    expect(envios).toEqual(['POST']);

    liberar();
    await expect(nome).toBeEnabled();
    await expect(nome).toBeFocused();
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
    await expect(
      drawer.locator('.field__error').filter({ hasText: 'Nome fora do padrão.' }),
    ).toHaveCount(1);
  });

  test('Enter num campo leva o foco ao botão e, na falha 500, o envio segue disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, { status: 500, corpo: ERRO_INTERNO });
    await page.goto('/fatos-candidato');
    await page.locator('#cfg-fatos-novo').click();
    const drawer = formulario(page);
    await preencherCriacao(page);
    const nome = page.locator('input[formcontrolname="nome"]');
    await nome.focus();
    await page.keyboard.press('Enter');

    await expect(nome).toBeDisabled();
    await expect(drawer.getByRole('button', { name: 'Criando...' })).toBeFocused();
    liberar();
    await expect(drawer.locator('ui-alert').first()).toContainText('Erro interno');
    await expect(nome).toBeEnabled();
    await expect(drawer.getByRole('button', { name: 'Criar fato' })).toBeFocused();
    expect(envios).toEqual(['POST']);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, { status: 201, corpo: 'novo-id' });
    await page.goto('/fatos-candidato');
    await page.locator('#cfg-fatos-novo').click();
    const drawer = formulario(page);
    await preencherCriacao(page);
    const nome = page.locator('input[formcontrolname="nome"]');
    await nome.fill('');
    await drawer.getByRole('button', { name: 'Criar fato' }).focus();
    await page.keyboard.press('Enter');

    await expect(nome).toBeFocused();
    await expect(nome).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('edição pendente trava os campos e o fechar, e o sucesso segue na edição do mesmo fato', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, { status: 204 });
    await page.goto('/fatos-candidato');
    await editar(page).click();
    const drawer = formulario(page);
    const salvar = drawer.getByRole('button', { name: 'Salvar nome, descrição e componente' });
    // O fieldset desabilitado trava os campos dentro dele; o fieldset em si não é controle nativo.
    const nome = page.locator('#cfg-fato-descritivo input[formcontrolname="nome"]');
    await salvar.click();

    await expect(nome).toBeDisabled();
    await expect(salvar).toHaveAttribute('aria-busy', 'true');
    await expect(salvar).toHaveCSS('cursor', 'not-allowed');
    await expect(
      drawer.getByRole('button', { name: 'Fechar', exact: true }).first(),
    ).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeVisible();
    await salvar.dispatchEvent('click');
    await salvar.focus();
    await page.keyboard.press('Space');
    await page.evaluate(() => new Promise((resolver) => requestAnimationFrame(resolver)));
    expect(envios).toEqual(['PUT']);

    liberar();
    await expect(nome).toBeEnabled({
      timeout: ATRASO_DA_RECARGA_EM_MS * 3,
    });
    await expect(drawer).toBeVisible();
    await expect(salvar).toBeFocused();
  });

  test('cancelar a edição devolve o foco ao botão que abriu o drawer, sem escrever', async ({
    page,
  }) => {
    const { envios } = await mockApi(page, { status: 204 });
    await page.goto('/fatos-candidato');
    await editar(page).focus();
    await editar(page).click();
    const drawer = formulario(page);
    await drawer.getByRole('button', { name: 'Fechar', exact: true }).last().click();

    await expect(drawer).toBeHidden();
    await expect(editar(page)).toBeFocused();
    expect(envios).toEqual([]);
  });

  test('desativação pendente mantém o diálogo, anuncia o andamento e não reenvia', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, { status: 204 });
    await page.goto('/fatos-candidato');
    await desativar(page).click();
    const dialogo = confirmacao(page);
    const confirmar = dialogo.getByRole('button', { name: 'Desativar', exact: true });
    await confirmar.click();

    await expect(confirmar).toBeFocused();
    await expect(confirmar).toHaveAttribute('aria-disabled', 'true');
    await expect(confirmar).toHaveCSS('cursor', 'not-allowed');
    await expect(
      dialogo.locator('[role="status"]').filter({ hasText: 'Gravando o fato TRABALHA' }),
    ).toHaveCount(1);
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeVisible();
    await confirmar.dispatchEvent('click');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await page.evaluate(() => new Promise((resolver) => requestAnimationFrame(resolver)));
    expect(envios).toEqual(['DELETE']);

    liberar();
    await expect(dialogo).toBeHidden();
  });

  test('desativação concluída, com a recarga sem o fato, leva o foco ao título só depois dela', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, { status: 204 }, 'sem-o-fato');
    await page.goto('/fatos-candidato');
    await desativar(page).click();
    await confirmacao(page).getByRole('button', { name: 'Desativar', exact: true }).click();

    liberar();
    await expect(confirmacao(page)).toBeHidden();
    await expect(tituloDaLista(page)).not.toBeFocused();
    await expect(tituloDaLista(page)).toBeFocused({ timeout: ATRASO_DA_RECARGA_EM_MS * 3 });
    await expect(desativar(page)).toHaveCount(0);
  });

  for (const recusa of [
    { status: 409, corpo: CONFLITO, mensagem: 'Outra pessoa alterou este fato' },
    { status: 500, corpo: ERRO_INTERNO, mensagem: 'Erro interno' },
  ]) {
    test(`desativação recusada (${recusa.status}) mantém o diálogo, com o foco no botão, e a nova tentativa segue disponível`, async ({
      page,
    }) => {
      const { liberar, envios } = await mockApi(page, recusa);
      await page.goto('/fatos-candidato');
      await desativar(page).click();
      const dialogo = confirmacao(page);
      const confirmar = dialogo.getByRole('button', { name: 'Desativar', exact: true });
      await confirmar.click();

      liberar();
      await expect(dialogo.locator('.field__error')).toContainText(recusa.mensagem);
      await expect(dialogo).toBeVisible();
      await expect(confirmar).toBeFocused();
      await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
      await expect(confirmar).not.toHaveAttribute('aria-disabled', 'true', {
        timeout: ATRASO_DA_RECARGA_EM_MS * 3,
      });
      expect(envios).toEqual(['DELETE']);
    });
  }

  test('desativação concluída com a recarga da lista falhando leva o foco ao título, que segue na tela', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, { status: 204 }, 'com-falha');
    await page.goto('/fatos-candidato');
    await desativar(page).click();
    await confirmacao(page).getByRole('button', { name: 'Desativar', exact: true }).click();

    liberar();
    await expect(confirmacao(page)).toBeHidden();
    await expect(page.getByText('Não foi possível carregar os fatos')).toBeVisible({
      timeout: ATRASO_DA_RECARGA_EM_MS * 3,
    });
    await expect(tituloDaLista(page)).toBeFocused();
  });

  test('criação concluída leva o foco ao início da edição do fato criado, não ao corpo da página', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, { status: 201, corpo: 'novo-id' });
    await page.goto('/fatos-candidato');
    await page.locator('#cfg-fatos-novo').click();
    const drawer = formulario(page);
    await preencherCriacao(page);
    await drawer.getByRole('button', { name: 'Criar fato' }).focus();
    await drawer.getByRole('button', { name: 'Criar fato' }).click();

    liberar();

    await expect(page.locator('#cfg-fato-edicao-inicio')).toBeFocused({
      timeout: ATRASO_DA_RECARGA_EM_MS * 3,
    });
  });

  test('desativação recusada (409) com a linha fora da recarga: ao cancelar, o foco vai ao título', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, { status: 409, corpo: CONFLITO }, 'sem-o-fato');
    await page.goto('/fatos-candidato');
    await desativar(page).click();
    const dialogo = confirmacao(page);
    await dialogo.getByRole('button', { name: 'Desativar', exact: true }).click();

    liberar();
    const cancelar = dialogo.getByRole('button', { name: 'Cancelar' });
    await expect(cancelar).toBeDisabled();
    await expect(cancelar).toBeEnabled({ timeout: ATRASO_DA_RECARGA_EM_MS * 3 });
    await expect(desativar(page)).toHaveCount(0);
    await cancelar.click();

    await expect(dialogo).toBeHidden();
    await expect(tituloDaLista(page)).toBeFocused();
  });

  test('cancelar a desativação devolve o foco ao botão da linha, sem escrever', async ({
    page,
  }) => {
    const { envios } = await mockApi(page, { status: 204 });
    await page.goto('/fatos-candidato');
    await desativar(page).focus();
    await desativar(page).click();
    await confirmacao(page).getByRole('button', { name: 'Cancelar' }).click();

    await expect(confirmacao(page)).toBeHidden();
    await expect(desativar(page)).toBeFocused();
    expect(envios).toEqual([]);
  });
});
