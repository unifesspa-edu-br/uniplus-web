import { expect, test, type Page, type Route } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
  'access-control-expose-headers': 'link',
};

const PRELIMINAR_ID = '01960000-0000-7000-0000-0000000000a1';

const preliminar = {
  id: PRELIMINAR_ID,
  codigo: 'RESULTADO_PRELIMINAR_INSCRICAO',
  nome: 'Resultado preliminar da inscrição',
  congelaConfiguracao: true,
  unicoPorObjeto: false,
  efeitoIrreversivel: false,
  ehResultado: true,
  vigenciaInicio: '2026-01-01',
  vigenciaFim: null,
  baseLegal: null,
  criadoEm: '2026-08-30T12:00:00Z',
};

const encerrado = {
  ...preliminar,
  id: '01960000-0000-7000-0000-0000000000a2',
  codigo: 'AVISO',
  nome: 'Aviso',
  congelaConfiguracao: false,
  ehResultado: false,
  vigenciaFim: '2026-06-30',
};

interface Capturado {
  readonly posts: Record<string, unknown>[];
  readonly puts: Record<string, unknown>[];
  readonly chavesDeIdempotencia: string[];
  readonly vigentesRecebido: (string | null)[];
  readonly deletedIds: string[];
}

function novoCapturado(): Capturado {
  return { posts: [], puts: [], chavesDeIdempotencia: [], vigentesRecebido: [], deletedIds: [] };
}

async function preflight(route: Route): Promise<boolean> {
  if (route.request().method() !== 'OPTIONS') {
    return false;
  }
  await route.fulfill({ status: 204, headers: CORS_HEADERS });
  return true;
}

interface RespostaDeCriacao {
  readonly status: number;
  readonly body: unknown;
  readonly contentType: string;
}

const CRIADO: RespostaDeCriacao = {
  status: 201,
  body: JSON.stringify('novo-tipo-ato-id'),
  contentType: 'application/json',
};

const VIGENCIA_SOBREPOSTA: RespostaDeCriacao = {
  status: 409,
  contentType: 'application/problem+json',
  body: JSON.stringify({
    type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/uniplus.publicacoes.tipo_ato.vigencia_sobreposta',
    title: 'Vigência sobreposta',
    status: 409,
    code: 'uniplus.publicacoes.tipo_ato.vigencia_sobreposta',
    traceId: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
  }),
};

async function mockApi(
  page: Page,
  capturado: Capturado,
  lista: readonly unknown[],
  respostaDeCriacao: RespostaDeCriacao = CRIADO,
): Promise<void> {
  await page.route(/\/api\/publicacoes\/admin\/tipos-ato\/[^/?]+$/, async (route) => {
    if (await preflight(route)) return;

    const metodo = route.request().method();
    if (metodo === 'DELETE') {
      capturado.deletedIds.push(route.request().url().split('/').at(-1) ?? '');
    }
    if (metodo === 'PUT') {
      capturado.puts.push(route.request().postDataJSON());
      capturado.chavesDeIdempotencia.push(route.request().headers()['idempotency-key'] ?? '');
    }
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
  });

  await page.route(/\/api\/publicacoes\/admin\/tipos-ato(\?.*)?$/, async (route) => {
    if (await preflight(route)) return;

    capturado.posts.push(route.request().postDataJSON());
    capturado.chavesDeIdempotencia.push(route.request().headers()['idempotency-key'] ?? '');
    await route.fulfill({
      status: respostaDeCriacao.status,
      contentType: respostaDeCriacao.contentType,
      headers: CORS_HEADERS,
      body: respostaDeCriacao.body as string,
    });
  });

  await page.route(/\/api\/publicacoes\/tipos-ato(\?.*)?$/, async (route) => {
    if (await preflight(route)) return;

    const url = new URL(route.request().url());
    capturado.vigentesRecebido.push(url.searchParams.get('vigentes'));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS_HEADERS,
      body: JSON.stringify(lista),
    });
  });
}

async function abrirPagina(page: Page): Promise<void> {
  await page.goto('/tipos-ato');
  await expect(page.getByRole('heading', { name: 'Tipo de Ato', level: 1 })).toBeVisible();
}

async function preencherCadastro(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Cadastrar tipo de ato' }).first().click();
  await page.locator('[formControlName="codigo"]').fill('RESULTADO_PRELIMINAR_INSCRICAO');
  await page.locator('[formControlName="nome"]').fill('Resultado preliminar da inscrição');
  await page.locator('[formControlName="vigenciaInicio"]').fill('2026-01-01');
  // O input do checkbox do design system é visualmente oculto; quem recebe o
  // clique é o rótulo.
  const determinaSituacao = page.getByRole('checkbox', {
    name: 'Determina a situação do candidato',
  });
  await page.getByText('Determina a situação do candidato').click();
  await expect(determinaSituacao).toBeChecked();
}

test.describe('Tipo de ato — cadastro pela interface', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('a listagem mostra, por linha, se o ato determina a situação do candidato', async ({
    page,
  }) => {
    await mockApi(page, novoCapturado(), [preliminar, encerrado]);
    await abrirPagina(page);

    const linhaPreliminar = page.getByRole('row', { name: /RESULTADO_PRELIMINAR_INSCRICAO/ });
    await expect(linhaPreliminar.locator('[data-label="Resultado"]')).toHaveText('Sim');

    const linhaAviso = page.getByRole('row', { name: /AVISO/ });
    await expect(linhaAviso.locator('[data-label="Resultado"]')).toHaveText('Não');
  });

  test('cadastra um tipo de ato com Idempotency-Key e código em maiúsculas', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [preliminar]);
    await abrirPagina(page);

    await preencherCadastro(page);
    await page.getByRole('button', { name: 'Salvar tipo de ato' }).click();

    await expect.poll(() => capturado.posts.length).toBe(1);
    expect(capturado.posts[0]).toMatchObject({
      codigo: 'RESULTADO_PRELIMINAR_INSCRICAO',
      ehResultado: true,
      vigenciaInicio: '2026-01-01',
      vigenciaFim: null,
    });
    expect(capturado.chavesDeIdempotencia[0]).toBeTruthy();
  });

  test('o código é imutável na edição e o PUT não carrega Idempotency-Key', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [preliminar]);
    await abrirPagina(page);

    await page
      .getByRole('button', {
        name: `Editar tipo de ato ${preliminar.codigo}, vigência iniciada em 01/01/2026`,
        exact: true,
      })
      .click();

    const codigoInput = page.locator('[formControlName="codigo"]');
    await expect(codigoInput).toHaveAttribute('readonly', '');
    await expect(codigoInput).toHaveValue(preliminar.codigo);

    await page.locator('[formControlName="nome"]').fill('Resultado preliminar das inscrições');
    await page.getByRole('button', { name: 'Salvar tipo de ato' }).click();

    await expect.poll(() => capturado.puts.length).toBe(1);
    expect(capturado.puts[0]).toMatchObject({
      id: PRELIMINAR_ID,
      codigo: preliminar.codigo,
      nome: 'Resultado preliminar das inscrições',
    });
    expect(capturado.chavesDeIdempotencia[0]).toBe('');
  });

  test('a listagem abre na série completa e o filtro restringe às em vigor', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [preliminar, encerrado]);
    await abrirPagina(page);

    // A listagem inicial é assíncrona: esperar o interceptador registrá-la antes
    // de ler o que ela mandou, senão o array ainda está vazio quando o h1 aparece.
    await expect.poll(() => capturado.vigentesRecebido[0]).toBe('false');

    await page.getByText('Mostrar apenas as vigências em vigor hoje').click();

    await expect.poll(() => capturado.vigentesRecebido.at(-1)).toBe('true');
  });

  test('a sobreposição de vigência diz o que fazer e mantém o formulário aberto', async ({
    page,
  }) => {
    await mockApi(page, novoCapturado(), [preliminar], VIGENCIA_SOBREPOSTA);
    await abrirPagina(page);

    await preencherCadastro(page);
    await page.getByRole('button', { name: 'Salvar tipo de ato' }).click();

    await expect(
      page.getByText('Encerre a anterior ou escolha outro início', { exact: false }),
    ).toBeVisible();
    await expect(page.locator('[formControlName="codigo"]')).toBeVisible();
  });

  test('remove uma vigência após confirmação', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [preliminar]);
    await abrirPagina(page);

    await page
      .getByRole('button', {
        name: `Remover vigência do tipo de ato ${preliminar.codigo}, vigência iniciada em 01/01/2026`,
        exact: true,
      })
      .click();
    await page.locator('dialog.uni-dialog').getByRole('button', { name: 'Remover' }).click();

    await expect.poll(() => capturado.deletedIds).toEqual([PRELIMINAR_ID]);
  });
});
