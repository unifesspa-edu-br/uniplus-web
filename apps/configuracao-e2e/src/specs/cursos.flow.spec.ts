import { expect, test, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * E2E funcional do cadastro de Curso (issue #389). Convenção do repo:
 * runtime-config e API mockados por `page.route`; autenticação real (Keycloak)
 * via projeto `fluxo-chromium` (auth-setup + storageState).
 */

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const CURSO_ID = '01960000-0000-7000-0000-0000000000c1';

const cursoSeed = {
  id: CURSO_ID,
  codigo: 'ENG-CIV',
  nome: 'Engenharia Civil',
  grau: 'Bacharelado',
  nivelEnsino: 'Graduação',
  grupoAreaEnem: 'Tecnológica',
  criadoEm: '2026-06-10T12:00:00Z',
};

const ofertaSeed = {
  id: '01960000-0000-7000-0000-0000000000f1',
  cursoId: CURSO_ID,
  localOfertaId: '01960000-0000-7000-0000-0000000000d1',
  unidadeOfertante: {
    origemId: '01960000-0000-7000-0000-0000000000e1',
    sigla: 'IGE',
    nome: 'Instituto de Geociências e Engenharias',
    tipo: 'Instituto',
  },
  programaDeOferta: 'REGULAR',
  formatoPedagogico: 'PRESENCIAL',
  turno: 'MATUTINO',
  eMecCodigo: '123456',
  codigoSga: null,
  vagasAnuaisAutorizadas: 40,
  baseLegal: null,
  atoAutorizacaoMec: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

async function jsonRoute(route: Route, body: unknown, status = 200): Promise<void> {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
    return;
  }
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  });
}

interface Capturado {
  readonly posts: unknown[];
  readonly deletedIds: string[];
  readonly ofertaCursoIds: string[];
}

function novoCapturado(): Capturado {
  return { posts: [], deletedIds: [], ofertaCursoIds: [] };
}

async function mockApi(
  page: Page,
  capturado: Capturado,
  lista: readonly unknown[],
  opcoes: {
    readonly criarStatus?: number;
    readonly criarBody?: unknown;
    readonly deleteStatus?: number;
    readonly deleteBody?: unknown;
    readonly ofertas?: readonly unknown[];
  } = {},
): Promise<void> {
  await page.route(/\/api\/configuracao\/admin\/cursos\/[^/?]+$/, async (route) => {
    if (route.request().method() === 'DELETE') {
      const partes = route.request().url().split('/');
      capturado.deletedIds.push(partes[partes.length - 1] ?? '');
      await route.fulfill({
        status: opcoes.deleteStatus ?? 204,
        contentType: opcoes.deleteBody ? 'application/problem+json' : undefined,
        headers: CORS_HEADERS,
        body: opcoes.deleteBody ? JSON.stringify(opcoes.deleteBody) : undefined,
      });
      return;
    }
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
  });
  await page.route(/\/api\/configuracao\/admin\/cursos(\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      capturado.posts.push(route.request().postDataJSON());
      const status = opcoes.criarStatus ?? 201;
      await route.fulfill({
        status,
        contentType: status >= 400 ? 'application/problem+json' : 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify(opcoes.criarBody ?? 'novo-curso-id'),
      });
      return;
    }
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
  });
  await page.route(/\/api\/configuracao\/ofertas-curso(\?.*)?$/, async (route) => {
    const cursoId = new URL(route.request().url()).searchParams.get('cursoId');
    if (cursoId !== null) {
      capturado.ofertaCursoIds.push(cursoId);
    }
    await jsonRoute(route, opcoes.ofertas ?? []);
  });
  await page.route(/\/api\/configuracao\/cursos(\?.*)?$/, (route) => jsonRoute(route, lista));
}

async function abrirPagina(page: Page): Promise<void> {
  await page.goto('/cursos');
  await expect(page.getByRole('heading', { name: 'Curso', level: 1 })).toBeVisible();
}

test.describe('Curso — CRUD (#389)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('CA-01: lista cursos vivos', async ({ page }) => {
    await mockApi(page, novoCapturado(), [cursoSeed]);
    await abrirPagina(page);

    await expect(page.getByText('ENG-CIV')).toBeVisible();
    await expect(page.getByText('Engenharia Civil')).toBeVisible();
  });

  test('CA-02: cria curso com código único, nome, grau e nível válidos', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, []);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Novo curso' }).first().click();
    await page.locator('[formControlName="codigo"]').fill('ADM');
    await page.locator('[formControlName="nome"]').fill('Administração');
    await page.locator('[formControlName="grau"]').fill('Bacharelado');
    await page.locator('[formControlName="nivelEnsino"]').fill('Graduação');
    await page.getByRole('button', { name: 'Criar curso' }).click();

    await expect.poll(() => capturado.posts.length).toBe(1);
    expect(capturado.posts[0]).toMatchObject({ codigo: 'ADM', nome: 'Administração' });
  });

  test('CA-03: código duplicado (409) é rejeitado com erro inline sem fechar o drawer', async ({
    page,
  }) => {
    await mockApi(page, novoCapturado(), [], {
      criarStatus: 409,
      criarBody: {
        type: 'https://uniplus.dev/erros/uniplus.configuracao.curso.codigo_ja_existe',
        title: 'Já existe um curso ativo com este código',
        status: 409,
        code: 'uniplus.configuracao.curso.codigo_ja_existe',
      },
    });
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Novo curso' }).first().click();
    await page.locator('[formControlName="codigo"]').fill('ENG-CIV');
    await page.locator('[formControlName="nome"]').fill('Engenharia Civil (dup)');
    await page.locator('[formControlName="grau"]').fill('Bacharelado');
    await page.locator('[formControlName="nivelEnsino"]').fill('Graduação');
    await page.getByRole('button', { name: 'Criar curso' }).click();

    await expect(page.getByText('Já existe um curso ativo com este código')).toBeVisible();
    await expect(page.locator('#cfg-curso-form')).toBeVisible();
  });

  test('CA-08/#435: remoção bloqueada (409) abre o drawer de Ofertas com o preview do bloqueio', async ({
    page,
  }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [cursoSeed], {
      deleteStatus: 409,
      deleteBody: {
        type: 'https://uniplus.dev/erros/uniplus.configuracao.curso.remocao_bloqueada_por_oferta_curso',
        title: 'Não é possível remover um curso referenciado por uma oferta de curso ativa',
        status: 409,
        code: 'uniplus.configuracao.curso.remocao_bloqueada_por_oferta_curso',
      },
      ofertas: [ofertaSeed],
    });
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Remover' }).first().click();
    const confirm = page.locator('dialog.uni-dialog');
    await confirm.getByRole('button', { name: 'Remover' }).click();

    // Em vez de reabrir o confirm, o fluxo abre o drawer de Ofertas com a
    // mensagem que a API retornou e lista a oferta que bloqueia a remoção — o
    // operador vê exatamente o que impede a exclusão (#435, CA2).
    const drawer = page.locator('dialog.uni-drawer');
    await expect(drawer.getByRole('heading', { name: 'Ofertas de ENG-CIV' })).toBeVisible();
    await expect(drawer.getByText('Remoção bloqueada')).toBeVisible();
    await expect(
      drawer.getByText('Não é possível remover um curso referenciado por uma oferta de curso ativa'),
    ).toBeVisible();
    await expect(drawer.getByText('Instituto de Geociências e Engenharias')).toBeVisible();
    await expect.poll(() => capturado.ofertaCursoIds).toContain(CURSO_ID);
  });

  test('#435: ação "Ofertas" abre o drawer e lista as ofertas vivas do curso via cursoId', async ({
    page,
  }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [cursoSeed], { ofertas: [ofertaSeed] });
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Ofertas' }).first().click();

    const drawer = page.locator('dialog.uni-drawer');
    await expect(drawer.getByRole('heading', { name: 'Ofertas de ENG-CIV' })).toBeVisible();
    await expect(drawer.getByText('Instituto de Geociências e Engenharias')).toBeVisible();
    await expect.poll(() => capturado.ofertaCursoIds).toContain(CURSO_ID);
  });

  test('remove um curso sem oferta viva após confirmação', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [cursoSeed]);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Remover' }).first().click();
    await page
      .locator('dialog.uni-dialog')
      .getByRole('button', { name: 'Remover' })
      .click();

    await expect.poll(() => capturado.deletedIds.length).toBe(1);
    expect(capturado.deletedIds[0]).toBe(CURSO_ID);
  });
});
