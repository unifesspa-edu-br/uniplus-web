import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

/**
 * Rolagem vertical do shell administrativo compartilhado (`ui-app-shell`).
 *
 * Os identificadores `CA-NN` citados nos casos abaixo são os critérios de
 * aceite da issue #666 (`bug(shared-ui): conteúdo e navegação lateral ficam
 * inacessíveis sem rolagem`).
 *
 * Contrato exercitado:
 * - a área de conteúdo (`main.page`) é o único contêiner de rolagem vertical do
 *   conteúdo; o `<body>` não rola;
 * - a navegação lateral (`aside.sidebar nav`) rola de forma independente quando
 *   seus itens excedem a altura disponível;
 * - o menu móvel (`dialog.uni-drawer`) rola até o último item sem mover o fundo;
 * - nada fica inacessível abaixo da viewport, inclusive sob viewport de baixa
 *   altura, zoom ampliado e nos três temas;
 * - não há rolagem horizontal global a partir de 320 px.
 *
 * Convenção do repo: runtime-config e API mockados por `page.route`; auth real
 * (Keycloak) via project `fluxo-chromium` (auth-setup + storageState). Viewport
 * controlada por teste — por isso `.flow.spec.ts` e não a matriz visual do DS.
 */

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

type Theme = 'light' | 'dark' | 'contrast';

/** Campi suficientes para a tabela ultrapassar qualquer viewport testada. */
const CAMPI = Array.from({ length: 40 }, (_, i) => ({
  id: `01960000-0000-7000-0000-0000000${String(i + 100).padStart(5, '0')}`,
  sigla: `CAMP${String(i + 1).padStart(2, '0')}`,
  nome: `Campus de Teste ${i + 1}`,
  codigoEmec: `${1000 + i}`,
  cidade: { nome: 'Marabá', uf: 'PA' },
  endereco: null,
}));

const ULTIMO_CAMPUS = CAMPI[CAMPI.length - 1].nome;
/** Último item do menu lateral declarado em `cfg-layout`. */
const ULTIMO_MENU = 'Calendários';

async function mockCampiApi(page: Page): Promise<void> {
  await page.route(/\/api\/configuracao\/campi(\?.*)?$/u, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS_HEADERS,
      body: JSON.stringify(CAMPI),
    });
  });
}

async function prepararTema(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript((t: Theme) => {
    window.localStorage.setItem(
      'uniplus.a11y',
      JSON.stringify({
        theme: t === 'contrast' ? 'auto' : t,
        contrast: t === 'contrast',
        fontMode: 'default',
      }),
    );
  }, theme);
}

async function irParaCampi(page: Page): Promise<void> {
  await mockConfiguracaoRuntimeConfig(page);
  await mockCampiApi(page);
  await page.goto('/campi');
  await expect(page.getByRole('heading', { name: 'Campi', level: 1 })).toBeVisible();
}

/** Métricas de rolagem das duas regiões + documento. */
async function medirRolagem(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const main = document.querySelector('main.page') as HTMLElement | null;
    const nav = document.querySelector('aside.sidebar nav') as HTMLElement | null;
    return {
      docRolaVertical: doc.scrollHeight > doc.clientHeight + 1,
      docRolaHorizontal: doc.scrollWidth > doc.clientWidth + 1,
      mainRola: !!main && main.scrollHeight > main.clientHeight + 1,
      mainOverflowY: main ? getComputedStyle(main).overflowY : null,
      navRola: !!nav && nav.scrollHeight > nav.clientHeight + 1,
      navOverflowY: nav ? getComputedStyle(nav).overflowY : null,
    };
  });
}

test.describe('Shell administrativo — rolagem vertical', () => {
  test('CA-01/CA-04: conteúdo extenso é alcançável rolando só a área principal', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await irParaCampi(page);

    const metricas = await medirRolagem(page);
    expect(metricas.mainOverflowY).toBe('auto');
    expect(metricas.mainRola).toBe(true);
    expect(metricas.docRolaVertical).toBe(false);

    const ultimaLinha = page.getByRole('row', { name: new RegExp(ULTIMO_CAMPUS) });
    await ultimaLinha.scrollIntoViewIfNeeded();
    await expect(ultimaLinha).toBeVisible();
    await expect(ultimaLinha.getByRole('button', { name: 'Editar' })).toBeInViewport();
  });

  test('CA-02/CA-03: a navegação lateral rola até o último item, independente da área principal', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 640 });
    await irParaCampi(page);

    const nav = page.locator('aside.sidebar nav');
    await expect(nav).toBeVisible();

    const antes = await medirRolagem(page);
    expect(antes.navOverflowY).toBe('auto');
    expect(antes.navRola).toBe(true);

    // Rolar o conteúdo não move a navegação.
    await page.locator('main.page').evaluate((el) => el.scrollTo({ top: 400 }));
    const navScrollTop = await nav.evaluate((el) => el.scrollTop);
    expect(navScrollTop).toBe(0);

    // Rolar a navegação até o fim revela o último item, sem mover o conteúdo.
    const conteudoAntes = await page.locator('main.page').evaluate((el) => el.scrollTop);
    await nav.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await expect(
      page.locator('aside.sidebar').getByRole('link', { name: ULTIMO_MENU }),
    ).toBeInViewport();
    const conteudoDepois = await page.locator('main.page').evaluate((el) => el.scrollTop);
    expect(conteudoDepois).toBe(conteudoAntes);
  });

  test('CA-05/CA-06: foco por teclado traz o controle para dentro da região rolável', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 720 });
    await irParaCampi(page);

    // CA-05: um controle abaixo da dobra, ao receber foco, é trazido para a viewport.
    const ultimoEditar = page
      .getByRole('row', { name: new RegExp(ULTIMO_CAMPUS) })
      .getByRole('button', { name: 'Editar' });
    await ultimoEditar.focus();
    await expect(ultimoEditar).toBeFocused();
    await expect(ultimoEditar).toBeInViewport();

    // CA-06: com a região de conteúdo em foco (`main.page` tem tabindex="-1"),
    // Home/End rolam nativamente.
    const scrollTop = () => page.locator('main.page').evaluate((el) => el.scrollTop);
    await page.locator('main.page').focus();
    await page.keyboard.press('End');
    await expect.poll(scrollTop).toBeGreaterThan(0);
    await page.keyboard.press('Home');
    await expect.poll(scrollTop).toBeLessThan(20);
  });

  test('CA-07: menu móvel alcança o último item sem rolar o conteúdo atrás', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await irParaCampi(page);

    await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Menu de navegação' });
    await expect(drawer).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/uni-drawer-open/);
    await expect(page.locator('body')).toHaveCSS('overflow-y', 'hidden');

    const item = drawer.getByRole('link', { name: ULTIMO_MENU });
    await item.scrollIntoViewIfNeeded();
    await expect(item).toBeInViewport();

    // O conteúdo por trás não rolou.
    const docScroll = await page.evaluate(() => document.documentElement.scrollTop);
    expect(docScroll).toBe(0);
  });

  test('CA-08: rolagem continua funcional sob viewport de baixa altura (proxy de zoom 200%)', async ({
    page,
  }) => {
    // 1366×768 a 200% de zoom ≈ 683×384 px de CSS.
    await page.setViewportSize({ width: 683, height: 384 });
    await irParaCampi(page);

    const metricas = await medirRolagem(page);
    expect(metricas.mainRola).toBe(true);
    expect(metricas.docRolaVertical).toBe(false);
    expect(metricas.docRolaHorizontal).toBe(false);

    const ultimaLinha = page.getByRole('row', { name: new RegExp(ULTIMO_CAMPUS) });
    await ultimaLinha.scrollIntoViewIfNeeded();
    await expect(ultimaLinha).toBeVisible();
  });

  test('CA-09/CA-10: sem rolagem horizontal global; a tabela contém a própria', async ({
    page,
  }) => {
    // 320 px: o DS empilha a tabela em cartões (`thead` oculto) — não há rolagem
    // horizontal alguma, nem global nem no componente.
    await page.setViewportSize({ width: 320, height: 568 });
    await irParaCampi(page);
    expect((await medirRolagem(page)).docRolaHorizontal).toBe(false);
    await expect(page.locator('.table-responsive thead')).toBeHidden();

    // >= 768 px: a tabela volta a ser tabela e qualquer excesso fica contido
    // nela (`overflow-x: auto` próprio), nunca vira rolagem horizontal da página.
    await page.setViewportSize({ width: 1366, height: 768 });
    await expect(page.getByRole('heading', { name: 'Campi', level: 1 })).toBeVisible();
    expect((await medirRolagem(page)).docRolaHorizontal).toBe(false);
    const tabelaOverflowX = await page
      .locator('.table-responsive')
      .evaluate((el) => getComputedStyle(el).overflowX);
    expect(tabelaOverflowX).toBe('auto');
  });

  test('CA-11: rolar o conteúdo não impede abrir/fechar o menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await irParaCampi(page);

    await page.locator('main.page').evaluate((el) => el.scrollTo({ top: 9999 }));

    const abrir = page.getByRole('button', { name: 'Abrir menu', exact: true });
    await abrir.click();
    await expect(page.getByRole('dialog', { name: 'Menu de navegação' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Menu de navegação' })).toBeHidden();
  });

  for (const theme of ['light', 'dark', 'contrast'] as const) {
    test(`CA-13: regiões roláveis preservadas no tema ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 640 });
      await prepararTema(page, theme);
      await irParaCampi(page);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

      const metricas = await medirRolagem(page);
      expect(metricas.mainRola).toBe(true);
      expect(metricas.navRola).toBe(true);
      expect(metricas.docRolaVertical).toBe(false);

      // O CA-13 da #666 pede a identificação visual da região rolável, não só
      // que ela role: o trilho é pintado em qualquer tema. `scrollbar-color`
      // é `<thumb> <track>` — um thumb transparente devolveria a região sem
      // marca alguma, que é o que este caso existe para barrar.
      const trilho = await page
        .locator('aside.sidebar nav')
        .evaluate((el) => getComputedStyle(el).scrollbarColor);
      expect(trilho).not.toBe('auto');
      expect(trilho).not.toMatch(/^(transparent\b|rgba\([^)]*,\s*0\))/u);

      const ultimaLinha = page.getByRole('row', { name: new RegExp(ULTIMO_CAMPUS) });
      await ultimaLinha.scrollIntoViewIfNeeded();
      await expect(ultimaLinha).toBeVisible();
    });
  }

  test('CA-14: sem violações axe-core na página com conteúdo e navegação roláveis', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 640 });
    await irParaCampi(page);

    const resultado = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    const graves = resultado.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(graves).toEqual([]);
  });
});
