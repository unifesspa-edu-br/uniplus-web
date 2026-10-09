import { expect, test, type Page, type Route } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import type { AxeResults } from 'axe-core';
import { irAoPasso } from '../support/navega-passo';
import { instalarPreferencia, temaDoProject } from '../support/tema';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, accept',
};

const TIPOS_PROCESSO = [
  {
    id: '01960000-0000-7000-0000-000000000515',
    codigo: 'SISU',
    nome: 'SISU',
    descricao: 'Seleção unificada pelo ENEM.',
    ativo: true,
    criadoEm: '2026-08-11T00:00:00Z',
  },
] as const;

const UNIDADES = [
  {
    id: '01960000-0000-7000-0000-0000000005cc',
    nome: 'Pró-Reitoria de Ensino de Graduação',
    alias: 'PROEG',
    slug: 'proeg',
    sigla: 'PROEG',
    codigo: 'PROEG',
    unidadeSuperiorId: null,
    tipo: 'ProReitoria',
    unidadeAcademica: false,
    vigenciaInicio: '2026-01-01',
    vigenciaFim: null,
    criadoEm: '2026-06-10T12:00:00Z',
  },
] as const;

/**
 * Matriz do Uni+ DS para o passo Identificação, com foco no campo do identificador legível
 * (web#769): a única superfície nova do passo.
 *
 * O axe roda com o campo sem erro e com o erro de formato exibido, porque o estado de recusa
 * acrescenta a mensagem ao nome acessível do campo e o anúncio por leitor de tela — e é nele que
 * uma associação quebrada apareceria.
 *
 * O CI do frontend sobe Keycloak, mas não a API: os catálogos que a tela consulta são
 * materializados por rota, o que mantém o cenário determinístico.
 */
test.describe('Identificação — matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await mockarCatalogos(page);
    await instalarPreferencia(page, temaDoProject(testInfo.project.name));
    await page.goto('/processo-seletivo/novo');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await irAoPasso(page, 'Identificação', testInfo);
    await expect(page.getByLabel('Identificador legível')).toBeVisible();
  });

  /**
   * A asserção é sobre a coleção inteira. `impact` é severidade do axe, não nível de
   * conformidade: filtrar por ele deixaria passar violação de WCAG 2.1 AA classificada como
   * moderada, num teste que promete o contrário.
   */
  test('não viola WCAG 2.1 AA com o campo sem erro', async ({ page }) => {
    await page.getByLabel('Identificador legível').fill('medicina-2027');

    const resultado = await runAxeWcagAA(page);

    expect(identificadoresDe(resultado)).toEqual([]);
  });

  test('não viola WCAG 2.1 AA com o erro de formato exibido', async ({ page }) => {
    await exibirErroDeFormato(page);

    const resultado = await runAxeWcagAA(page);

    expect(identificadoresDe(resultado)).toEqual([]);
  });

  /** O erro é associado ao campo e anunciado — não só pintado de vermelho (SC 3.3.1). */
  test('associa o erro de formato ao campo', async ({ page }) => {
    await exibirErroDeFormato(page);

    const campo = page.locator('#f-identificador');
    await expect(campo).toHaveAttribute('aria-invalid', 'true');
    await expect(campo).toHaveAttribute('aria-describedby', /f-identificador-erro/);
    await expect(page.locator('#f-identificador-erro')).toHaveAttribute('role', 'alert');
  });

  /** O campo vem logo depois do nome, na ordem do formulário (SC 2.4.3). */
  test('alcança o campo por teclado', async ({ page }) => {
    await page.locator('#f-nome').focus();
    await page.keyboard.press('Tab');

    await expect(page.locator('#f-identificador')).toBeFocused();
  });
});

/**
 * Preenche o identificador com formato inválido e aciona o avanço: a conferência do passo é o
 * que exibe o erro junto ao campo, antes de qualquer envio.
 */
async function exibirErroDeFormato(page: Page): Promise<void> {
  await page.getByLabel('Identificador legível').fill('Medicina 2027');
  await page.getByRole('button', { name: 'Gravar e avançar' }).click();
  await expect(page.locator('#f-identificador-erro')).toBeVisible();
}

/** Falhar por id diz qual regra caiu; a coleção crua não. */
function identificadoresDe(resultado: AxeResults): string[] {
  return resultado.violations.map((violacao) => violacao.id);
}

/** Os catálogos que o cadastro inicial consulta: o tipo do processo e as unidades. */
async function mockarCatalogos(page: Page): Promise<void> {
  await responderCatalogo(page, /\/api\/configuracao\/tipos-processo(\?.*)?$/, TIPOS_PROCESSO);
  await responderCatalogo(page, /\/api\/organizacao\/unidades(\?.*)?$/, UNIDADES);
}

async function responderCatalogo(
  page: Page,
  rota: RegExp,
  itens: readonly unknown[],
): Promise<void> {
  await page.route(rota, async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS_HEADERS,
      body: JSON.stringify(itens),
    });
  });
}
