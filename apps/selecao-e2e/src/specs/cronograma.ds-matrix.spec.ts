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

const FASES_CANONICAS = [
  {
    id: '01960000-0000-7000-0000-0000000000c1',
    codigo: 'COLETA_INSCRICAO',
    nome: 'Inscrição',
    descricao: null,
    donoTipico: 'CEPS',
    agrupaEtapas: false,
    permiteComplementacao: false,
    baseLegal: null,
    coletaInscricao: true,
    origemData: 'PROPRIA',
    criadoEm: '2026-08-30T12:00:00Z',
  },
] as const;

/** O catálogo não tem `nome` nem `descricao` — só `codigo` e `baseLegal` são legíveis. */
const REGRAS_CONTAGEM = [
  {
    codigo: 'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL',
    versao: 'v1',
    tipo: 'algoritmo_contagem_prazo',
    esquemaArgs: {},
    invariantes: {},
    baseLegal: 'Lei 9.784/1999, art. 66',
    hash: 'xyz',
    modalidadesAdmitidas: null,
  },
] as const;

const ROTULO_CONVENCAO = 'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL (v1) — Lei 9.784/1999, art. 66';

/**
 * Matriz do Uni+ DS para o passo Cronograma, com foco no seletor da convenção
 * de contagem de prazo (#480): a única superfície nova do passo.
 *
 * O axe roda com a convenção ausente — o estado padrão de um rascunho — e com
 * ela declarada, porque CA-05 promete que nenhuma opção vem pré-selecionada e
 * isso não pode se confirmar só no estado cheio.
 *
 * O CI do frontend sobe Keycloak, mas não a API: os catálogos que a tela
 * consulta são materializados por rota, o que mantém o cenário determinístico.
 */
test.describe('Cronograma — matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await mockarCatalogos(page);
    await instalarPreferencia(page, temaDoProject(testInfo.project.name));
    await page.goto('/processo-seletivo/novo');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await irAoPasso(page, 'Cronograma', testInfo);
    await expect(page.getByLabel('Fase do catálogo')).toBeVisible();
  });

  /**
   * A asserção é sobre a coleção inteira. `impact` é severidade do axe, não
   * nível de conformidade: filtrar por ele deixaria passar violação de WCAG
   * 2.1 AA classificada como moderada, num teste que promete o contrário.
   */
  test('não viola WCAG 2.1 AA sem convenção de contagem declarada', async ({ page }) => {
    await acrescentarFase(page);

    const resultado = await runAxeWcagAA(page);

    expect(identificadoresDe(resultado)).toEqual([]);
  });

  test('não viola WCAG 2.1 AA com a convenção de contagem declarada', async ({ page }) => {
    await acrescentarFase(page);
    await declararConvencaoDeContagem(page);

    const resultado = await runAxeWcagAA(page);

    expect(identificadoresDe(resultado)).toEqual([]);
  });

  /** CA-05: ausência é estado válido enquanto rascunho — nenhum default. */
  test('não pré-seleciona nenhuma convenção de contagem', async ({ page }) => {
    await acrescentarFase(page);

    await expect(page.getByLabel('Convenção de contagem')).toHaveValue('');
  });

  /**
   * Nome acessível do seletor pelo rótulo visível (SC 2.5.3), e o texto que o
   * catálogo entrega — código e base legal, nunca um rótulo inventado.
   */
  test('nomeia o seletor pelo rótulo visível e exibe código e base legal', async ({ page }) => {
    await acrescentarFase(page);

    await expect(page.getByLabel('Convenção de contagem')).toBeVisible();
    await expect(page.locator('#cr-algoritmo-contagem')).toContainText(ROTULO_CONVENCAO);
  });

  test('não transborda horizontalmente', async ({ page }) => {
    await acrescentarFase(page);

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

/** Acrescenta a única fase do catálogo à linha do tempo. */
async function acrescentarFase(page: Page): Promise<void> {
  await page.getByLabel('Fase do catálogo').selectOption({ label: 'Inscrição' });
  await page.getByRole('button', { name: 'Acrescentar à linha do tempo' }).click();
}

/** Declara a única convenção de contagem que o catálogo do cenário oferece. */
async function declararConvencaoDeContagem(page: Page): Promise<void> {
  await page.getByLabel('Convenção de contagem').selectOption({ label: ROTULO_CONVENCAO });
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

/**
 * Os catálogos que a linha do tempo e o seletor de convenção consultam. Vazio
 * onde a tela não precisa da lista, com conteúdo onde ela é o que se exercita.
 *
 * `regras-catalogo` é filtrado por `tipo`: só `algoritmo_contagem_prazo`
 * devolve conteúdo — é a única dimensão que este passo exercita aqui, e
 * devolver a mesma lista para qualquer tipo mascararia um filtro quebrado.
 */
async function mockarCatalogos(page: Page): Promise<void> {
  await responderCatalogo(page, /\/api\/configuracao\/tipos-processo(\?.*)?$/, TIPOS_PROCESSO);
  await responderCatalogo(page, /\/api\/configuracao\/fases-canonicas(\?.*)?$/, FASES_CANONICAS);
  await responderCatalogo(page, /\/api\/configuracao\/precedencias-fase(\?.*)?$/, []);
  await responderCatalogo(page, /\/api\/configuracao\/tipos-banca(\?.*)?$/, []);
  await responderCatalogo(page, /\/api\/configuracao\/categorias-documento(\?.*)?$/, []);
  await responderCatalogo(page, /\/api\/configuracao\/tipos-etapa(\?.*)?$/, []);
  await responderCatalogo(page, /\/api\/publicacoes\/tipos-ato(\?.*)?$/, []);
  await mockarRegrasCatalogo(page);
}

async function mockarRegrasCatalogo(page: Page): Promise<void> {
  await page.route(/\/api\/selecao\/regras-catalogo(\?.*)?$/, async (route: Route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    const tipo = new URL(request.url()).searchParams.get('tipo');
    const itens = tipo === 'algoritmo_contagem_prazo' ? REGRAS_CONTAGEM : [];

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS_HEADERS,
      body: JSON.stringify(itens),
    });
  });
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
