import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import type { AxeResults } from 'axe-core';
import { blocosColados } from '../support/ritmo-vertical';
import { medirTransbordoHorizontal } from '../support/rolagem-do-editor';

type DsTheme = 'light' | 'dark' | 'contrast';
type CriterioDeIdade = 'DESEMPATE-MAIOR-IDADE' | 'DESEMPATE-IDOSO';

/** Abaixo desta largura o stepper lateral dá lugar à barra com diálogo. */
const LARGURA_STEPPER_LATERAL = 768;

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, accept',
};

function regra(codigo: string, baseLegal: string) {
  return {
    codigo,
    versao: '1.0',
    tipo: 'criterio_desempate',
    esquemaArgs: {},
    invariantes: {},
    baseLegal,
    hash: `hash-${codigo}`,
    modalidadesAdmitidas: null,
  };
}

const REGRAS_DE_DESEMPATE = [
  regra('DESEMPATE-MAIOR-IDADE', 'Costume administrativo'),
  regra('DESEMPATE-IDOSO', 'Lei 10.741/2003, art. 27'),
];

/** O dado pelo qual o desempate por maior idade ordena, como o catálogo de fatos o publica. */
const FATOS_DO_CANDIDATO = [
  {
    id: 'fato-data-nascimento',
    codigo: 'DATA_NASCIMENTO',
    nome: 'Data de nascimento',
    descricao: null,
    dominio: 'DATA',
    origem: 'DECLARADO',
    cardinalidade: 'ESCALAR',
    valoresDominio: null,
    pontoResolucao: 'INSCRICAO',
    binding: 'CAMPO_INSCRICAO:DATA_NASCIMENTO',
    valoresDominioDeclarados: null,
  },
];

/**
 * Matriz do Uni+ DS para a incoerência entre o desempate por idoso e o formulário (web#909): o
 * idoso compara a faixa etária, que só existe com a apuração da idade declarada. O maior idade
 * ordena pela data de nascimento, que é dado básico de toda inscrição e por isso não falta.
 *
 * Cobre os alertas do passo Desempate, os do passo Formulários e o caminho de um ao outro.
 *
 * O CI do frontend sobe Keycloak, mas não a API: o catálogo de regras e o de fatos são servidos
 * por rota e toda outra consulta responde vazia. O cenário parte do rascunho novo, em que o
 * formulário nasce em "Não apura idade". A consulta não tem os alertas (não há o que corrigir
 * num processo publicado) e é coberta pelos testes do componente.
 */
test.describe('Desempate por idade e formulário — matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await mockarApi(page);
    await instalarPreferencia(page, temaDoProject(testInfo.project.name));
    await page.goto('/processo-seletivo/novo');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test.describe('idoso sem apuração da idade', () => {
    test.describe('passo Desempate', () => {
      test.beforeEach(async ({ page }, testInfo) => {
        await declararCriterio(page, testInfo, 'DESEMPATE-IDOSO');
      });

      test('avisa a incoerência e não viola WCAG 2.1 AA', async ({ page }) => {
        await expect(page.locator('#desemp-idoso-sem-apuracao')).toBeVisible();
        expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
      });

      test('não transborda horizontalmente com o alerta à vista', async ({ page }) => {
        await expect(page.locator('#desemp-idoso-sem-apuracao')).toBeVisible();
        await conferirSemTransbordo(page);
      });
    });

    test.describe('passo Formulários', () => {
      test.beforeEach(async ({ page }, testInfo) => {
        await declararCriterio(page, testInfo, 'DESEMPATE-IDOSO');
        await page.locator('#desemp-ir-formulario-apuracao').click();
        await expect(page.getByRole('heading', { level: 1 })).toContainText('Formulários');
      });

      test('avisa a incoerência e não viola WCAG 2.1 AA', async ({ page }) => {
        await expect(page.locator('#form-idoso-sem-apuracao')).toBeVisible();
        expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
      });

      test('não transborda horizontalmente com o alerta à vista', async ({ page }) => {
        await expect(page.locator('#form-idoso-sem-apuracao')).toBeVisible();
        await conferirSemTransbordo(page);
      });

      test('o alerta sai quando a apuração da idade é declarada', async ({ page }) => {
        await page.getByLabel('Apurar a idade em', { exact: true }).selectOption('FIM_INSCRICAO');
        await expect(page.locator('#form-idoso-sem-apuracao')).toBeHidden();
      });
    });
  });
});

async function conferirSemTransbordo(page: Page): Promise<void> {
  const transbordo = await medirTransbordoHorizontal(page);
  expect(transbordo.documento).toBeLessThanOrEqual(1);
  expect(transbordo.areaDeTrabalho).toBeLessThanOrEqual(1);
  expect(await blocosColados(page)).toEqual([]);
}

/** Acrescenta o critério de idade; o formulário do rascunho novo não tem campos nem apura a idade. */
async function declararCriterio(
  page: Page,
  testInfo: TestInfo,
  codigo: CriterioDeIdade,
): Promise<void> {
  await irAoPasso(page, 'Desempate', testInfo);
  await page.getByRole('button', { name: '+ Acrescentar critério' }).click();
  await page.getByLabel('Regra do critério', { exact: true }).selectOption(`${codigo}|1.0`);
  if (codigo === 'DESEMPATE-IDOSO') {
    await page.getByLabel('Idade mínima', { exact: true }).fill('60');
  }
}

function larguraDoProject(testInfo: TestInfo): number {
  const largura = testInfo.project.use.viewport?.width;
  if (largura === undefined) {
    throw new Error(`Project ${testInfo.project.name} não declara viewport.`);
  }
  return largura;
}

/**
 * Abaixo de 768 px o stepper lateral dá lugar à barra de etapas com diálogo, e o caminho até um
 * passo muda com ele.
 */
async function irAoPasso(page: Page, rotulo: string, testInfo: TestInfo): Promise<void> {
  if (larguraDoProject(testInfo) >= LARGURA_STEPPER_LATERAL) {
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

/**
 * Toda consulta à API responde vazia, menos o catálogo de regras de desempate e o de fatos do
 * candidato. A rota genérica é registrada primeiro porque o Playwright consulta as rotas da mais
 * recente para a mais antiga.
 */
async function mockarApi(page: Page): Promise<void> {
  await responder(page, /\/api\//, []);
  await responder(page, /\/api\/configuracao\/fatos-candidato(\?.*)?$/, FATOS_DO_CANDIDATO);

  await page.route(/\/api\/selecao\/regras-catalogo(\?.*)?$/, async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    const tipo = new URL(route.request().url()).searchParams.get('tipo') ?? '';
    await responderCom(route, tipo === 'criterio_desempate' ? REGRAS_DE_DESEMPATE : []);
  });
}

async function responder(page: Page, rota: RegExp, corpo: unknown): Promise<void> {
  await page.route(rota, async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    await responderCom(route, corpo);
  });
}

async function responderCom(route: Route, corpo: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: CORS_HEADERS,
    body: JSON.stringify(corpo),
  });
}
