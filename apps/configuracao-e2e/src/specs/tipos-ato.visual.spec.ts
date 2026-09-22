import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { assertReflowContract, runAxeWcagAA } from '@uniplus/shared-e2e';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

type VisualTheme = 'light' | 'dark' | 'contrast';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
  'access-control-expose-headers': 'link',
};

// Com `rel="next"` a página monta o `ui-pager`; sem isso o componente não entra
// no DOM e escapa da varredura.
const LINK_HEADER = '</api/publicacoes/tipos-ato?cursor=PROXIMA&direction=next>; rel="next"';

const TIPOS_ATO = [
  {
    id: '01960000-0000-7000-0000-0000000000a1',
    codigo: 'RESULTADO_PRELIMINAR_INSCRICAO',
    nome: 'Resultado preliminar da inscrição',
    congelaConfiguracao: true,
    unicoPorObjeto: false,
    efeitoIrreversivel: false,
    ehResultado: true,
    vigenciaInicio: '2026-01-01',
    vigenciaFim: null,
    baseLegal: 'Lei 12.711/2012',
    criadoEm: '2026-08-30T12:00:00Z',
  },
  {
    id: '01960000-0000-7000-0000-0000000000a2',
    codigo: 'AVISO',
    nome: 'Aviso',
    congelaConfiguracao: false,
    unicoPorObjeto: false,
    efeitoIrreversivel: false,
    ehResultado: false,
    vigenciaInicio: '2026-01-01',
    vigenciaFim: '2026-06-30',
    baseLegal: null,
    criadoEm: '2026-08-30T12:00:00Z',
  },
] as const;

test.describe('Tipo de ato — lista e formulário', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const theme = metadataTheme(testInfo);
    await mockConfiguracaoRuntimeConfig(page);
    await page.addInitScript((dsTheme: VisualTheme) => {
      window.localStorage.setItem(
        'uniplus.a11y',
        JSON.stringify({
          theme: dsTheme === 'contrast' ? 'auto' : dsTheme,
          contrast: dsTheme === 'contrast',
          fontMode: 'default',
        }),
      );
    }, theme);
    await mockTiposAtoApi(page);

    await page.goto('/tipos-ato');
    // Varredura sobre conjunto vazio aprova: as ações de linha e o pager só
    // existem no DOM com a tabela renderizada.
    await expect(page.locator('table tbody tr')).toHaveCount(TIPOS_ATO.length);
    await expect(page.getByRole('navigation', { name: /Paginação/ })).toBeVisible();
  });

  test('aplica o tema selecionado e lista o catálogo', async ({ page }, testInfo) => {
    await expect(page.locator('html')).toHaveAttribute('data-theme', metadataTheme(testInfo));
    await expect(page.getByRole('heading', { name: 'Tipo de Ato', level: 1 })).toBeVisible();
  });

  test('a lista não viola WCAG 2.1 A/AA', async ({ page }) => {
    const { violations } = await runAxeWcagAA(page);

    expect(
      violations.map((violacao) => violacao.id),
      JSON.stringify(violations, null, 2),
    ).toEqual([]);
  });

  test('o formulário não viola WCAG 2.1 A/AA', async ({ page }) => {
    await page.getByRole('button', { name: 'Cadastrar tipo de ato' }).first().click();
    await expect(page.locator('[formControlName="codigo"]')).toBeVisible();

    const { violations } = await runAxeWcagAA(page);

    expect(
      violations.map((violacao) => violacao.id),
      JSON.stringify(violations, null, 2),
    ).toEqual([]);
  });

  // O contrato da gaveta do módulo: a rolagem é do formulário, e o rodapé fica
  // fora dele para não rolar junto com os campos.
  test('a gaveta rola pelo formulário e mantém o rodapé fixo', async ({ page }) => {
    await page.getByRole('button', { name: 'Cadastrar tipo de ato' }).first().click();

    const formulario = page.locator('form.cfg-form');
    await expect(formulario).toBeVisible();
    await expect(formulario).toHaveCSS('overflow-y', 'auto');

    const rodape = page.locator('.cfg-form-footer');
    await expect(rodape).toBeVisible();
    await expect(formulario.locator('.cfg-form-footer')).toHaveCount(0);
    await expect(rodape.getByRole('button', { name: 'Salvar tipo de ato' })).toBeVisible();
  });

  test('a página cumpre o contrato de reflow do viewport', async ({ page }) => {
    await assertReflowContract(page);
  });
});

async function mockTiposAtoApi(page: Page): Promise<void> {
  await page.route(/\/api\/publicacoes\/tipos-ato(\?.*)?$/, async (route, request) => {
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    if (request.method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json', link: LINK_HEADER },
      body: JSON.stringify(TIPOS_ATO),
    });
  });
}

function metadataTheme(testInfo: TestInfo): VisualTheme {
  const theme = testInfo.project.metadata['theme'];
  return theme === 'dark' || theme === 'contrast' ? theme : 'light';
}
