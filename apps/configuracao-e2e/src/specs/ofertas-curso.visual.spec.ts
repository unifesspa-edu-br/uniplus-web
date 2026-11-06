import { expect, test, type Locator, type Page, type Route, type TestInfo } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

type VisualTheme = 'light' | 'dark' | 'contrast';

/**
 * Geometria do drawer de Oferta de curso e da página com ele fechado: recuo do conteúdo, rodapé
 * de ações ancorado no fundo, alcance dos campos e ausência de rolagem horizontal no piso de
 * 320 px exigido pelo e-MAG 3.1 e pela WCAG 2.1 AA. O contrato vive em
 * `apps/configuracao/src/styles.css`, compartilhado pelo módulo inteiro.
 */

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const CURSO = {
  id: '01960000-0000-7000-0000-0000000000c1',
  codigo: 'ENG-CIV',
  nome: 'Engenharia Civil',
  grau: 'Bacharelado',
  nivelEnsino: 'Graduação',
  grupoAreaEnem: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

const LOCAL = {
  id: '01960000-0000-7000-0000-0000000000e1',
  tipo: 'campusSede',
  campusResponsavelId: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  codigoEmec: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

const UNIDADE = {
  id: '01960000-0000-7000-0000-0000000000f1',
  nome: 'Instituto de Geociências e Engenharias',
  alias: null,
  slug: 'ige',
  sigla: 'IGE',
  codigo: 'IGE',
  unidadeSuperiorId: null,
  tipo: 'Instituto',
  unidadeAcademica: true,
  vigenciaInicio: '2020-01-01',
  vigenciaFim: null,
};

/** A combinação mais larga do vocabulário: programa de convênio, regime integral e os dois turnos que ele exige. */
const OFERTA = {
  id: '01960000-0000-7000-0000-0000000000d1',
  cursoId: CURSO.id,
  localOfertaId: LOCAL.id,
  unidadeOfertante: {
    origemId: UNIDADE.id,
    sigla: UNIDADE.sigla,
    nome: UNIDADE.nome,
    tipo: UNIDADE.tipo,
  },
  programaDeOferta: 'CONVENIO_OUTRO',
  formatoPedagogico: 'PRESENCIAL',
  regimeDeFuncionamento: 'INTENSIVO',
  regimeDeTurno: 'INTEGRAL',
  turnos: ['MATUTINO', 'VESPERTINO'],
  eMecCodigo: '123456',
  codigoSga: null,
  vagasAnuaisAutorizadas: 40,
  baseLegal: 'Convênio nº 004/2020',
  atoAutorizacaoMec: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

async function mockApi(page: Page): Promise<void> {
  const json = async (route: Route, body: unknown): Promise<void> => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS_HEADERS,
      body: JSON.stringify(body),
    });
  };
  await page.route(/\/api\/configuracao\/ofertas-curso(\?.*)?$/, (route) => json(route, [OFERTA]));
  await page.route(/\/api\/configuracao\/cursos(\?.*)?$/, (route) => json(route, [CURSO]));
  await page.route(/\/api\/configuracao\/locais-oferta(\?.*)?$/, (route) => json(route, [LOCAL]));
  await page.route(/\/api\/organizacao\/unidades(\?.*)?$/, (route) => json(route, [UNIDADE]));
  await page.route(/\/api\/configuracao\/admin\/ofertas-curso(\/.*)?(\?.*)?$/, (route) =>
    route.fulfill({ status: 204, headers: CORS_HEADERS }),
  );
}

interface Caixa {
  readonly x: number;
  readonly y: number;
  readonly largura: number;
  readonly direita: number;
  readonly base: number;
}

async function caixa(locator: Locator): Promise<Caixa> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Elemento sem bounding box visível — não é possível medir a geometria.');
  }
  return {
    x: box.x,
    y: box.y,
    largura: box.width,
    direita: box.x + box.width,
    base: box.y + box.height,
  };
}

/** A gaveta desliza ao abrir; a geometria só é estável depois que a animação de entrada termina. */
async function aguardarFimDaEntrada(drawer: Locator): Promise<void> {
  await drawer.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((animacao) => animacao.finished)),
  );
}

function temRolagemHorizontal(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const raiz = document.scrollingElement ?? document.documentElement;
    return raiz.scrollWidth > raiz.clientWidth + 1;
  });
}

function metadataTheme(testInfo: TestInfo): VisualTheme {
  const theme = testInfo.project.metadata['theme'];
  return theme === 'dark' || theme === 'contrast' ? theme : 'light';
}

const TOLERANCIA = 1; // arredondamento de subpixel do layout.

test.describe('Oferta de curso — geometria', () => {
  test.beforeEach(async ({ page }, testInfo) => {
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
    }, metadataTheme(testInfo));
    await mockApi(page);
  });

  test('drawer de formulário: rodapé full-bleed no fundo, rolagem interna e ações alcançáveis em 320 px', async ({
    page,
  }, testInfo) => {
    await page.goto('/ofertas-curso');
    await page.locator('#cfg-ofertas-novo').click();

    const drawer = page.getByRole('dialog', { name: 'Formulário de oferta de curso' });
    await expect(drawer).toBeVisible();
    await aguardarFimDaEntrada(drawer);
    const painel = drawer.locator('.uni-drawer__panel');
    const formulario = drawer.locator('form.form-drawer__form');
    const rodape = drawer.locator('.form-drawer__footer');

    const geoPainel = await caixa(painel);
    const geoRodape = await caixa(rodape);
    expect(Math.abs(geoRodape.largura - geoPainel.largura)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(geoRodape.x - geoPainel.x)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(geoRodape.base - geoPainel.base)).toBeLessThanOrEqual(TOLERANCIA);

    const overflowY = await formulario.evaluate((el) => getComputedStyle(el).overflowY);
    expect(overflowY).toBe('auto');

    await testInfo.attach(`${testInfo.project.name}-oferta-form-drawer`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    await page.setViewportSize({ width: 320, height: 640 });
    await expect(formulario).toBeVisible();
    const precisaRolar = await formulario.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(precisaRolar).toBe(true);

    await formulario.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    const geoFormulario = await caixa(formulario);
    const geoUltimoCampo = await caixa(
      drawer.locator('input[formcontrolname="atoAutorizacaoMec"]'),
    );
    expect(geoUltimoCampo.base).toBeLessThanOrEqual(geoFormulario.base + TOLERANCIA);

    for (const nome of ['Cancelar', 'Criar oferta']) {
      const geoBotao = await caixa(drawer.getByRole('button', { name: nome }));
      expect(geoBotao.base).toBeLessThanOrEqual(640 + TOLERANCIA);
      expect(geoBotao.x).toBeGreaterThanOrEqual(-TOLERANCIA);
    }

    expect(await temRolagemHorizontal(page)).toBe(false);
  });

  test('a lista com a oferta mais larga não gera rolagem horizontal em 320 px', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/ofertas-curso');
    await expect(page.locator('.panel table')).toBeVisible();

    expect(await temRolagemHorizontal(page)).toBe(false);
    await testInfo.attach(`${testInfo.project.name}-oferta-lista-320`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });

  test('os drawers fechados não ocupam espaço nem consomem o espaçamento entre os blocos', async ({
    page,
  }) => {
    await page.goto('/ofertas-curso');
    await expect(page.locator('.panel table')).toBeVisible();

    const pagina = page.locator('.cfg-page');
    const geoPagina = await caixa(pagina);
    const geoCabecalho = await caixa(page.locator('.page-header'));
    const geoPainel = await caixa(page.locator('.panel'));
    const espacamento = await pagina.evaluate((el) =>
      Number.parseFloat(getComputedStyle(el).rowGap),
    );

    expect(Math.abs(geoPainel.y - geoCabecalho.base - espacamento)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(geoPagina.base - geoPainel.base)).toBeLessThanOrEqual(TOLERANCIA);
  });
});
