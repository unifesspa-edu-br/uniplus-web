import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import type { AxeResults } from 'axe-core';

type DsTheme = 'light' | 'dark' | 'contrast';

/** Abaixo desta largura o stepper lateral dá lugar à barra com diálogo. */
const LARGURA_STEPPER_LATERAL = 768;

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, accept',
};

/** Uma regra mínima do `rol_de_regras`, com o par código+base legal que o seletor exibe. */
function regra(codigo: string, tipo: string, baseLegal: string) {
  return {
    codigo,
    versao: '1.0',
    tipo,
    esquemaArgs: {},
    invariantes: {},
    baseLegal,
    hash: `hash-${codigo}`,
    modalidadesAdmitidas: null,
  };
}

const REGRAS_CALCULO = [
  regra('FORMULA-MEDIA-PONDERADA', 'regra_calculo', 'Resolução CEPS 12/2026'),
  regra('CLASSIFICACAO-IMPORTADA', 'regra_calculo', 'Portaria MEC 468/2023'),
];
const REGRAS_ARREDONDAMENTO = [
  regra('ARRED-TRUNCAR', 'regra_arredondamento', 'Edital padrão PSIQ'),
];
const REGRAS_ORDEM_ALOCACAO = [regra('ALOCACAO-OPCOES-RN04', 'regra_ordem_alocacao', 'RN04')];
const REGRAS_ELIMINACAO = [
  regra('ELIM-ZERO-EM-AREA', 'regra_eliminacao', 'Resolução 805/2020, art. 5º'),
];
const REGRAS_BONUS = [
  regra(
    'BONUS-MULTIPLICATIVO',
    'regra_bonus',
    'Bônus multiplicativo aplicado à nota final após os pesos das áreas do ENEM, sem teto por padrão',
  ),
];
const BASE_LEGAL_BONUS_REGIONAL_ID = 'ba5e0000-0000-7000-8000-000000000001';
const BASES_LEGAIS_BONUS_REGIONAL = [
  {
    id: BASE_LEGAL_BONUS_REGIONAL_ID,
    tipoInstrumento: 'PORTARIA',
    identificacao: 'Portaria Unifesspa nº 2514/2023',
    descricao: 'Institui inclusão regional.',
    municipios: [{ codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' }],
    criadoEm: '2026-01-01T00:00:00Z',
  },
];
const CRITERIOS_DESEMPATE = [
  regra('DESEMPATE-MAIOR-IDADE', 'criterio_desempate', 'Costume administrativo'),
  regra('DESEMPATE-IDOSO', 'criterio_desempate', 'Lei 10.741/2003, art. 27'),
  regra('DESEMPATE-PREDICADO-FATO', 'criterio_desempate', 'Definido por cada edital'),
];

/**
 * Matriz do Uni+ DS para classificação, eliminação, bônus e desempate
 * (UNI-REQ-0482). As quatro telas são seletores dirigidos por catálogo,
 * editores dinâmicos por código de regra e listas ordenáveis — a mesma
 * superfície que `configuracao-por-fase.ds-matrix.spec.ts` cobre para o
 * cronograma, e o mesmo motivo de existir: seletor em laço, campo condicional
 * e lista reordenável escondem violação de rótulo e de contraste do template
 * estático.
 *
 * O CI do frontend sobe Keycloak, mas não a API: os catálogos de regra são
 * materializados por rota, o que mantém o cenário determinístico.
 */
test.describe('Classificação, bônus e desempate — matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await mockarCatalogos(page);
    await instalarPreferencia(page, temaDoProject(testInfo.project.name));
    await page.goto('/processo-seletivo/novo');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test.describe('Fórmula e precisão', () => {
    test('não viola WCAG 2.1 AA com fórmula local declarada', async ({ page }, testInfo) => {
      await irAoPasso(page, 'Fórmula e precisão', testInfo);
      await declararFormulaLocal(page);

      const resultado = await runAxeWcagAA(page);
      expect(identificadoresDe(resultado)).toEqual([]);
    });

    test('não viola WCAG 2.1 AA sob classificação importada (sem seção de precisão)', async ({
      page,
    }, testInfo) => {
      await irAoPasso(page, 'Fórmula e precisão', testInfo);
      await page
        .getByLabel('Regra de cálculo', { exact: true })
        .selectOption('CLASSIFICACAO-IMPORTADA|1.0');

      await expect(page.getByLabel('Regra de arredondamento', { exact: true })).toBeHidden();

      const resultado = await runAxeWcagAA(page);
      expect(identificadoresDe(resultado)).toEqual([]);
    });

    test('nomeia cada campo pelo rótulo visível', async ({ page }, testInfo) => {
      await irAoPasso(page, 'Fórmula e precisão', testInfo);
      await declararFormulaLocal(page);

      await expect(page.getByLabel('Regra de cálculo', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Regra de arredondamento', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Casas decimais', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Ordem de alocação', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Número de opções de curso', { exact: true })).toBeVisible();
    });
  });

  test.describe('Eliminação', () => {
    /** ELIM-ZERO-EM-AREA não usa argumento — a única regra que dispensa etapa persistida. */
    test('não viola WCAG 2.1 AA com uma regra de eliminação sem argumento', async ({
      page,
    }, testInfo) => {
      await irAoPasso(page, 'Fórmula e precisão', testInfo);
      await declararFormulaLocal(page);
      await page.getByLabel('Classificação baseada em provas').check();

      await irAoPasso(page, 'Eliminação', testInfo);
      await page.getByRole('button', { name: '+ Acrescentar regra de eliminação' }).click();
      await page
        .getByLabel('Regra de eliminação', { exact: true })
        .selectOption('ELIM-ZERO-EM-AREA|1.0');

      const resultado = await runAxeWcagAA(page);
      expect(identificadoresDe(resultado)).toEqual([]);
    });

    test('avisa quando nenhuma etapa do cronograma compõe a nota', async ({ page }, testInfo) => {
      await irAoPasso(page, 'Fórmula e precisão', testInfo);
      await declararFormulaLocal(page);

      await irAoPasso(page, 'Eliminação', testInfo);

      await expect(page.getByRole('alert').filter({ hasText: 'Nenhuma etapa' })).toBeVisible();
    });
  });

  test.describe('Bônus', () => {
    test('não viola WCAG 2.1 AA com bônus declarado', async ({ page }, testInfo) => {
      await irAoPasso(page, 'Bônus', testInfo);
      await page
        .getByLabel('Aplicar bônus regional neste processo seletivo?', { exact: true })
        .check();
      await page
        .getByLabel('Regra do bônus', { exact: true })
        .selectOption('BONUS-MULTIPLICATIVO|1.0');
      await page.getByLabel('Fator', { exact: true }).fill('1.2');
      await page
        .getByLabel('Base Legal do bônus', { exact: true })
        .selectOption(BASE_LEGAL_BONUS_REGIONAL_ID);

      const resultado = await runAxeWcagAA(page);
      expect(identificadoresDe(resultado)).toEqual([]);
    });

    test('não viola WCAG 2.1 AA com a conferência acusando', async ({ page }, testInfo) => {
      await irAoPasso(page, 'Bônus', testInfo);
      await page
        .getByLabel('Aplicar bônus regional neste processo seletivo?', { exact: true })
        .check();
      await page.getByLabel('Fator', { exact: true }).fill('0');

      const resultado = await runAxeWcagAA(page);
      expect(identificadoresDe(resultado)).toEqual([]);
    });
  });

  test.describe('Desempate', () => {
    test('não viola WCAG 2.1 AA com três variantes de critério na lista', async ({
      page,
    }, testInfo) => {
      await irAoPasso(page, 'Desempate', testInfo);

      // "Regra do critério" se repete uma vez por linha da lista — o mesmo
      // rótulo em cada ocorrência é o comportamento correto de acessibilidade
      // para campos repetidos, e o `.nth()` aqui seleciona a N-ésima linha,
      // não desambigua conceitos diferentes que colidiram por acidente.
      const regraDoCriterio = page.getByLabel('Regra do critério', { exact: true });

      await page.getByRole('button', { name: '+ Acrescentar critério' }).click();
      await regraDoCriterio.nth(0).selectOption('DESEMPATE-MAIOR-IDADE|1.0');

      await page.getByRole('button', { name: '+ Acrescentar critério' }).click();
      await regraDoCriterio.nth(1).selectOption('DESEMPATE-IDOSO|1.0');
      await page.getByLabel('Idade mínima', { exact: true }).fill('60');

      await page.getByRole('button', { name: '+ Acrescentar critério' }).click();
      await regraDoCriterio.nth(2).selectOption('DESEMPATE-PREDICADO-FATO|1.0');
      await page.getByLabel('Fato', { exact: true }).fill('RENDA_PER_CAPITA');
      await page.getByLabel('Operador', { exact: true }).fill('lte');
      await page.getByLabel('Valor', { exact: true }).fill('1.5');

      const resultado = await runAxeWcagAA(page);
      expect(identificadoresDe(resultado)).toEqual([]);
    });

    test('reordena por teclado — mover para cima fica indisponível no topo', async ({
      page,
    }, testInfo) => {
      await irAoPasso(page, 'Desempate', testInfo);

      await page.getByRole('button', { name: '+ Acrescentar critério' }).click();
      await expect(page.getByRole('button', { name: 'Mover para cima' })).toBeDisabled();
    });
  });

  test('não transborda horizontalmente na Eliminação', async ({ page }, testInfo) => {
    await irAoPasso(page, 'Eliminação', testInfo);

    const medida = await page.evaluate(() => {
      const documento = document.documentElement;
      const scroller = document.querySelector('.wiz-content');
      return {
        documento: documento.scrollWidth - documento.clientWidth,
        scroller: scroller instanceof HTMLElement ? scroller.scrollWidth - scroller.clientWidth : 0,
      };
    });

    expect(medida.documento).toBeLessThanOrEqual(1);
    expect(medida.scroller).toBeLessThanOrEqual(1);
  });
});

/** Fórmula local completa — regra de cálculo, arredondamento, casas e ordem de alocação. */
async function declararFormulaLocal(page: Page): Promise<void> {
  await page
    .getByLabel('Regra de cálculo', { exact: true })
    .selectOption('FORMULA-MEDIA-PONDERADA|1.0');
  await page
    .getByLabel('Regra de arredondamento', { exact: true })
    .selectOption('ARRED-TRUNCAR|1.0');
  await page.getByLabel('Casas decimais', { exact: true }).fill('2');
  await page
    .getByLabel('Ordem de alocação', { exact: true })
    .selectOption('ALOCACAO-OPCOES-RN04|1.0');
  await page.getByLabel('Número de opções de curso', { exact: true }).selectOption('2');
}

/**
 * Abaixo de 768 px o stepper lateral dá lugar à barra de etapas com diálogo, e
 * o caminho até um passo muda com ele.
 */
async function irAoPasso(page: Page, rotulo: string, testInfo: TestInfo): Promise<void> {
  const largura = testInfo.project.use.viewport?.width;
  if (largura === undefined) {
    throw new Error(`Project ${testInfo.project.name} não declara viewport.`);
  }

  if (largura >= LARGURA_STEPPER_LATERAL) {
    await page.getByRole('button', { name: rotulo }).click();
    return;
  }

  await page.getByRole('button', { name: 'Abrir lista de etapas' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Etapas do cadastro' });
  await expect(dialogo).toBeVisible();
  await dialogo.getByRole('button', { name: rotulo }).click();
  await expect(dialogo).toBeHidden();
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

/** Os catálogos de regra que as quatro telas consultam, todos do mesmo `rol_de_regras`. */
async function mockarCatalogos(page: Page): Promise<void> {
  await page.route(/\/api\/selecao\/regras-catalogo(\?.*)?$/, async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    const url = new URL(route.request().url());
    const tipo = url.searchParams.get('tipo');
    const porTipo: Record<string, readonly unknown[]> = {
      regra_calculo: REGRAS_CALCULO,
      regra_arredondamento: REGRAS_ARREDONDAMENTO,
      regra_ordem_alocacao: REGRAS_ORDEM_ALOCACAO,
      regra_eliminacao: REGRAS_ELIMINACAO,
      regra_bonus: REGRAS_BONUS,
      criterio_desempate: CRITERIOS_DESEMPATE,
    };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS_HEADERS,
      body: JSON.stringify(porTipo[tipo ?? ''] ?? []),
    });
  });

  await page.route(
    /\/api\/configuracao\/base-legal-bonus-regional(\?.*)?$/,
    async (route: Route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: CORS_HEADERS });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify(BASES_LEGAIS_BONUS_REGIONAL),
      });
    },
  );
}
