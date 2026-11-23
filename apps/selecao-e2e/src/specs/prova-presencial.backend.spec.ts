import { test, type Browser, type Page, type TestInfo } from '@playwright/test';
import {
  chamarApi,
  entrarComoPersona,
  garantirConcessao,
  garantirPerfil,
  unidadeDoCertame,
} from '@uniplus/shared-e2e';
import { expect } from '../fixtures/auth.fixture';
import { irAoPasso } from '../support/navega-passo';
import {
  escolherTipoDoProcesso,
  gravarProcesso,
  preencherIdentificacaoDoProcesso,
} from '../support/passos-do-cadastro-inicial';

/**
 * Exercita a declaração da prova presencial contra Seleção e Geo reais: pendência,
 * gravação, releitura, remoção confirmada e recusa junto ao campo. Cada cenário
 * cria seu processo pelo assistente; não há interceptação das APIs.
 *
 * Roda apenas com `E2E_BACKEND_REAL=1` e a stack do `uniplus-api` no ar:
 *
 * ```bash
 * E2E_BACKEND_REAL=1 npx nx e2e selecao-e2e --project=selecao-backend-real
 * ```
 *
 * Como o cadastro inicial, usa persona fictícia, perfis reais e CEPS com cidade
 * criado pelo roteiro da stack. Cria processos reais, portanto exige ambiente descartável.
 */
const APP = process.env['BASE_URL'] ?? 'http://localhost:4200';
const PERSONA = 'helena.rezende';
const PROCESSOS = '/api/selecao/processos-seletivos';
const MARABA = '1504208';

type Municipio = { codigoIbge: string; uf: string; nome: string };
type Detalhe = { provaPresencial: { temProvaPresencial: boolean; municipios: Municipio[] } | null };
type Processo = { page: Page; id: string };

test.describe('Prova presencial contra o backend real', () => {
  test.describe.configure({ mode: 'serial' });
  let unidadeId = '';

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    unidadeId = await unidadeDoCertame();
    await prepararPerfis(unidadeId);
  });

  test('mostra a pendência enquanto a prova está por declarar', async ({ browser }, info) => {
    const processo = await criarProcesso(browser, unidadeId, info);
    await expect(
      processo.page.getByText('A prova presencial ainda não foi declarada.', { exact: false }),
    ).toBeVisible();
    expect((await detalhe(processo.id)).provaPresencial).toBeNull();
  });

  test('grava a declaração sem prova presencial', async ({ browser }, info) => {
    const processo = await criarProcesso(browser, unidadeId, info);
    await escolher(processo.page, 'Sem prova presencial');
    await gravar(processo.page, processo.id);
    expect((await detalhe(processo.id)).provaPresencial).toEqual({
      temProvaPresencial: false,
      municipios: [],
    });
  });

  test('grava o município de prova pelo código e a tela relê o nome pela Geo', async ({
    browser,
  }, info) => {
    const processo = await criarProcesso(browser, unidadeId, info);
    const municipio = await declararComMaraba(processo);
    expect((await detalhe(processo.id)).provaPresencial).toEqual({
      temProvaPresencial: true,
      municipios: [{ ...municipio, nome: null }],
    });
    await processo.page.goto(`/processo-seletivo/${processo.id}`);
    await expect(processo.page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
    await irAoPasso(processo.page, 'Prova presencial', info);
    await expect(lista(processo.page)).toContainText(`${municipio.nome} (${municipio.uf})`);
  });

  test('confirma a remoção dos municípios ao trocar para sem prova', async ({ browser }, info) => {
    const processo = await criarProcesso(browser, unidadeId, info);
    const municipio = await declararComMaraba(processo);
    await irAoPasso(processo.page, 'Prova presencial', info);
    await escolher(processo.page, 'Sem prova presencial');
    await expect(
      processo.page.getByText(/O município de prova .* será removido ao salvar/),
    ).toBeVisible();
    await confirmarRemocao(processo, municipio);
    expect((await detalhe(processo.id)).provaPresencial).toEqual({
      temProvaPresencial: false,
      municipios: [],
    });
  });

  test('aceita no rascunho a prova presencial sem município de prova', async ({
    browser,
  }, info) => {
    const processo = await criarProcesso(browser, unidadeId, info);
    await escolher(processo.page, 'Com prova presencial');
    const resposta = respostaDoPut(processo.page, processo.id);
    await processo.page.getByRole('button', { name: 'Gravar e avançar' }).click();
    expect((await resposta).status()).toBe(204);
    expect((await detalhe(processo.id)).provaPresencial).toEqual({
      temProvaPresencial: true,
      municipios: [],
    });
  });
});

async function prepararPerfis(unidadeId: string): Promise<void> {
  const perfil = await garantirPerfil(
    'E2E prova presencial — Configuração do CEPS',
    'Perfil da spec de prova presencial: cria e configura o processo.',
    ['selecao:processos:configurar'],
  );
  await garantirConcessao(PERSONA, perfil, unidadeId);
  const institucional = await garantirPerfil(
    'E2E cadastro inicial — Consulta dos cadastros do assistente',
    'Perfil da spec do cadastro inicial: lê os cadastros que o assistente oferece.',
    ['configuracao:modelos-formulario:consultar'],
  );
  await garantirConcessao(PERSONA, institucional, unidadeId);
}

async function criarProcesso(
  browser: Browser,
  unidadeId: string,
  info: TestInfo,
): Promise<Processo> {
  const page = await entrarComoPersona(browser, APP, PERSONA, '/processo-seletivo/novo');
  await escolherTipoDoProcesso(page);
  await preencherIdentificacaoDoProcesso(page, crypto.randomUUID(), unidadeId);
  const criacao = esperarCriacao(page);
  await gravarProcesso(page);
  const id = await criacao;
  await irAoPasso(page, 'Prova presencial', info);
  await expect(page.getByRole('heading', { level: 1, name: /Prova presencial/ })).toBeVisible();
  return { page, id };
}

async function esperarCriacao(page: Page): Promise<string> {
  const resposta = page.waitForResponse(
    (r) => new URL(r.url()).pathname === PROCESSOS && r.request().method() === 'POST',
  );
  return resposta.then(async (r) => {
    expect(r.status()).toBe(201);
    return (await r.json()) as string;
  });
}

async function detalhe(id: string): Promise<Detalhe> {
  const resposta = await chamarApi<Detalhe>(PERSONA, 'GET', `${PROCESSOS}/${id}`, {
    cabecalhos: { accept: 'application/vnd.uniplus.processo-seletivo.v1+json' },
  });
  expect(resposta.status).toBe(200);
  return resposta.corpo;
}

async function escolher(page: Page, nome: string): Promise<void> {
  await page.getByRole('radio', { name: new RegExp(nome) }).check({ force: true });
}

function respostaDoPut(page: Page, id: string) {
  return page.waitForResponse(
    (resposta) =>
      new URL(resposta.url()).pathname === `${PROCESSOS}/${id}/prova-presencial` &&
      resposta.request().method() === 'PUT',
  );
}

async function gravar(page: Page, id: string): Promise<void> {
  const resposta = respostaDoPut(page, id);
  await page.getByRole('button', { name: 'Gravar e avançar' }).click();
  expect((await resposta).status()).toBe(204);
  await expect(page.getByRole('heading', { level: 1, name: /Formulários/ })).toBeVisible();
}

async function declararComMaraba(processo: Processo): Promise<Municipio> {
  await escolher(processo.page, 'Com prova presencial');
  const municipio = await adicionarMaraba(processo.page);
  await gravar(processo.page, processo.id);
  return municipio;
}

async function adicionarMaraba(page: Page): Promise<Municipio> {
  const cidade = await buscarMaraba(page);
  await page.getByRole('option', { name: `${cidade.nome} (${cidade.uf})` }).click();
  await expect(lista(page)).toContainText(`${cidade.nome} (${cidade.uf})`);
  return { codigoIbge: cidade.codigoIbge, uf: cidade.uf, nome: cidade.nome };
}

async function buscarMaraba(page: Page): Promise<Municipio> {
  const busca = page.waitForResponse((resposta) => {
    const url = new URL(resposta.url());
    return url.pathname === '/api/cidades' && url.searchParams.get('q') === 'Marabá';
  });
  await page.getByRole('combobox', { name: 'Municípios de prova' }).fill('Marabá');
  const resposta = await busca;
  expect(resposta.status()).toBe(200);
  const cidades = (await resposta.json()) as Municipio[];
  const cidade = cidades.find((item) => item.codigoIbge === MARABA);
  expect(cidade).toBeDefined();
  if (!cidade) throw new Error('Marabá não foi devolvida pela Geo');
  expect(cidade.uf).toBe('PA');
  return cidade;
}

function lista(page: Page) {
  return page.getByRole('list', { name: 'Municípios de prova' });
}

async function confirmarRemocao(processo: Processo, municipio: Municipio): Promise<void> {
  await processo.page.getByRole('button', { name: 'Gravar e avançar' }).click();
  const dialogo = processo.page.getByRole('dialog', { name: 'Município de prova será removido' });
  await expect(dialogo).toContainText(`${municipio.nome} (${municipio.uf})`);
  const resposta = respostaDoPut(processo.page, processo.id);
  await dialogo.getByRole('button', { name: 'Confirmar e gravar' }).click();
  expect((await resposta).status()).toBe(204);
  await expect(processo.page.getByRole('heading', { level: 1, name: /Formulários/ })).toBeVisible();
}
