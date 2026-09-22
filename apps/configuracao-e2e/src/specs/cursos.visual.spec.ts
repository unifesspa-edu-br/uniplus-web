import { expect, test, type Locator, type Page, type Route, type TestInfo } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

type VisualTheme = 'light' | 'dark' | 'contrast';

/**
 * Geometria dos dois drawers da página de Curso (issue #816). São asserções de
 * layout, não de fluxo: medem o recuo do conteúdo, o ancoramento do rodapé de
 * ações e a ausência de rolagem horizontal no piso de 320 px exigido pelo
 * e-MAG 3.1 / WCAG 2.1 AA. O contrato que elas guardam vive em
 * `apps/configuracao/src/styles.css` e é compartilhado pelo módulo inteiro.
 */

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const CURSO_ID = '01960000-0000-7000-0000-0000000000c1';

const CURSO = {
  id: CURSO_ID,
  codigo: 'ENG-CIV',
  nome: 'Engenharia Civil',
  grau: 'Bacharelado',
  nivelEnsino: 'Graduação',
  grupoAreaEnem: 'Tecnológica',
  criadoEm: '2026-06-10T12:00:00Z',
};

/**
 * A combinação mais larga do vocabulário de Oferta (UNI-REQ-0137): programa
 * `Convênio (outro)`, regime `Integral` e os dois turnos que ele exige. É ela
 * que espreme a linha de tags quando a linha não quebra.
 */
const UNIDADES = [
  ['IEDAR', 'Instituto de Estudos do Desenvolvimento Agrário e Regional'],
  ['IGE', 'Instituto de Geociências e Engenharias'],
  ['ICSA', 'Instituto de Ciências Sociais Aplicadas'],
  ['FACEEL', 'Faculdade de Engenharia Elétrica'],
] as const;

const OFERTAS = UNIDADES.map(([sigla, nome], indice) => ({
  id: `01960000-0000-7000-0000-0000000000f${indice + 1}`,
  cursoId: CURSO_ID,
  localOfertaId: '01960000-0000-7000-0000-0000000000d1',
  unidadeOfertante: {
    origemId: `01960000-0000-7000-0000-0000000000e${indice + 1}`,
    sigla,
    nome,
    tipo: 'Instituto',
  },
  programaDeOferta: 'CONVENIO_OUTRO',
  formatoPedagogico: 'PRESENCIAL',
  regimeDeTurno: 'INTEGRAL',
  turnos: ['MATUTINO', 'VESPERTINO'],
  eMecCodigo: '123456',
  codigoSga: null,
  vagasAnuaisAutorizadas: 40,
  baseLegal: null,
  atoAutorizacaoMec: null,
  criadoEm: '2026-06-10T12:00:00Z',
}));

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
  await page.route(/\/api\/configuracao\/ofertas-curso(\?.*)?$/, (route) => json(route, OFERTAS));
  await page.route(/\/api\/configuracao\/cursos(\?.*)?$/, (route) => json(route, [CURSO]));
  await page.route(/\/api\/configuracao\/admin\/cursos(\/.*)?(\?.*)?$/, (route) =>
    route.fulfill({ status: 204, headers: CORS_HEADERS }),
  );
}

interface Caixa {
  readonly x: number;
  readonly y: number;
  readonly largura: number;
  readonly altura: number;
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
    altura: box.height,
    direita: box.x + box.width,
    base: box.y + box.height,
  };
}

const RECUO = 20; // var(--space-5), o recuo do conteúdo dos drawers do módulo.
const TOLERANCIA = 1; // arredondamento de subpixel do layout.

test.describe('Curso — geometria dos drawers (#816)', () => {
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

  test('drawer de formulário: conteúdo recuado, rodapé full-bleed no fundo e rolagem interna', async ({
    page,
  }, testInfo) => {
    await page.goto('/cursos');
    await page.getByRole('button', { name: 'Novo curso' }).first().click();

    const drawer = page.getByRole('dialog', { name: 'Formulário de curso' });
    await expect(drawer).toBeVisible();
    const painel = drawer.locator('.uni-drawer__panel');
    const formulario = drawer.locator('form.cfg-form');
    const rodape = drawer.locator('.cfg-form-footer');

    // O alerta fica DENTRO do .cfg-form — é o único elemento do drawer com
    // recuo. Fora dele o conteúdo cola na borda do painel, que é o defeito
    // que a #816 relata.
    const geoPainel = await caixa(painel);
    const geoAlerta = await caixa(
      drawer.locator('ui-alert').filter({ hasText: 'Curso é a matriz curricular pura' }),
    );
    expect(Math.abs(geoAlerta.x - geoPainel.x - RECUO)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(geoPainel.direita - geoAlerta.direita - RECUO)).toBeLessThanOrEqual(TOLERANCIA);

    // O rodapé de ações é barra full-bleed ancorada no fundo do painel: tem a
    // largura toda, para o border-top atravessar, e encosta na base. Dar
    // padding ao .uni-drawer__body recua a barra e quebra as demais páginas do
    // módulo que a usam.
    const geoRodape = await caixa(rodape);
    expect(Math.abs(geoRodape.largura - geoPainel.largura)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(geoRodape.x - geoPainel.x)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(geoRodape.base - geoPainel.base)).toBeLessThanOrEqual(TOLERANCIA);

    // Quem rola é o formulário, não o body — e o rodapé fica fora da rolagem.
    const rolagem = await formulario.evaluate((el) => ({
      conteudo: el.scrollHeight,
      visivel: el.clientHeight,
      overflowY: getComputedStyle(el).overflowY,
    }));
    expect(rolagem.overflowY).toBe('auto');

    await testInfo.attach(`${testInfo.project.name}-curso-form-drawer`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    // 320 px: com o formulário obrigatoriamente rolando, o último campo e as
    // duas ações continuam alcançáveis.
    await page.setViewportSize({ width: 320, height: 640 });
    await expect(formulario).toBeVisible();
    const precisaRolar = await formulario.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(precisaRolar).toBe(true);

    await formulario.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    const geoFormulario = await caixa(formulario);
    const geoUltimoCampo = await caixa(drawer.getByText('Grupo de área do ENEM'));
    expect(geoUltimoCampo.base).toBeLessThanOrEqual(geoFormulario.base + TOLERANCIA);

    for (const nome of ['Cancelar', 'Criar curso']) {
      const geoBotao = await caixa(drawer.getByRole('button', { name: nome }));
      expect(geoBotao.base).toBeLessThanOrEqual(640 + TOLERANCIA);
      expect(geoBotao.y).toBeGreaterThanOrEqual(-TOLERANCIA);
    }

    expect(await temRolagemHorizontal(page)).toBe(false);
  });

  test('drawer de ofertas: lista alinhada ao alerta e linha de tags quebrando em 320 px', async ({
    page,
  }, testInfo) => {
    await page.goto('/cursos');
    await page.getByRole('button', { name: `Ofertas de ${CURSO.codigo}`, exact: true }).click();

    const drawer = page.getByRole('dialog', { name: 'Ofertas de curso do curso selecionado' });
    await expect(drawer).toBeVisible();
    const painel = drawer.locator('.uni-drawer__panel');
    const corpo = drawer.locator('.uni-drawer__body');

    const geoPainel = await caixa(painel);
    const geoAlerta = await caixa(
      drawer.locator('ui-alert').filter({ hasText: 'Ofertas vivas deste curso' }),
    );
    expect(Math.abs(geoAlerta.x - geoPainel.x - RECUO)).toBeLessThanOrEqual(TOLERANCIA);
    expect(Math.abs(geoPainel.direita - geoAlerta.direita - RECUO)).toBeLessThanOrEqual(TOLERANCIA);

    // A lista e o alerta são irmãos no mesmo body: alinham na mesma margem.
    const geoItem = await caixa(drawer.locator('.cfg-ofertas-list__item').first());
    expect(Math.abs(geoItem.x - geoAlerta.x)).toBeLessThanOrEqual(TOLERANCIA);

    await testInfo.attach(`${testInfo.project.name}-curso-ofertas-drawer`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

    // 320 px: a linha de tags precisa quebrar; sem wrap a largura mínima vira
    // a soma das tags e o painel ganha rolagem horizontal.
    await page.setViewportSize({ width: 320, height: 640 });
    const meta = drawer.locator('.cfg-ofertas-list__meta').first();
    const estoura = await meta.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(estoura).toBe(false);
    expect(await temRolagemHorizontal(page)).toBe(false);

    // Cada tag é uma pílula de uma linha. Sem o wrap na linha, os três itens
    // encolhem até a largura mínima e quebram por dentro — a tag passa a ter a
    // altura da linha inteira, que é o sintoma visível em 320 px.
    const alturas = await meta.evaluate((el) => ({
      linha: el.getBoundingClientRect().height,
      tags: [...el.children].map((c) => c.getBoundingClientRect().height),
    }));
    for (const altura of alturas.tags) {
      expect(altura).toBeLessThan(alturas.linha);
    }

    // Aqui não há formulário nem rodapé full-bleed, então quem rola é o body —
    // o default do design system. A asserção é de alcance, não de qual elemento
    // rola: com o painel estreito a lista transborda e a última oferta só é
    // atingível se o drawer rolar por dentro.
    const precisaRolar = await corpo.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(precisaRolar).toBe(true);
    await corpo.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    const geoCorpo = await caixa(corpo);
    const geoUltimaOferta = await caixa(drawer.locator('.cfg-ofertas-list__item').last());
    expect(geoUltimaOferta.base).toBeLessThanOrEqual(geoCorpo.base + TOLERANCIA);

    await testInfo.attach(`${testInfo.project.name}-curso-ofertas-drawer-320`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
  test('drawer de ofertas: largura acompanha a viewport entre o piso e o teto', async ({
    page,
  }) => {
    await page.goto('/cursos');
    await page.getByRole('button', { name: `Ofertas de ${CURSO.codigo}`, exact: true }).click();

    const drawer = page.getByRole('dialog', { name: 'Ofertas de curso do curso selecionado' });
    await expect(drawer).toBeVisible();
    const painel = drawer.locator('.uni-drawer__panel');

    // clamp(20rem, 55vw, 47.5rem): ocupa a tela inteira no piso de 320px,
    // acompanha a viewport no meio e para no teto de 760px.
    const larguraEm = async (viewport: number): Promise<number> => {
      await page.setViewportSize({ width: viewport, height: 720 });
      await expect(painel).toBeVisible();
      return (await caixa(painel)).largura;
    };

    expect(await larguraEm(320)).toBeCloseTo(320, 0);
    expect(await larguraEm(1024)).toBeCloseTo(1024 * 0.55, 0);
    expect(await larguraEm(1600)).toBeCloseTo(760, 0);
  });
});

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
