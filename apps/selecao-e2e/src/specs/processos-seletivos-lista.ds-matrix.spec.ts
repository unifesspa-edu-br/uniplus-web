import { expect, test, type Page, type Route } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import type { AxeResults } from 'axe-core';

type DsTheme = 'light' | 'dark' | 'contrast';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, accept',
};

const ROTA_LISTA = /\/api\/selecao\/processos-seletivos(\?.*)?$/;

const PROCESSOS = [
  {
    id: '019f41cf-69fd-759a-ac6d-09acabc1b027',
    nome: 'Processo Seletivo de Ingresso 2026.1 — Ampla Concorrência e Reserva de Vagas',
    tipoProcesso: {
      origemId: '019f41cf-69fd-759a-ac6d-09acabc1b028',
      codigo: 'VESTIBULAR',
      nome: 'Vestibular',
    },
    status: 'Rascunho',
    criadoEm: '2026-08-20T13:23:42.707136+00:00',
  },
  {
    id: '019f41cf-69fd-759a-ac6d-09acabc1b099',
    nome: 'PSIQ 2026',
    tipoProcesso: {
      origemId: '019f41cf-69fd-759a-ac6d-09acabc1b100',
      codigo: 'PSIQ',
      nome: 'Processo Seletivo Indígena e Quilombola',
    },
    status: 'Publicado',
    criadoEm: '2026-08-21T09:10:00.000000+00:00',
  },
] as const;

/**
 * Matriz do Uni+ DS para a listagem de processos seletivos, nos viewports de
 * 320 px a TV e nos temas claro, escuro e de contraste.
 *
 * A listagem é o ponto de entrada do módulo e tem uma tabela, que é onde o
 * transbordo horizontal costuma aparecer: o nome de um processo é longo por
 * natureza, e a fixture usa um nome real para não medir uma tabela mais
 * estreita do que a que o operador vê.
 *
 * Os três estados assíncronos entram junto porque cada um monta um layout
 * diferente — e o vazio e o de erro não aparecem em nenhuma outra matriz.
 */
test.describe('Listagem de processos seletivos — matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await instalarPreferencia(page, temaDoProject(testInfo.project.name));
  });

  test('não transborda horizontalmente com a tabela preenchida', async ({ page }) => {
    await responderLista(page, PROCESSOS);
    await page.goto('/processo-seletivo');
    await expect(page.getByRole('table')).toBeVisible();

    expect(await transbordo(page)).toBe(false);
  });

  test('não transborda horizontalmente no estado vazio', async ({ page }) => {
    await responderLista(page, []);
    await page.goto('/processo-seletivo');
    await expect(page.getByText('Nenhum processo seletivo cadastrado')).toBeVisible();

    expect(await transbordo(page)).toBe(false);
  });

  test('não transborda horizontalmente quando a leitura falha', async ({ page }) => {
    await responderLista(page, null);
    await page.goto('/processo-seletivo');
    await expect(page.getByRole('alert')).toBeVisible();

    expect(await transbordo(page)).toBe(false);
  });

  test('mantém um único landmark main', async ({ page }) => {
    await responderLista(page, PROCESSOS);
    await page.goto('/processo-seletivo');

    await expect(page.getByRole('main')).toHaveCount(1);
  });

  /**
   * O axe roda sobre a tabela preenchida e sobre o estado de erro: o alerta
   * tem papel e cor próprios, e é onde uma violação de contraste passaria sem
   * ser vista no tema de contraste.
   *
   * A asserção é sobre a coleção inteira. `impact` é severidade do axe, não
   * nível de conformidade: filtrar por ele deixaria passar violação de WCAG
   * 2.1 AA classificada como moderada, num teste que promete o contrário.
   */
  test('não viola WCAG 2.1 AA com a tabela preenchida', async ({ page }) => {
    await responderLista(page, PROCESSOS);
    await page.goto('/processo-seletivo');
    await expect(page.getByRole('table')).toBeVisible();

    const resultado = await runAxeWcagAA(page);

    expect(identificadoresDe(resultado)).toEqual([]);
  });

  test('não viola WCAG 2.1 AA quando a leitura falha', async ({ page }) => {
    await responderLista(page, null);
    await page.goto('/processo-seletivo');
    await expect(page.getByRole('alert')).toBeVisible();

    const resultado = await runAxeWcagAA(page);

    expect(identificadoresDe(resultado)).toEqual([]);
  });
});

/** `null` responde 503, para exercitar o estado de erro. */
async function responderLista(
  page: Page,
  itens: readonly unknown[] | null,
): Promise<void> {
  await page.route(ROTA_LISTA, async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    if (itens === null) {
      await route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        headers: CORS_HEADERS,
        body: JSON.stringify({
          type: 'about:blank',
          title: 'Serviço indisponível',
          status: 503,
        }),
      });
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

/**
 * Compara a largura rolável com a visível. Medir o `body` não basta: um filho
 * mais largo que a janela transborda sem alargar o elemento que o contém.
 */
async function transbordo(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const raiz = document.documentElement;
    return raiz.scrollWidth > raiz.clientWidth + 1;
  });
}

/** Falhar por id diz qual regra caiu; a coleção crua não. */
function identificadoresDe(resultado: AxeResults): string[] {
  return resultado.violations.map((violacao) => violacao.id);
}

async function instalarPreferencia(page: Page, theme: DsTheme): Promise<void> {
  await page.addInitScript((dsTheme) => {
    window.localStorage.setItem(
      'uniplus.a11y',
      JSON.stringify({
        theme: dsTheme === 'contrast' ? 'auto' : dsTheme,
        contrast: dsTheme === 'contrast',
        fontMode: 'default',
      }),
    );
  }, theme);
}

function temaDoProject(projectName: string): DsTheme {
  const parte = projectName.split('-').at(-1);
  return parte === 'dark' || parte === 'contrast' ? parte : 'light';
}
