import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

type VisualTheme = 'light' | 'dark' | 'contrast';
type VisualViewport = 'mobile' | 'desktop';

const UNIDADES = [
  {
    id: '01960000-0000-7000-0000-000000000001',
    nome: 'Reitoria',
    alias: null,
    slug: 'reitoria',
    sigla: 'REITORIA',
    codigo: 'REITORIA',
    unidadeSuperiorId: null,
    tipo: 'Reitoria',
    unidadeAcademica: false,
    vigenciaInicio: '2026-01-01',
    vigenciaFim: null,
    criadoEm: '2026-06-10T12:00:00Z',
  },
  {
    id: '01960000-0000-7000-0000-000000000002',
    nome: 'Pró-Reitoria de Ensino de Graduação',
    alias: 'PROEG',
    slug: 'proeg',
    sigla: 'PROEG',
    codigo: 'PROEG',
    unidadeSuperiorId: '01960000-0000-7000-0000-000000000001',
    tipo: 'Pro-Reitoria',
    unidadeAcademica: false,
    vigenciaInicio: '2026-01-01',
    vigenciaFim: null,
    criadoEm: '2026-06-10T12:01:00Z',
  },
  {
    id: '01960000-0000-7000-0000-000000000003',
    nome: 'Centro de Processos Seletivos',
    alias: 'CEPS',
    slug: 'ceps',
    sigla: 'CEPS',
    codigo: 'CEPS',
    unidadeSuperiorId: '01960000-0000-7000-0000-000000000002',
    tipo: 'Centro',
    unidadeAcademica: false,
    vigenciaInicio: '2026-01-01',
    vigenciaFim: null,
    criadoEm: '2026-06-10T12:02:00Z',
  },
  {
    id: '01960000-0000-7000-0000-000000000004',
    nome: 'Centro de Tecnologia da Informação e Comunicação',
    alias: 'CTIC',
    slug: 'ctic',
    sigla: 'CTIC',
    codigo: 'CTIC',
    unidadeSuperiorId: '01960000-0000-7000-0000-000000000001',
    tipo: 'Centro',
    unidadeAcademica: false,
    vigenciaInicio: '2026-01-01',
    vigenciaFim: null,
    criadoEm: '2026-06-10T12:03:00Z',
  },
] as const;

test.describe('Unidade — cobertura visual DS', () => {
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

    await mockUnidadesApi(page);
  });

  test('layout principal, menus, filtro, árvore e tema permanecem aderentes ao DS', async ({
    page,
  }, testInfo) => {
    const theme = metadataTheme(testInfo);
    const viewport = metadataViewport(testInfo);

    await page.goto('/unidades');

    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

    await expect(page.getByRole('heading', { name: 'Unidades', level: 1 })).toBeVisible();

    await expect(page.getByRole('region', { name: 'Identificação institucional' })).toBeVisible();

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
      tree.getByRole('button', { name: 'Editar unidade PROEG', exact: true }),).toBeVisible();

    await expect(
      tree.getByRole('button', { name: 'Remover unidade PROEG', exact: true }),).toBeVisible();

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

  test('botão Remover da árvore não tem fundo vermelho permanente, em nenhum nível, tema ou estado de interação (#815)', async ({
    page,
  }) => {
    await page.goto('/unidades');

    const tree = page.locator('.unit-tree');
    await expect(tree).toBeVisible();

    // Expande até o 3º nível (REITORIA → PROEG → CEPS) para cobrir CA-03.
    await tree.locator('> .unit-node > .unit-node__row .unit-node__toggle').click();
    const nodeProeg = tree
      .locator('.unit-node')
      .filter({ has: page.getByRole('button', { name: 'Editar unidade PROEG', exact: true }) })
      .last();
    await nodeProeg.locator('.unit-node__toggle').click();

    const removerReitoria = tree.getByRole('button', {
      name: 'Remover unidade REITORIA',
      exact: true,
    });
    const editarReitoria = tree.getByRole('button', {
      name: 'Editar unidade REITORIA',
      exact: true,
    });
    const removerCeps = tree.getByRole('button', { name: 'Remover unidade CEPS', exact: true });

    // CA-01/CA-03 — repouso, em todos os níveis: o fundo do Remover é igual
    // ao do Editar (ambos `btn--tertiary`), nunca a cor sólida de danger.
    const bgRepousoReitoria = await removerReitoria.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(bgRepousoReitoria).toBe(
      await editarReitoria.evaluate((el) => getComputedStyle(el).backgroundColor),
    );

    const bgRepousoCeps = await removerCeps.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bgRepousoCeps).toBe(bgRepousoReitoria);

    // CA-08 — foco por teclado: chega ao botão via Tab real e o foco fica
    // visível (o mesmo `outline` global do DS, não uma borda vermelha
    // específica). Precisa rodar ANTES de qualquer mousedown neste botão —
    // o Chromium suprime `:focus-visible` num elemento que acabou de
    // receber um clique de mouse, então testar isso depois do "pressed"
    // abaixo daria falso negativo.
    await editarReitoria.focus();
    await page.keyboard.press('Tab');
    await expect(removerReitoria).toBeFocused();
    const outlineRemover = await removerReitoria.evaluate(
      (el) => getComputedStyle(el).outlineStyle,
    );
    expect(outlineRemover).not.toBe('none');

    // CA-05 — hover: o Remover tinge exatamente como o Editar (tom do
    // `tertiary`), não um vermelho.
    await removerReitoria.hover();
    await aguardarFundoAssentar(removerReitoria);
    const bgHoverRemover = await removerReitoria.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    await editarReitoria.hover();
    await aguardarFundoAssentar(editarReitoria);
    const bgHoverEditar = await editarReitoria.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(bgHoverRemover).toBe(bgHoverEditar);
    expect(bgHoverRemover).not.toBe(bgRepousoReitoria);

    // CA-05 — pressed: mesmo comportamento do Editar ao segurar o clique.
    // `down` → lê o estilo → `move` para fora ANTES do `up`: solta o clique
    // longe do botão, então nenhum dos dois dispara a ação real (abrir o
    // dialog de confirmação de Remover interceptaria os eventos seguintes
    // destinados ao Editar).
    const centroRemover = await centroDoElemento(removerReitoria);
    await page.mouse.move(centroRemover.x, centroRemover.y);
    await page.mouse.down();
    await aguardarFundoAssentar(removerReitoria);
    const bgPressedRemover = await removerReitoria.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    await page.mouse.move(centroRemover.x - 50, centroRemover.y - 50);
    await page.mouse.up();

    const centroEditar = await centroDoElemento(editarReitoria);
    await page.mouse.move(centroEditar.x, centroEditar.y);
    await page.mouse.down();
    await aguardarFundoAssentar(editarReitoria);
    const bgPressedEditar = await editarReitoria.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    await page.mouse.move(centroEditar.x - 50, centroEditar.y - 50);
    await page.mouse.up();

    expect(bgPressedRemover).toBe(bgPressedEditar);

    // CA-05 — disabled: `recarregandoLista()` (unidades.page.ts:810) fica
    // true durante o refetch da lista que segue uma remoção bem-sucedida —
    // não durante o DELETE em si. Resolve o DELETE na hora e atrasa só o GET
    // de recarregamento, para capturar a janela em que a ação fica desabilitada.
    await page.route(/\/api\/organizacao\/admin\/unidades\/.*/, async (route) => {
      await route.fulfill({ status: 204 });
    });
    await page.route(/\/api\/organizacao\/unidades(\?.*)?$/, async (route, request) => {
      if (request.method() !== 'GET') {
        await route.continue();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(UNIDADES),
      });
    });
    await removerReitoria.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Remover', exact: true }).click();
    await expect(removerReitoria).toBeDisabled();
    await expect(editarReitoria).toBeDisabled();
  });

  test('drawer de cadastro preserva footer, rolagem única e grid responsivo', async ({
    page,
  }, testInfo) => {
    const viewport = metadataViewport(testInfo);

    await page.goto('/unidades');
    await page.getByRole('button', { name: 'Nova unidade' }).click();

    const drawer = page.locator('dialog.uni-drawer').filter({ hasText: 'Nova unidade' });
    await expect(drawer).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/uni-drawer-open/);
    await expect(drawer.getByRole('heading', { name: 'Nova unidade' })).toBeVisible();
    await expect(drawer.getByText('Identificadores')).toBeVisible();
    await expect(drawer.getByText('Classificação e hierarquia')).toBeVisible();
    await expect(drawer.getByText('Vigência', { exact: true })).toBeVisible();

    const footer = drawer.locator('.cfg-form-footer');
    await expect(footer.getByRole('button', { name: 'Cancelar' })).toBeVisible();
    await expect(footer.getByRole('button', { name: 'Criar unidade' })).toBeVisible();

    const drawerMetrics = await drawer.locator('.uni-drawer__panel').evaluate((panel) => {
      const body = panel.querySelector('.uni-drawer__body') as HTMLElement;
      const form = panel.querySelector('.cfg-form') as HTMLElement;
      const grid = panel.querySelector('.form-grid') as HTMLElement;
      const footer = panel.querySelector('.cfg-form-footer') as HTMLElement;
      const panelRect = panel.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      return {
        bodyOverflowY: getComputedStyle(body).overflowY,
        formOverflowY: getComputedStyle(form).overflowY,
        formScrolls: form.scrollHeight > form.clientHeight,
        bodyOverflow: getComputedStyle(document.body).overflow,
        gridColumns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        panelWidth: panelRect.width,
        footerInsideViewport: footerRect.bottom <= window.innerHeight + 1,
      };
    });

    expect(drawerMetrics.bodyOverflowY).toBe('hidden');
    expect(drawerMetrics.formOverflowY).toBe('auto');
    expect(drawerMetrics.formScrolls).toBe(true);
    expect(drawerMetrics.bodyOverflow).toBe('hidden');
    expect(drawerMetrics.footerInsideViewport).toBe(true);
    expect(drawerMetrics.panelWidth).toBeGreaterThan(viewport === 'desktop' ? 600 : 0);
    expect(drawerMetrics.panelWidth).toBeLessThanOrEqual(
      viewport === 'desktop' ? Number.MAX_SAFE_INTEGER : 375,
    );
    expect(drawerMetrics.gridColumns).toBe(viewport === 'desktop' ? 2 : 1);

    await attachScreenshot(page, testInfo, 'unidades-drawer');

    await fillRequiredUnitForm(drawer);
    await drawer.getByLabel('Início de vigência').fill('2026-06-10');
    await drawer.getByLabel('Fim de vigência').fill('2026-06-02');
    await expect(footer.getByRole('button', { name: 'Criar unidade' })).toBeEnabled();
    await footer.getByRole('button', { name: 'Criar unidade' }).click();
    await expect(
      drawer.getByText('Data de encerramento deve ser igual ou posterior à data de início.'),
    ).toBeVisible();

    await drawer.getByLabel('Fim de vigência').fill('2026-06-10');
    await footer.getByRole('button', { name: 'Criar unidade' }).click();
    await expect(drawer).toBeHidden();
    await expect(page.locator('body')).not.toHaveClass(/uni-drawer-open/);
  });
});

async function mockUnidadesApi(page: Page): Promise<void> {
  const corsHeaders = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
  };
  let firstCreateKey: string | undefined;

  await page.route(/\/api\/organizacao\/admin\/unidades$/, async (route, request) => {
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (request.method() !== 'POST') {
      await route.continue();
      return;
    }

    const currentKey = request.headers()['idempotency-key'];
    const currentBody = request.postDataJSON() as { vigenciaFim?: string };
    if (firstCreateKey === undefined) {
      firstCreateKey = currentKey;
    } else if (currentKey === firstCreateKey && currentBody.vigenciaFim === '2026-06-10') {
      await route.fulfill({
        status: 422,
        headers: { ...corsHeaders, 'content-type': 'application/problem+json' },
        body: JSON.stringify({
          type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/uniplus.idempotency.body_mismatch',
          title: 'Mesma Idempotency-Key reusada com body diferente',
          status: 422,
          detail: 'Mesma Idempotency-Key reusada com body diferente.',
          instance: 'urn:uuid:019eb1f6-4dd7-75dd-9265-385cadfdec34',
          code: 'uniplus.idempotency.body_mismatch',
          traceId: 'visual-idempotency',
        }),
      });
      return;
    } else {
      await route.fulfill({
        status: 201,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
        body: JSON.stringify('01960000-0000-7000-0000-000000000099'),
      });
      return;
    }

    await route.fulfill({
      status: 422,
      headers: { ...corsHeaders, 'content-type': 'application/problem+json' },
      body: JSON.stringify({
        type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/uniplus.validacao',
        title: 'Erro de validação',
        status: 422,
        code: 'uniplus.validacao',
        traceId: 'visual-validation',
        errors: [
          {
            field: 'VigenciaFim',
            code: 'GreaterThanOrEqualValidator',
            message: 'Data de encerramento deve ser igual ou posterior à data de início.',
          },
        ],
      }),
    });
  });

  await page.route(/\/api\/organizacao\/unidades(\?.*)?$/, async (route, request) => {
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (request.method() !== 'GET') {
      await route.continue();
      return;
    }

    // Mimetiza o filtro server-side do backend (q + tipo): a página não filtra
    // mais em memória, então o mock precisa devolver só o que casa.
    const url = new URL(request.url());
    const q = url.searchParams.get('q');
    const tipos = url.searchParams.getAll('tipo');

    let resultado = [...UNIDADES];
    if (q) {
      const termo = normalizarBusca(q);
      resultado = resultado.filter((u) =>
        normalizarBusca(`${u.nome} ${u.sigla} ${u.codigo} ${u.slug} ${u.alias ?? ''}`).includes(
          termo,
        ),
      );
    }
    if (tipos.length > 0) {
      const labels = tipos.map((t) => TIPO_LABEL_POR_VALOR[t]).filter(Boolean);
      resultado = resultado.filter((u) => labels.includes(u.tipo));
    }

    await route.fulfill({
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      body: JSON.stringify(resultado),
    });
  });
}

// Roster fechado TipoUnidade (valor numérico → label do DTO), espelhando
// TIPOS_UNIDADE da página para traduzir o filtro `?tipo=N` do contrato.
const TIPO_LABEL_POR_VALOR: Record<string, string> = {
  '1': 'Reitoria',
  '2': 'Pro-Reitoria',
  '3': 'Centro',
  '4': 'Instituto',
  '5': 'Faculdade',
  '6': 'Departamento',
  '7': 'Coordenacao',
  '8': 'Diretoria',
  '9': 'Divisao',
  '10': 'Nucleo',
  '11': 'Outro',
};

function normalizarBusca(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

async function fillRequiredUnitForm(drawer: Locator): Promise<void> {
  await drawer.getByLabel('Sigla').fill('FACOM');
  await drawer.getByLabel('Slug').fill('facom');
  await drawer.getByLabel('Código').fill('FACOM');
  await drawer.getByLabel('Nome completo').fill('Faculdade de Computação');
}

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

/**
 * Espera a transição CSS de `background` (`--duration-fast`, ver
 * `components.css`) assentar, medindo diretamente quando o
 * `backgroundColor` computado para de mudar — em vez de um
 * `page.waitForTimeout()` às cegas, que o lint do repo proíbe.
 */
async function aguardarFundoAssentar(locator: Locator): Promise<void> {
  await locator.evaluate(
    (el) =>
      new Promise<void>((resolve) => {
        // Exige um número mínimo de quadros com o mesmo valor seguidos —
        // parar no primeiro quadro "sem mudança" é cedo demais: a transição
        // às vezes só começa a repintar um ou dois quadros depois do evento
        // (mousedown/hover) que a disparou.
        const QUADROS_ESTAVEIS_NECESSARIOS = 6;
        const LIMITE_DE_QUADROS = 40;
        let anterior = getComputedStyle(el).backgroundColor;
        let estaveisSeguidos = 0;
        let quadros = 0;
        const proximoQuadro = () => {
          requestAnimationFrame(() => {
            const atual = getComputedStyle(el).backgroundColor;
            quadros += 1;
            estaveisSeguidos = atual === anterior ? estaveisSeguidos + 1 : 0;
            anterior = atual;
            if (estaveisSeguidos >= QUADROS_ESTAVEIS_NECESSARIOS || quadros >= LIMITE_DE_QUADROS) {
              resolve();
              return;
            }
            proximoQuadro();
          });
        };
        proximoQuadro();
      }),
  );
}

async function centroDoElemento(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Elemento sem bounding box visível — não é possível calcular o centro.');
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function attachScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: 'unidades-lista' | 'unidades-drawer',
): Promise<void> {
  await testInfo.attach(`${testInfo.project.name}-${name}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}

function metadataTheme(testInfo: TestInfo): VisualTheme {
  const theme = testInfo.project.metadata['theme'];
  return theme === 'dark' || theme === 'contrast' ? theme : 'light';
}

function metadataViewport(testInfo: TestInfo): VisualViewport {
  return testInfo.project.metadata['viewport'] === 'mobile' ? 'mobile' : 'desktop';
}
