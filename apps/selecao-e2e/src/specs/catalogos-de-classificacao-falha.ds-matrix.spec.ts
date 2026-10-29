import { expect, test, type Page, type Route } from '@playwright/test';
import { irAoPasso } from '../support/navega-passo';
import { instalarPreferencia, temaDoProject } from '../support/tema';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, accept',
};

const AVISO = /Não foi possível carregar os catálogos de regras de classificação/;

function regra(codigo: string, tipo: string) {
  return {
    codigo,
    versao: '1.0',
    tipo,
    esquemaArgs: {},
    invariantes: {},
    baseLegal: `Base de ${codigo}`,
    hash: `hash-${codigo}`,
    modalidadesAdmitidas: null,
  };
}

const POR_TIPO: Record<string, readonly unknown[]> = {
  regra_calculo: [regra('FORMULA-MEDIA-PONDERADA', 'regra_calculo')],
  regra_arredondamento: [regra('ARRED-TRUNCAR', 'regra_arredondamento')],
  regra_ordem_alocacao: [regra('ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA', 'regra_ordem_alocacao')],
  regra_eliminacao: [regra('ELIM-ZERO-EM-AREA', 'regra_eliminacao')],
  regra_bonus: [regra('BONUS-MULTIPLICATIVO', 'regra_bonus')],
  criterio_desempate: [regra('DESEMPATE-MAIOR-IDADE', 'criterio_desempate')],
};

/**
 * Serve os seis catálogos, recusando com 503 o de `tipoComFalha` por `falha.restantes`
 * chamadas — `Infinity` esgota a retentativa automática e deixa o aviso na tela.
 */
async function mockarCatalogos(
  page: Page,
  tipoComFalha: string,
  falha: { restantes: number },
): Promise<void> {
  await page.route(/\/api\/selecao\/regras-catalogo(\?.*)?$/, async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    const tipo = new URL(route.request().url()).searchParams.get('tipo') ?? '';
    if (falha.restantes > 0 && tipo === tipoComFalha) {
      falha.restantes--;
      await route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        headers: CORS_HEADERS,
        body: JSON.stringify({ type: 'about:blank', title: 'Indisponível', status: 503 }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS_HEADERS,
      body: JSON.stringify(POR_TIPO[tipo] ?? []),
    });
  });

  // Vocabulários que os passos consultam ao abrir; vazios bastam para o cenário.
  await page.route(/\/api\/configuracao\/.*$/, async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS_HEADERS,
      body: '[]',
    });
  });
}

/**
 * Um dos seis catálogos que falha apaga os selects dos quatro passos de classificação (regra do
 * "ou vêm todos, ou nenhum"). O operador precisa de um caminho de volta sem sair do passo.
 */
test.describe('Catálogos de classificação — falha e nova tentativa @ds', () => {
  const PASSOS = [
    { passo: 'Fórmula e precisão', tipoComFalha: 'regra_calculo' },
    { passo: 'Bônus', tipoComFalha: 'regra_bonus' },
    { passo: 'Desempate', tipoComFalha: 'criterio_desempate' },
    { passo: 'Eliminação', tipoComFalha: 'regra_eliminacao' },
  ];

  for (const { passo, tipoComFalha } of PASSOS) {
    test(`${passo}: o aviso traz "Tentar novamente", que recarrega sem sair do passo`, async ({
      page,
    }, testInfo) => {
      const falha = { restantes: Infinity };
      await mockarCatalogos(page, tipoComFalha, falha);
      await instalarPreferencia(page, temaDoProject(testInfo.project.name));
      await page.goto('/processo-seletivo/novo');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      await irAoPasso(page, passo, testInfo);

      const aviso = page.getByRole('alert').filter({ hasText: AVISO });
      await expect(aviso).toBeVisible();

      falha.restantes = 0;
      await aviso.getByRole('button', { name: 'Tentar novamente' }).click();

      await expect(aviso).toBeHidden();
      if (passo === 'Fórmula e precisão') {
        await expect(
          page
            .getByLabel('Regra de cálculo', { exact: true })
            .locator('option[value="FORMULA-MEDIA-PONDERADA|1.0"]'),
        ).toHaveCount(1);
      }
    });
  }

  test('uma falha só na primeira rodada é absorvida pela retentativa, sem aviso', async ({
    page,
  }, testInfo) => {
    // A primeira chamada falha; a repetição, 800 ms depois, já encontra o catálogo de volta.
    await mockarCatalogos(page, 'regra_calculo', { restantes: 1 });
    await instalarPreferencia(page, temaDoProject(testInfo.project.name));
    await page.goto('/processo-seletivo/novo');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await irAoPasso(page, 'Fórmula e precisão', testInfo);

    await expect(
      page
        .getByLabel('Regra de cálculo', { exact: true })
        .locator('option[value="FORMULA-MEDIA-PONDERADA|1.0"]'),
    ).toHaveCount(1);
    await expect(page.getByRole('alert').filter({ hasText: AVISO })).toHaveCount(0);
  });
});
