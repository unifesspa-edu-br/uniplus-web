import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';
import { runAxeWcagAA } from '@uniplus/shared-e2e';
import type { AxeResults } from 'axe-core';
import {
  FUNDAMENTOS_DE_ISENCAO,
  PROCESSO_PUBLICADO_DA_MEDICINA,
  TIPOS_DE_PROCESSO,
} from '../fixtures/consulta-da-medicina';
import { blocosColados } from '../support/ritmo-vertical';
import { medirTransbordoHorizontal } from '../support/rolagem-do-editor';

type DsTheme = 'light' | 'dark' | 'contrast';
type Status = 'rascunho' | 'publicado';

/** Abaixo desta largura o stepper lateral dá lugar à barra com diálogo. */
const LARGURA_STEPPER_LATERAL = 768;

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, accept',
};

/** As formas de ancorar a apuração da idade, cada uma com os campos que traz à tela. */
const ANCORAS = [
  { valor: 'DATA_ESPECIFICA', rotulo: 'Uma data fixa' },
  { valor: 'FIM_INSCRICAO', rotulo: 'O fim do período de inscrição' },
  { valor: 'INICIO_FASE', rotulo: 'O início de uma fase' },
  { valor: 'FIM_FASE', rotulo: 'O fim de uma fase' },
  { valor: '', rotulo: 'Não apura idade' },
] as const;

/**
 * Matriz do Uni+ DS para o editor do passo Formulários, com o processo da Medicina 2027 em
 * rascunho: o editor de formulário compartilhado (título, etapas, campos e termos) e a apuração da
 * idade em cada âncora.
 *
 * A consulta do mesmo passo (processo publicado, lido como texto) é coberta por
 * `consulta-como-texto.ds-matrix.spec.ts`, e os alertas de incoerência com o desempate por
 * `desempate-por-idade.ds-matrix.spec.ts`; aqui fica o que é do editor.
 *
 * O CI do frontend sobe Keycloak, mas não a API: o processo e os catálogos são servidos por rota,
 * e toda outra consulta responde vazia.
 */
test.describe('Formulários — editor, matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await abrirFormulario(page, testInfo);
  });

  /**
   * A asserção é sobre a coleção inteira. `impact` é severidade do axe, não nível de
   * conformidade: filtrar por ele deixaria passar violação de WCAG 2.1 AA classificada como
   * moderada.
   */
  test('não viola WCAG 2.1 AA', async ({ page }) => {
    expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);
  });

  test('é editável: título e apuração da idade são controles com rótulo', async ({ page }) => {
    await expect(page.getByLabel('Título do formulário', { exact: true })).toBeEditable();
    await expect(page.getByLabel('Apurar a idade em', { exact: true })).toBeEnabled();
  });

  test('não transborda na horizontal', async ({ page }) => {
    const transbordo = await medirTransbordoHorizontal(page);

    expect(transbordo.documento).toBeLessThanOrEqual(1);
    expect(transbordo.areaDeTrabalho).toBeLessThanOrEqual(1);
  });

  test('separa título, alerta e dica do bloco vizinho', async ({ page }) => {
    expect(await blocosColados(page)).toEqual([]);
  });

  for (const ancora of ANCORAS) {
    test(`apuração da idade em "${ancora.rotulo}": sem violação e sem transbordo`, async ({
      page,
    }) => {
      await page.getByLabel('Apurar a idade em', { exact: true }).selectOption(ancora.valor);

      expect(identificadoresDe(await runAxeWcagAA(page))).toEqual([]);

      const transbordo = await medirTransbordoHorizontal(page);
      expect(transbordo.documento).toBeLessThanOrEqual(1);
      expect(transbordo.areaDeTrabalho).toBeLessThanOrEqual(1);
      expect(await blocosColados(page)).toEqual([]);
    });
  }
});

async function abrirFormulario(page: Page, testInfo: TestInfo): Promise<void> {
  await mockarApi(page, 'rascunho');
  await instalarPreferencia(page, temaDoProject(testInfo.project.name));
  await page.goto(`/processo-seletivo/${PROCESSO_PUBLICADO_DA_MEDICINA.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await irAoPasso(page, 'Formulários', testInfo);
  // O wizard mantém os passos montados; o título diz qual deles está aberto.
  await expect(page.getByRole('heading', { level: 1, name: /^Passo 11:/ })).toBeVisible();
  await expect(page.getByLabel('Apurar a idade em', { exact: true })).toBeVisible();
}

function larguraDoProject(testInfo: TestInfo): number {
  const largura = testInfo.project.use.viewport?.width;
  if (largura === undefined) {
    throw new Error(`Project ${testInfo.project.name} não declara viewport.`);
  }
  return largura;
}

/**
 * Abaixo de 768 px o stepper lateral dá lugar à barra de etapas com diálogo, e o caminho
 * até um passo muda com ele.
 */
async function irAoPasso(page: Page, rotulo: string, testInfo: TestInfo): Promise<void> {
  if (larguraDoProject(testInfo) >= LARGURA_STEPPER_LATERAL) {
    await page.locator('.wiz-nav').getByRole('button', { name: rotulo }).click();
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
 * O processo e os catálogos que os passos lidos consultam. Toda outra consulta à API
 * responde vazia: os outros passos também carregam catálogos ao abrir o processo, e sem a
 * API no CI eles falhariam por conexão recusada.
 *
 * A rota genérica é registrada primeiro porque o Playwright consulta as rotas da mais
 * recente para a mais antiga.
 */
async function mockarApi(page: Page, status: Status): Promise<void> {
  await responder(page, /\/api\//, []);
  await responder(page, /\/api\/configuracao\/tipos-processo(\?.*)?$/, TIPOS_DE_PROCESSO);
  await responder(page, /\/api\/selecao\/fundamentos-isencao(\?.*)?$/, FUNDAMENTOS_DE_ISENCAO);

  const processo = new RegExp(
    `/api/selecao/processos-seletivos/${PROCESSO_PUBLICADO_DA_MEDICINA.id}`,
  );
  await page.route(processo, async (route: Route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    const caminho = new URL(request.url()).pathname;
    if (caminho.endsWith(PROCESSO_PUBLICADO_DA_MEDICINA.id)) {
      await responderCom(route, { ...PROCESSO_PUBLICADO_DA_MEDICINA, status });
      return;
    }
    if (caminho.endsWith('/documentos-edital')) {
      await responderCom(route, []);
      return;
    }
    await route.fulfill({ status: 404, headers: CORS_HEADERS });
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
