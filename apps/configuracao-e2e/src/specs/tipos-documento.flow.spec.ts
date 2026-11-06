import { expect, test, type Page } from '@playwright/test';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';
import { assertSemViolacoesGraves } from '../support/a11y';
import { abrirFiltros } from '../support/filtros';
import {
  CODIGO_DUPLICADO_PROBLEM,
  laudoSeed,
  mockApi,
  novoCapturado,
  rgSeed,
} from '../support/tipos-documento-api';

/**
 * E2E funcional do cadastro de Tipo de Documento (issue #392). Convenção do
 * repo: runtime-config e API mockados por `page.route`; autenticação real
 * (Keycloak) via projeto `fluxo-chromium` (auth-setup + storageState).
 *
 * Nomeado `tipos-documento.flow.spec.ts` (não `.e2e.ts`, conforme o mapa de
 * testes da issue) para casar com `testMatch: /.*\.flow\.spec\.ts$/` do
 * `playwright.config.ts` — é o padrão que roda com auth real mockando só a
 * API, espelhando `cursos.flow.spec.ts`/`pesos-enem.flow.spec.ts`.
 */

function dialogDeRemocao(page: Page) {
  return page.getByRole('dialog', { name: 'Remover tipo de documento', exact: true });
}

function drawerDoFormulario(page: Page) {
  return page.getByRole('dialog', { name: 'Formulário de tipo de documento', exact: true });
}

function linhasDaLista(page: Page) {
  return page.getByRole('region', { name: 'Tipos de documento', exact: true }).locator('tbody tr');
}

/** A proteção de dados é obrigatória no cadastro: classificação, hipótese legal e finalidade. */
async function preencherProtecao(page: Page): Promise<void> {
  await page
    .locator('[formControlName="classificacaoProtecao"]')
    .selectOption({ label: 'Pessoal' });
  await page
    .locator('[formControlName="hipoteseLegal"]')
    .selectOption({ label: 'Execução de políticas públicas' });
  await page
    .locator('[formControlName="finalidadeTratamento"]')
    .fill('Comprovar a identificação do candidato na inscrição.');
}

async function abrirPagina(page: Page): Promise<void> {
  await page.goto('/tipos-documento');
  await expect(page.getByRole('heading', { name: 'Tipo de Documento', level: 1 })).toBeVisible();
}

/**
 * Locator de um chip de categoria pelo rótulo. `ui-filter-chips` sempre
 * inclui o contador como texto visível dentro do próprio botão (ex.: "Saúde
 * 1", "Todas 2") — o nome acessível nunca é só o rótulo isolado. A regex
 * ancorada no início casa o rótulo seguido do contador sem colidir com
 * outros botões da página que contenham o mesmo texto.
 */
function chipLocator(page: Page, rotulo: string) {
  const escapado = rotulo.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return page.getByRole('button', { name: new RegExp(`^${escapado}\\b`, 'u') });
}

test.describe('Tipo de Documento — CRUD (#392)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('CA-01: fluxo completo — criar, listar, filtrar por categoria e remover', async ({
    page,
  }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [rgSeed, laudoSeed]);
    await abrirPagina(page);

    await expect(page.getByText('RG', { exact: true })).toBeVisible();
    await expect(page.getByText('Laudo médico — PcD')).toBeVisible();

    // Filtro por categoria (chip "Saúde 1" — ui-filter-chips inclui o contador no nome acessível)
    await abrirFiltros(page);
    await chipLocator(page, 'Saúde').click();
    await expect(linhasDaLista(page)).toHaveCount(1);
    await expect(page.getByText('Laudo médico — PcD')).toBeVisible();
    await expect(chipLocator(page, 'Saúde')).toHaveAttribute('aria-pressed', 'true');

    // Volta para "Todas 2"
    await chipLocator(page, 'Todas').click();
    await expect(linhasDaLista(page)).toHaveCount(2);

    // Criar
    await page.getByRole('button', { name: 'Novo tipo' }).first().click();
    await page.locator('[formControlName="codigo"]').fill('DECL_LIDERANCA');
    await page.locator('[formControlName="nome"]').fill('Declaração de liderança');
    await page.locator('[formControlName="categoria"]').selectOption('OUTROS');
    await preencherProtecao(page);
    await page.getByRole('button', { name: 'Criar tipo de documento' }).click();

    await expect.poll(() => capturado.posts.length).toBe(1);
    expect(capturado.posts[0]).toMatchObject({ codigo: 'DECL_LIDERANCA', categoria: 'OUTROS' });

    await page
      .getByRole('button', { name: `Remover tipo de documento ${rgSeed.codigo}`, exact: true })
      .click();
    const dialog = dialogDeRemocao(page);
    await expect(
      dialog.getByText('parâmetros foram congelados na configuração do edital'),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Remover' }).click();

    await expect.poll(() => capturado.deletedIds.length).toBe(1);
  });

  test('CA-05: tipo equivalente igual ao código é rejeitado sem chamar o backend', async ({
    page,
  }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, []);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Novo tipo' }).first().click();
    await page.locator('[formControlName="codigo"]').fill('RG');
    await page.locator('[formControlName="tipoEquivalente"]').fill('RG');
    await page.locator('[formControlName="tipoEquivalente"]').blur();

    await expect(
      page.getByText('O tipo equivalente não pode ser igual ao próprio código.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Criar tipo de documento' }).click();
    await expect(page.locator('[formControlName="tipoEquivalente"]')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(capturado.posts).toHaveLength(0);
  });

  test('CA-08: modal de remoção não exibe bloqueio por referência de outro módulo', async ({
    page,
  }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, [rgSeed]);
    await abrirPagina(page);

    await page
      .getByRole('button', { name: `Remover tipo de documento ${rgSeed.codigo}`, exact: true })
      .click();
    const dialog = dialogDeRemocao(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/bloque/i)).toHaveCount(0);
  });
});

// Bloco `validacao`: rejeição de código duplicado — erro inline sem submit bem-sucedido.
test.describe('Tipo de Documento — validação (#392)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('CA-03: código duplicado é rejeitado com erro inline sem fechar o drawer', async ({
    page,
  }) => {
    await mockApi(page, novoCapturado(), [], {
      criarStatus: 409,
      criarBody: CODIGO_DUPLICADO_PROBLEM,
    });
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Novo tipo' }).first().click();
    await page.locator('[formControlName="codigo"]').fill('RG');
    await page.locator('[formControlName="nome"]').fill('Registro Geral (dup)');
    await page.locator('[formControlName="categoria"]').selectOption('IDENTIFICACAO');
    await preencherProtecao(page);
    await page.getByRole('button', { name: 'Criar tipo de documento' }).click();

    await expect(page.getByText(CODIGO_DUPLICADO_PROBLEM.title)).toBeVisible();
    await expect(page.locator('#cfg-tipo-documento-form')).toBeVisible();
  });

  test('CA-06: tamanho máximo zero ou negativo bloqueia o submit', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, []);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Novo tipo' }).first().click();
    await page.locator('[formControlName="codigo"]').fill('DECL');
    await page.locator('[formControlName="nome"]').fill('Declaração');
    await page.locator('[formControlName="categoria"]').selectOption('OUTROS');
    await preencherProtecao(page);
    const tamanho = page.locator('[formControlName="tamanhoMaximoMb"]');
    await tamanho.fill('0');
    await tamanho.blur();
    await page.getByRole('button', { name: 'Criar tipo de documento' }).click();

    await expect(tamanho).toHaveAttribute('aria-invalid', 'true');
    expect(capturado.posts).toHaveLength(0);

    // Controle: com tamanho válido o mesmo formulário envia, logo só o tamanho bloqueava.
    await tamanho.fill('5');
    await page.getByRole('button', { name: 'Criar tipo de documento' }).click();
    await expect.poll(() => capturado.posts.length).toBe(1);
  });
});

// Bloco `axe`: acessibilidade WCAG 2.1 AA (sem violações serious/critical) na
// lista, no drawer aberto e no modal aberto.
test.describe('Tipo de Documento — acessibilidade axe-core (#392)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('lista não tem violações serious/critical', async ({ page }) => {
    await mockApi(page, novoCapturado(), [rgSeed, laudoSeed]);
    await abrirPagina(page);
    await assertSemViolacoesGraves(page);
  });

  test('drawer aberto não tem violações serious/critical', async ({ page }) => {
    await mockApi(page, novoCapturado(), []);
    await abrirPagina(page);
    await page.getByRole('button', { name: 'Novo tipo' }).first().click();
    await expect(drawerDoFormulario(page)).toBeVisible();
    await assertSemViolacoesGraves(page);
  });

  test('modal de remoção aberto não tem violações serious/critical', async ({ page }) => {
    await mockApi(page, novoCapturado(), [rgSeed]);
    await abrirPagina(page);
    await page
      .getByRole('button', { name: `Remover tipo de documento ${rgSeed.codigo}`, exact: true })
      .click();
    await expect(dialogDeRemocao(page)).toBeVisible();
    await assertSemViolacoesGraves(page);
  });
});

// Bloco `axe` escopado: audita só o <ui-filter-bar>, isolado do resto da
// página, respondendo ao CA-06 da issue #513 (ui-filter-bar #500).
test.describe('ui-filter-bar — auditoria isolada axe-core (CA-06 da issue #513)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('não tem violações serious/critical isoladamente', async ({ page }) => {
    await mockApi(page, novoCapturado(), [rgSeed, laudoSeed]);
    await abrirPagina(page);

    await assertSemViolacoesGraves(page, { include: '.filter-bar' });
  });
});

// Bloco `keyboard`: navegação por teclado sem mouse (e-MAG 3.1).
test.describe('Tipo de Documento — navegação por teclado (#392)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('abre o drawer, preenche e salva sem usar o mouse', async ({ page }) => {
    const capturado = novoCapturado();
    await mockApi(page, capturado, []);
    await abrirPagina(page);

    await page.getByRole('button', { name: 'Novo tipo' }).first().focus();
    await page.keyboard.press('Enter');
    await expect(drawerDoFormulario(page)).toBeVisible();

    await page.locator('[formControlName="codigo"]').fill('DECL_TECLADO');
    await page.locator('[formControlName="nome"]').fill('Declaração via teclado');
    await page.locator('[formControlName="categoria"]').selectOption('OUTROS');
    await preencherProtecao(page);

    await page.getByRole('button', { name: 'Criar tipo de documento' }).focus();
    await page.keyboard.press('Enter');

    await expect.poll(() => capturado.posts.length).toBe(1);
  });
});

// Bloco `responsive`: lista e drawer em 375 px (mobile).
test.describe('Tipo de Documento — responsividade 375px (#392)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('lista e drawer permanecem sem overflow horizontal em 375px', async ({ page }) => {
    await mockApi(page, novoCapturado(), [rgSeed, laudoSeed]);
    await abrirPagina(page);

    const semOverflowLista = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(semOverflowLista.scrollWidth).toBeLessThanOrEqual(semOverflowLista.clientWidth);

    await page.getByRole('button', { name: 'Novo tipo' }).first().click();
    await expect(drawerDoFormulario(page)).toBeVisible();

    const semOverflowDrawer = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(semOverflowDrawer.scrollWidth).toBeLessThanOrEqual(semOverflowDrawer.clientWidth);
  });
});

// Bloco `a11y-focus`: drawer fecha com Esc e o foco retorna ao botão gatilho.
test.describe('Tipo de Documento — foco e Esc (#392)', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfiguracaoRuntimeConfig(page);
  });

  test('drawer fecha com Esc e o foco retorna ao botão "Novo tipo"', async ({ page }) => {
    await mockApi(page, novoCapturado(), []);
    await abrirPagina(page);

    const gatilho = page.getByRole('button', { name: 'Novo tipo' }).first();
    await gatilho.click();
    await expect(drawerDoFormulario(page)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(drawerDoFormulario(page)).toBeHidden();
    await expect(gatilho).toBeFocused();
  });
});
