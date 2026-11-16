import { expect, test, type Page, type Route } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import {
  CODIGO_DA_OFERTA,
  CURSO,
  LOCAL,
  OFERTA,
  UNIDADE,
  escolherVinculosETurno,
  preencherCodigoDaOferta,
} from '../support/dados-de-oferta-de-curso';
import {
  problema,
  responder,
  responderPreflight,
  servirLeitura,
} from '../support/escritas-retidas';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * Código da Oferta de curso: a identidade da oferta, obrigatória na criação. O formulário o mantém
 * em caixa alta, recusa o que foge do formato antes de enviar e leva ao campo a recusa que o
 * servidor emite (obrigatório, formato ou código já em uso). API mockada por `page.route`;
 * autenticação real pelo projeto `fluxo-chromium`.
 */

const PREFIXO_DO_CODIGO = 'uniplus.configuracao.oferta_curso.';
const CODIGO_JA_EM_USO = problema(
  409,
  `${PREFIXO_DO_CODIGO}codigo_ja_em_uso`,
  'Já existe uma oferta de curso ativa com este código.',
);

interface Escritas {
  readonly posts: unknown[];
  readonly puts: unknown[];
}

async function mockApi(page: Page, recusa?: ReturnType<typeof problema>): Promise<Escritas> {
  const escritas: Escritas = { posts: [], puts: [] };
  await servirLeitura(page, /\/api\/configuracao\/ofertas-curso(\?.*)?$/, [OFERTA]);
  await servirLeitura(page, /\/api\/configuracao\/cursos(\?.*)?$/, [CURSO]);
  await servirLeitura(page, /\/api\/configuracao\/locais-oferta(\?.*)?$/, [LOCAL]);
  await servirLeitura(page, /\/api\/organizacao\/unidades(\?.*)?$/, [UNIDADE]);
  await page.route(/\/api\/configuracao\/admin\/ofertas-curso(\/[^/?]+)?(\?.*)?$/, (route) =>
    aoEscrever(route, escritas, recusa),
  );
  return escritas;
}

async function aoEscrever(
  route: Route,
  escritas: Escritas,
  recusa?: ReturnType<typeof problema>,
): Promise<void> {
  const metodo = route.request().method();
  if (metodo === 'OPTIONS') return responderPreflight(route);
  (metodo === 'POST' ? escritas.posts : escritas.puts).push(route.request().postDataJSON());
  if (recusa) return responder(route, { status: recusa.status, corpo: recusa });
  if (metodo === 'POST') return responder(route, { status: 201, corpo: 'nova-oferta-id' });
  await responder(route, { status: 204 });
}

const campoDoCodigo = (page: Page) => page.locator('input[formcontrolname="codigo"]');
const criar = (page: Page) => page.getByRole('button', { name: 'Criar oferta' });

async function abrirCadastro(page: Page): Promise<void> {
  await page.goto('/ofertas-curso');
  await page.getByRole('button', { name: 'Nova oferta de curso' }).first().click();
  await expect(campoDoCodigo(page)).toBeVisible();
}

test.describe('Oferta de curso — código', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('a lista mostra o código de cada oferta', async ({ page }) => {
    await mockApi(page);
    await page.goto('/ofertas-curso');

    await expect(page.getByRole('columnheader', { name: 'Código' })).toBeVisible();
    await expect(page.locator('td[data-label="Código"]')).toHaveText([CODIGO_DA_OFERTA]);
  });

  test('o código digitado em minúsculas vai ao comando em caixa alta', async ({ page }) => {
    const escritas = await mockApi(page);
    await abrirCadastro(page);
    await preencherCodigoDaOferta(page, 'eng_civil_maraba');
    await escolherVinculosETurno(page);
    await criar(page).click();

    await expect.poll(() => escritas.posts.length).toBe(1);
    expect(escritas.posts[0]).toMatchObject({ codigo: 'ENG_CIVIL_MARABA' });
  });

  test('sem o código o envio é barrado e o foco vai ao campo', async ({ page }) => {
    const escritas = await mockApi(page);
    await abrirCadastro(page);
    await escolherVinculosETurno(page);
    await criar(page).click();

    await expect(campoDoCodigo(page)).toBeFocused();
    await expect(campoDoCodigo(page)).toHaveAttribute('aria-invalid', 'true');
    expect(escritas.posts).toEqual([]);
  });

  for (const invalido of ['1ENGENHARIA', 'ENG CIVIL', 'ENG-CIVIL', 'E']) {
    test(`o código "${invalido}" é barrado por formato antes de enviar`, async ({ page }) => {
      const escritas = await mockApi(page);
      await abrirCadastro(page);
      await preencherCodigoDaOferta(page, invalido);
      await escolherVinculosETurno(page);
      await criar(page).click();

      await expect(page.locator('#cfg-oferta-codigo-dica + .field__error')).toContainText(
        'Formato inválido',
      );
      expect(escritas.posts).toEqual([]);
    });
  }

  test('o código com 50 caracteres é aceito e o de 51 é barrado', async ({ page }) => {
    const escritas = await mockApi(page);
    await abrirCadastro(page);
    await escolherVinculosETurno(page);

    await preencherCodigoDaOferta(page, 'A'.repeat(51));
    await criar(page).click();
    expect(escritas.posts).toEqual([]);

    await preencherCodigoDaOferta(page, 'A'.repeat(50));
    await criar(page).click();
    await expect.poll(() => escritas.posts.length).toBe(1);
  });

  test('a recusa de código já em uso leva ao campo do código, associada e com o foco', async ({
    page,
  }) => {
    await mockApi(page, CODIGO_JA_EM_USO);
    await abrirCadastro(page);
    await preencherCodigoDaOferta(page, CODIGO_DA_OFERTA);
    await escolherVinculosETurno(page);
    await criar(page).click();

    await expect(campoDoCodigo(page)).toBeFocused();
    await expect(campoDoCodigo(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#cfg-oferta-codigo-dica + .field__error')).toHaveText(
      'Já existe uma oferta de curso ativa com este código.',
    );
  });

  test('a edição abre com o código da oferta e o devolve no comando', async ({ page }) => {
    const escritas = await mockApi(page);
    await page.goto('/ofertas-curso');
    await page.getByRole('button', { name: /^Editar oferta de curso/ }).click();

    await expect(campoDoCodigo(page)).toHaveValue(CODIGO_DA_OFERTA);
    await page.getByRole('button', { name: 'Salvar oferta' }).click();
    await expect.poll(() => escritas.puts.length).toBe(1);
    expect(escritas.puts[0]).toMatchObject({ codigo: CODIGO_DA_OFERTA });
  });

  test('o formulário com o campo do código não tem violação WCAG A e AA', async ({ page }) => {
    await mockApi(page);
    await abrirCadastro(page);
    await preencherCodigoDaOferta(page, '1ENGENHARIA');
    await criar(page).click();

    expect((await runAxeWcagAA(page)).violations.map((violacao) => violacao.id)).toEqual([]);
  });
});
