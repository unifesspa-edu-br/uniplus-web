import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirFiltros } from '../support/filtros';
import {
  attachScreenshot,
  metadataTheme,
  metadataViewport,
  prepararTelaDeUnidades,
  type VisualViewport,
} from '../support/visual-das-unidades';

test.describe('Unidade — cobertura visual DS', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await prepararTelaDeUnidades(page, testInfo);
  });

  test('layout principal, menus, filtro, árvore e tema permanecem aderentes ao DS', async ({
    page,
  }, testInfo) => {
    const theme = metadataTheme(testInfo);
    const viewport = metadataViewport(testInfo);

    await page.goto('/unidades');

    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    await expect(page.getByRole('heading', { name: 'Unidades', level: 1 })).toBeVisible();

    await expect(page.locator('.admin-topbar')).toBeVisible();

    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();

    await expect(page.getByRole('search', { name: 'Filtrar unidades' })).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Unidades', level: 2 })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Nova unidade', exact: true })).toBeVisible();

    const tree = page.locator('.unit-tree');

    await expect(tree).toBeVisible();

    await expect(
      tree.getByRole('button', { name: 'Editar unidade REITORIA', exact: true }),
    ).toBeVisible();

    await expect(
      tree.getByRole('button', { name: 'Remover unidade REITORIA', exact: true }),
    ).toBeVisible();

    // A árvore começa recolhida. Expande a raiz para validar os descendentes.
    const toggleRaiz = tree.locator('> .unit-node > .unit-node__row .unit-node__toggle');

    await expect(toggleRaiz).toBeVisible();

    await toggleRaiz.click();

    await expect(
      tree.getByRole('button', { name: 'Editar unidade PROEG', exact: true }),
    ).toBeVisible();

    await expect(
      tree.getByRole('button', { name: 'Remover unidade PROEG', exact: true }),
    ).toBeVisible();

    await expect(
      tree.getByRole('button', {
        name: 'Editar unidade CTIC',
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      tree.getByRole('button', {
        name: 'Remover unidade CTIC',
        exact: true,
      }),
    ).toBeVisible();

    // Busca e filtro por tipo operam sobre a árvore (CA-18). O resultado de uma
    // busca precisa ficar visível mesmo estando dentro de ramo recolhido (CA-19):
    // ninguém clica em toggle aqui.
    await page.getByRole('searchbox', { name: 'Buscar unidade' }).fill('ceps');

    await expect(tree.getByText('Centro de Processos Seletivos')).toBeVisible();
    await expect(tree.getByText('Centro de Tecnologia da Informação e Comunicação')).toBeHidden();

    await page.getByRole('button', { name: 'Limpar', exact: true }).click();

    await abrirFiltros(page);
    await page.getByRole('button', { name: 'Centro', exact: true }).click();

    await expect(tree.getByText('Centro de Processos Seletivos')).toBeVisible();
    await expect(tree.getByText('Centro de Tecnologia da Informação e Comunicação')).toBeVisible();
    await expect(tree.getByText('Pró-Reitoria de Ensino de Graduação')).toBeHidden();

    await page.getByRole('button', { name: 'Limpar', exact: true }).click();

    const nodeProeg = tree
      .locator('.unit-node')
      .filter({
        has: page.getByRole('button', {
          name: 'Editar unidade PROEG',
          exact: true,
        }),
      })
      .last();

    const toggleProeg = nodeProeg.locator('.unit-node__toggle');

    await expect(toggleProeg).toBeVisible();

    await toggleProeg.click();

    await expect(
      tree.getByRole('button', { name: 'Editar unidade CEPS', exact: true }),
    ).toBeVisible();

    await expect(
      tree.getByRole('button', { name: 'Remover unidade CEPS', exact: true }),
    ).toBeVisible();

    await assertNoHorizontalOverflow(page);
    await assertSidebarBehavior(page, viewport);
    await assertClickableHeaderMenus(page, viewport);

    await attachScreenshot(page, testInfo, 'unidades-lista');
  });

  test('os drawers e diálogos fechados não ocupam espaço nem consomem o espaçamento entre os blocos', async ({
    page,
  }) => {
    await page.goto('/unidades');
    await expect(page.locator('.unit-tree')).toBeVisible();

    const medir = (seletor: string) =>
      page
        .locator(seletor)
        .first()
        .evaluate((el) => {
          const caixa = el.getBoundingClientRect();
          return { topo: caixa.top, base: caixa.bottom };
        });
    const geoPagina = await medir('cfg-unidades-page');
    const geoAlerta = await medir('cfg-unidades-page > ui-alert');
    const geoLista = await medir('cfg-unidades-lista');
    const espacamento = await page
      .locator('cfg-unidades-page')
      .evaluate((el) => Number.parseFloat(getComputedStyle(el).rowGap));

    // Cabeçalho, alerta e lista são os blocos em fluxo: a lista começa um espaçamento abaixo do
    // alerta e a página termina nela. Drawer ou diálogo fechado que virasse item do flex
    // acrescentaria um espaçamento morto no fim da página.
    expect(Math.abs(geoLista.topo - geoAlerta.base - espacamento)).toBeLessThanOrEqual(1);
    expect(Math.abs(geoPagina.base - geoLista.base)).toBeLessThanOrEqual(1);
  });
});

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
}

async function assertSidebarBehavior(page: Page, viewport: VisualViewport): Promise<void> {
  const sidebar = page.locator('aside[aria-label="Painel administrativo"]');
  const drawer = page.locator('dialog.uni-drawer[open]');

  if (viewport === 'desktop') {
    const toggle = page.getByRole('button', { name: 'Recolher menu lateral', exact: true });
    await expect(sidebar).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await assertSidebarGroups(sidebar);
    await expect(sidebar.getByRole('link', { name: 'Unidade' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const expandedBox = await sidebar.boundingBox();
    expect(expandedBox?.width ?? 0).toBeGreaterThan(200);

    await toggle.click();
    await expect(sidebar).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Expandir menu lateral', exact: true }),
    ).toHaveAttribute('aria-expanded', 'false');
    const collapsedBox = await sidebar.boundingBox();
    expect(collapsedBox?.width ?? 0).toBeLessThanOrEqual(96);
    await assertNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'Expandir menu lateral', exact: true }).click();
    await expect(sidebar).toBeVisible();

    await sidebar.evaluate((node) => node.querySelector('nav')?.scrollTo({ top: 10_000 }));
    await expect(sidebar.getByText('Peso por Área')).toBeVisible();
  } else {
    await expect(page.getByRole('dialog', { name: 'Menu de navegação' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
    await expect(drawer).toBeVisible();
    await assertSidebarGroups(drawer);
    await drawer.getByRole('link', { name: 'Unidade' }).click();
    await expect(page.getByRole('dialog', { name: 'Menu de navegação' })).toHaveCount(0);
  }
}

async function assertSidebarGroups(container: Locator): Promise<void> {
  const nav = container.getByRole('navigation', { name: 'Navegação principal' });
  await expect(nav.getByText('Configuração', { exact: true })).toBeVisible();
}

async function assertClickableHeaderMenus(page: Page, viewport: VisualViewport): Promise<void> {
  await page.getByRole('button', { name: 'Preferências de acessibilidade' }).click();
  await expect(page.getByRole('region', { name: 'Preferências de acessibilidade' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Claro' })).toBeVisible();
  await page.keyboard.press('Escape');

  const accountMenu = page.getByRole('button', { name: /Abrir menu da conta de / });
  if (viewport === 'desktop') {
    const userHeader = page.locator('auth-user-header-info');
    await expect(userHeader.getByTestId('auth-user-display-name')).toHaveText('Admin');
    // Inicial pintada em ::before (ver shared-ui/styles/components.css) —
    // SC 2.5.3. Confere o atributo e o que a tela mostra: só o atributo
    // deixaria passar a remoção da regra CSS.
    const avatar = userHeader.locator('.user-chip__avatar');
    await expect(avatar).toHaveAttribute('data-initials', 'A');
    await expect
      .poll(() => avatar.evaluate((el) => getComputedStyle(el, '::before').content))
      .toContain('A');
    await expect(
      userHeader.getByRole('button', { name: 'Abrir menu da conta de Admin Teste' }),
    ).toBeVisible();
    await accountMenu.click();
    await expect(page.getByRole('menuitem', { name: 'Sair' })).toBeVisible();
    await page.keyboard.press('Escape');
  } else {
    await expect(accountMenu).toHaveAttribute('aria-expanded', 'false');
  }

  await page.getByRole('link', { name: 'Início' }).click();
  await expect(page).toHaveURL(/\/unidades$/);
}
