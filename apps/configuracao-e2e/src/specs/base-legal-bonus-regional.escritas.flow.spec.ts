import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const TIPOS_INSTRUMENTO = [
  { codigo: 'PORTARIA', nome: 'Portaria', descricao: 'Ato administrativo de autoridade pública.' },
  { codigo: 'LEI', nome: 'Lei', descricao: 'Ato normativo de maior hierarquia.' },
];

const MARABA = { id: 'cidade-1504208', codigoIbge: '1504208', nome: 'Marabá', uf: 'PA', ddd: '94' };

const BASE = {
  id: 'ba5e0000-0000-7000-8000-000000000001',
  tipoInstrumento: 'PORTARIA',
  identificacao: 'Portaria Unifesspa nº 2514/2023',
  descricao: 'Institui inclusão regional.',
  municipios: [{ codigoIbge: MARABA.codigoIbge, nome: MARABA.nome, uf: MARABA.uf }],
  criadoEm: '2026-01-01T00:00:00Z',
};

/** Atraso da recarga da lista após a escrita: o botão da linha ainda está indisponível quando o drawer ou o diálogo fecha. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

/** Atraso da nova tentativa de leitura de apoio: o andamento (foco, botão indisponível) só é observável com a resposta pendente. */
const ATRASO_DA_NOVA_TENTATIVA_EM_MS = 800;

const PROBLEMA_409_PROCESSANDO = {
  type: 'about:blank',
  title: 'Escrita em processamento',
  status: 409,
  code: 'uniplus.idempotency.processing_conflict',
};
const PROBLEMA_404 = {
  type: 'about:blank',
  title: 'Base legal de bônus regional não encontrada',
  status: 404,
  code: 'uniplus.configuracao.base_legal_bonus_regional.nao_encontrado',
};
const PROBLEMA_500 = {
  type: 'about:blank',
  title: 'Erro interno',
  status: 500,
  code: 'uniplus.internal.unexpected',
};
const CODIGO_DA_IDENTIFICACAO =
  'uniplus.configuracao.base_legal_bonus_regional.identificacao_tamanho';
const RECUSA_DE_IDENTIFICACAO = {
  type: 'about:blank',
  title: 'Dados inválidos',
  status: 422,
  code: CODIGO_DA_IDENTIFICACAO,
  errors: [
    {
      field: 'identificacao',
      code: CODIGO_DA_IDENTIFICACAO,
      message: 'Identificação fora do padrão.',
    },
  ],
};

type Recarga = 'com-o-item' | 'sem-o-item' | 'com-falha';
type Resposta = { status: number; corpo?: unknown };
const CRIADO: Resposta = { status: 201 };
const SALVO: Resposta = { status: 204 };

interface Opcoes {
  readonly recarga: Recarga;
  /** A primeira consulta da lista responde 500. */
  readonly listaFalhaNaPrimeira?: boolean;
  /** Quantas consultas iniciais do vocabulário respondem 500. */
  readonly falhasDoVocabulario?: number;
  /** A primeira busca de município responde 503. */
  readonly buscaFalhaNaPrimeira?: boolean;
}

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fulfillProblema(route: Route, corpo: object, status: number): Promise<void> {
  await route.fulfill({
    status,
    headers: CORS_HEADERS,
    contentType: 'application/problem+json',
    body: JSON.stringify(corpo),
  });
}

async function mockLista(page: Page, opcoes: Opcoes, estado: { gravou: boolean }) {
  let consultas = 0;
  await page.route(/\/api\/configuracao\/base-legal-bonus-regional(\?.*)?$/, async (route) => {
    consultas += 1;
    if (opcoes.listaFalhaNaPrimeira && consultas === 1) {
      await fulfillProblema(route, PROBLEMA_500, 500);
      return;
    }
    if (estado.gravou || consultas > 1) {
      await esperar(ATRASO_DA_RECARGA_EM_MS);
    }
    if (!estado.gravou) {
      await route.fulfill({ status: 200, headers: CORS_HEADERS, json: [BASE] });
      return;
    }
    if (opcoes.recarga === 'com-falha') {
      await fulfillProblema(route, PROBLEMA_500, 500);
      return;
    }
    const itens = { 'com-o-item': [BASE], 'sem-o-item': [] };
    await route.fulfill({ status: 200, headers: CORS_HEADERS, json: itens[opcoes.recarga] });
  });
}

async function mockApoios(page: Page, opcoes: Opcoes) {
  let consultasDoVocabulario = 0;
  let buscas = 0;
  await page.route(
    /\/api\/configuracao\/vocabularios\/tipos-instrumento-normativo(\?.*)?$/,
    async (route) => {
      consultasDoVocabulario += 1;
      if (consultasDoVocabulario <= (opcoes.falhasDoVocabulario ?? 0)) {
        await fulfillProblema(route, PROBLEMA_500, 500);
        return;
      }
      if (opcoes.falhasDoVocabulario) await esperar(ATRASO_DA_NOVA_TENTATIVA_EM_MS);
      await route.fulfill({ status: 200, headers: CORS_HEADERS, json: TIPOS_INSTRUMENTO });
    },
  );
  await page.route(/\/api\/cidades(\?.*)?$/, async (route) => {
    buscas += 1;
    if (opcoes.buscaFalhaNaPrimeira && buscas === 1) {
      await fulfillProblema(route, PROBLEMA_500, 500);
      return;
    }
    if (opcoes.buscaFalhaNaPrimeira) await esperar(ATRASO_DA_NOVA_TENTATIVA_EM_MS);
    await route.fulfill({ status: 200, headers: CORS_HEADERS, json: [MARABA] });
  });
}

/** Cada POST, PUT ou DELETE consome a próxima resposta e fica retido até `liberar`. */
async function mockApi(page: Page, respostas: readonly Resposta[], opcoes: Opcoes) {
  let liberar: () => void = () => undefined;
  const retida = new Promise<void>((resolve) => (liberar = resolve));
  const envios: string[] = [];
  const estado = { gravou: false };
  await mockLista(page, opcoes, estado);
  await mockApoios(page, opcoes);
  const escrita = async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    const resposta = respostas[envios.length];
    envios.push(route.request().method());
    await retida;
    if (resposta.status < 300) estado.gravou = true;
    const corpo = resposta.corpo;
    if (corpo !== undefined) {
      await fulfillProblema(route, corpo as object, resposta.status);
      return;
    }
    await route.fulfill({
      status: resposta.status,
      headers: CORS_HEADERS,
      ...(resposta.status === 201
        ? { contentType: 'application/json', body: JSON.stringify('novo-id') }
        : {}),
    });
  };
  await page.route(/\/api\/configuracao\/admin\/base-legal-bonus-regional\/[^/?]+$/, escrita);
  await page.route(/\/api\/configuracao\/admin\/base-legal-bonus-regional(\?.*)?$/, escrita);
  return { liberar, envios };
}

const titulo = (page: Page): Locator =>
  page.getByRole('heading', { name: 'Bases legais', level: 2 });
const novo = (page: Page): Locator => page.getByRole('button', { name: 'Nova base legal' });
const editar = (page: Page): Locator =>
  page.getByRole('button', { name: `Editar base legal ${BASE.identificacao}`, exact: true });
const lixeira = (page: Page): Locator =>
  page.getByRole('button', {
    name: `Remover base legal de bônus regional ${BASE.identificacao}`,
    exact: true,
  });
const drawer = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Formulário de base legal de bônus regional' });
const confirmacao = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Remover base legal' });
const busca = (formulario: Locator): Locator =>
  formulario.getByPlaceholder('Digite o nome completo do município…');

async function abrirCadastro(page: Page): Promise<Locator> {
  await page.goto('/base-legal-bonus-regional');
  await novo(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  await formulario.locator('select[formcontrolname="tipoInstrumento"]').selectOption('PORTARIA');
  await formulario.locator('input[formcontrolname="identificacao"]').fill('Nova portaria');
  await formulario.locator('textarea[formcontrolname="descricao"]').fill('Descrição da portaria.');
  await busca(formulario).fill('Marabá');
  await formulario.getByRole('button', { name: /Marabá — PA/ }).click();
  await expect(formulario.getByRole('button', { name: 'Remover Marabá' })).toBeVisible();
  return formulario;
}

async function abrirEdicao(page: Page): Promise<Locator> {
  await page.goto('/base-legal-bonus-regional');
  await editar(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  return formulario;
}

async function abrirRemocao(page: Page) {
  await page.goto('/base-legal-bonus-regional');
  await lixeira(page).click();
  const dialogo = confirmacao(page);
  return { dialogo, remover: dialogo.getByRole('button', { name: 'Remover', exact: true }) };
}

test.describe('Base legal de bônus regional — escritas', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('criação pendente preserva foco e valores, recusa reenvio, Esc e X; a recusa foca o campo', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 422, corpo: RECUSA_DE_IDENTIFICACAO }],
      { recarga: 'com-o-item' },
    );
    const formulario = await abrirCadastro(page);
    const identificacao = formulario.locator('input[formcontrolname="identificacao"]');
    await formulario.getByRole('button', { name: 'Criar base legal' }).click();
    const salvar = formulario.getByRole('button', { name: 'Salvando...' });
    await expect(identificacao).toBeDisabled();
    await expect(identificacao).toHaveValue('Nova portaria');
    await expect(busca(formulario)).toBeDisabled();
    await expect(formulario.getByRole('button', { name: 'Remover Marabá' })).toBeDisabled();
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
    await expect(identificacao).toBeEnabled();
    await expect(identificacao).toBeFocused();
    await expect(identificacao).toHaveAttribute('aria-invalid', 'true');
    await expect(formulario.getByText('Identificação fora do padrão.')).toBeVisible();
  });

  test('conflito de processamento aparece no alerta e deixa o envio disponível', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(
      page,
      [{ status: 409, corpo: PROBLEMA_409_PROCESSANDO }, CRIADO],
      { recarga: 'com-o-item' },
    );
    const formulario = await abrirCadastro(page);
    const enviar = formulario.getByRole('button', { name: 'Criar base legal' });
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
    const { liberar, envios } = await mockApi(page, [{ status: 500, corpo: PROBLEMA_500 }], {
      recarga: 'com-o-item',
    });
    const formulario = await abrirEdicao(page);
    const identificacao = formulario.locator('input[formcontrolname="identificacao"]');
    await identificacao.focus();
    await page.keyboard.press('Enter');
    await expect(identificacao).toBeDisabled();
    await expect(formulario.getByRole('button', { name: 'Salvando...' })).toBeFocused();
    liberar();
    await expect(formulario.locator('.alert__msg')).toBeVisible();
    await expect(identificacao).toBeEnabled();
    await expect(formulario.getByRole('button', { name: 'Salvar base legal' })).toBeFocused();
    expect(envios).toEqual(['PUT']);
  });

  test('envio barrado localmente leva o foco ao primeiro campo inválido', async ({ page }) => {
    const { envios } = await mockApi(page, [SALVO], { recarga: 'com-o-item' });
    const formulario = await abrirEdicao(page);
    const identificacao = formulario.locator('input[formcontrolname="identificacao"]');
    await identificacao.fill('');
    await formulario.getByRole('button', { name: 'Salvar base legal' }).focus();
    await page.keyboard.press('Enter');
    await expect(identificacao).toBeFocused();
    await expect(identificacao).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('sem município o envio é barrado e o foco vai à busca', async ({ page }) => {
    const { envios } = await mockApi(page, [SALVO], { recarga: 'com-o-item' });
    const formulario = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Remover Marabá' }).click();
    await formulario.getByRole('button', { name: 'Salvar base legal' }).click();
    await expect(formulario.getByText('Adicione ao menos um município.')).toBeVisible();
    await expect(busca(formulario)).toBeFocused();
    await expect(busca(formulario)).toHaveAttribute('aria-invalid', 'true');
    expect(envios).toEqual([]);
  });

  test('a falha da busca de município oferece "Tentar novamente", que devolve o foco à busca', async ({
    page,
  }) => {
    await mockApi(page, [], { recarga: 'com-o-item', buscaFalhaNaPrimeira: true });
    await page.goto('/base-legal-bonus-regional');
    await novo(page).click();
    const formulario = drawer(page);
    await busca(formulario).fill('Marabá');
    const tentar = formulario.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(formulario.getByRole('button', { name: /Marabá — PA/ })).toBeVisible();
    await expect(busca(formulario)).toBeFocused();
  });

  test('"Tentar novamente" da lista fica focado e indisponível durante a carga e leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, [], { recarga: 'com-o-item', listaFalhaNaPrimeira: true });
    await page.goto('/base-legal-bonus-regional');
    const tentar = page.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(editar(page)).toBeVisible();
    await expect(titulo(page)).toBeFocused();
  });

  test('a falha do vocabulário avisa na página e a nova tentativa leva o foco ao título', async ({
    page,
  }) => {
    await mockApi(page, [], { recarga: 'com-o-item', falhasDoVocabulario: 1 });
    await page.goto('/base-legal-bonus-regional');
    const aviso = page.locator('cfg-alerta-nova-tentativa');
    await expect(aviso).toContainText('Tipos de instrumento não carregados');
    const tentar = aviso.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(tentar).toBeFocused();
    await expect(tentar).toHaveAttribute('aria-disabled', 'true');
    await expect(aviso).toBeHidden();
    await expect(titulo(page)).toBeFocused();
  });

  test('a falha do vocabulário no formulário oferece "Tentar novamente", que leva o foco ao tipo', async ({
    page,
  }) => {
    await mockApi(page, [], { recarga: 'com-o-item', falhasDoVocabulario: 2 });
    await page.goto('/base-legal-bonus-regional');
    await novo(page).click();
    const formulario = drawer(page);
    const aviso = formulario.locator('cfg-alerta-nova-tentativa');
    await expect(aviso).toContainText('Sem o vocabulário de tipos');
    await expect(formulario.locator('select[formcontrolname="tipoInstrumento"]')).toHaveAttribute(
      'aria-describedby',
      'cfg-blbr-tipos-falha',
    );
    const tentar = aviso.getByRole('button', { name: 'Tentar novamente' });
    await tentar.click();
    await expect(aviso).toBeHidden();
    await expect(formulario.locator('select[formcontrolname="tipoInstrumento"]')).toBeFocused();
  });

  test('edição concluída devolve o foco ao acionador depois da recarga', async ({ page }) => {
    const { liberar } = await mockApi(page, [SALVO], { recarga: 'com-o-item' });
    const formulario = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Salvar base legal' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(editar(page)).toBeDisabled();
    await expect(editar(page)).toBeEnabled();
    await expect(editar(page)).toBeFocused();
  });

  test('criação concluída devolve o foco ao botão de cadastro', async ({ page }) => {
    const { liberar } = await mockApi(page, [CRIADO], { recarga: 'com-o-item' });
    const formulario = await abrirCadastro(page);
    await formulario.getByRole('button', { name: 'Criar base legal' }).click();
    liberar();
    await expect(formulario).toBeHidden();
    await expect(novo(page)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(novo(page)).toBeFocused();
  });

  test('cancelar a edição devolve o foco ao acionador', async ({ page }) => {
    await mockApi(page, [], { recarga: 'com-o-item' });
    const formulario = await abrirEdicao(page);
    await formulario.getByRole('button', { name: 'Cancelar' }).click();
    await expect(formulario).toBeHidden();
    await expect(editar(page)).toBeFocused();
  });

  for (const recarga of ['sem-o-item', 'com-falha'] as const) {
    test(`edição concluída, com a recarga ${recarga}, leva o foco ao título da lista`, async ({
      page,
    }) => {
      const { liberar } = await mockApi(page, [SALVO], { recarga });
      const formulario = await abrirEdicao(page);
      await formulario.getByRole('button', { name: 'Salvar base legal' }).click();
      liberar();
      await expect(formulario).toBeHidden();
      await expect(titulo(page)).toBeFocused();
    });
  }

  test('remoção pendente mantém o foco no botão, recusa reenvio, Esc, X e Cancelar e anuncia o andamento', async ({
    page,
  }) => {
    const { liberar, envios } = await mockApi(page, [SALVO], { recarga: 'sem-o-item' });
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
      const { liberar } = await mockApi(page, [SALVO], { recarga });
      const { dialogo, remover } = await abrirRemocao(page);
      await remover.click();
      liberar();
      await expect(dialogo).toBeHidden();
      await expect(titulo(page)).toBeFocused();
    });
  }

  test('remoção concluída com a linha ainda na recarga devolve o foco ao botão da linha', async ({
    page,
  }) => {
    const { liberar } = await mockApi(page, [SALVO], { recarga: 'com-o-item' });
    const { dialogo, remover } = await abrirRemocao(page);
    await remover.click();
    liberar();
    await expect(dialogo).toBeHidden();
    await expect(lixeira(page)).toBeEnabled();
    await expect(lixeira(page)).toBeFocused();
  });

  for (const recusa of [
    { status: 404, corpo: PROBLEMA_404 },
    { status: 500, corpo: PROBLEMA_500 },
  ]) {
    test(`remoção recusada (${recusa.status}) mantém o diálogo, a mensagem e o foco no botão, que volta a aceitar o clique`, async ({
      page,
    }) => {
      const { liberar, envios } = await mockApi(page, [recusa, SALVO], { recarga: 'sem-o-item' });
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

  test('cancelar a confirmação devolve o foco ao botão da linha', async ({ page }) => {
    await mockApi(page, [], { recarga: 'sem-o-item' });
    const { dialogo } = await abrirRemocao(page);
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await expect(lixeira(page)).toBeFocused();
  });
});
