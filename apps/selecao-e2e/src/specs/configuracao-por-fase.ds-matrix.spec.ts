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
    id: '01960000-0000-7000-0000-0000000000c2',
    codigo: 'HETEROIDENTIFICACAO',
    nome: 'Heteroidentificação',
    descricao: null,
    donoTipico: 'CEPS',
    agrupaEtapas: false,
    permiteComplementacao: false,
    baseLegal: null,
    coletaInscricao: false,
    origemData: 'PROPRIA',
    criadoEm: '2026-08-30T12:00:00Z',
  },
] as const;

const TIPOS_BANCA = [
  {
    id: '01960000-0000-7000-0000-0000000000b1',
    codigo: 'HETEROIDENTIFICACAO',
    nome: 'Banca de heteroidentificação',
    faseTipica: 'HETEROIDENTIFICACAO',
    descricao: null,
    criadoEm: '2026-08-30T12:00:00Z',
  },
] as const;

const CATEGORIAS_DOCUMENTO = [
  {
    id: '01960000-0000-7000-0000-0000000000d1',
    codigo: 'RACA_ETNIA',
    nome: 'Raça e etnia',
    descricao: null,
    ordem: 1,
    criadoEm: '2026-08-30T12:00:00Z',
  },
  {
    id: '01960000-0000-7000-0000-0000000000d2',
    codigo: 'RENDA',
    nome: 'Renda',
    descricao: null,
    ordem: 2,
    criadoEm: '2026-08-30T12:00:00Z',
  },
] as const;

const TIPOS_ATO = [
  {
    id: '01960000-0000-7000-0000-0000000000a1',
    codigo: 'RESULTADO_PRELIMINAR',
    nome: 'Resultado preliminar',
    congelaConfiguracao: false,
    unicoPorObjeto: false,
    efeitoIrreversivel: false,
    ehResultado: true,
    vigenciaInicio: '2020-01-01',
    vigenciaFim: null,
    baseLegal: null,
    criadoEm: '2026-08-30T12:00:00Z',
  },
  {
    id: '01960000-0000-7000-0000-0000000000a2',
    codigo: 'RESULTADO_DEFINITIVO',
    nome: 'Resultado definitivo',
    congelaConfiguracao: false,
    unicoPorObjeto: false,
    efeitoIrreversivel: false,
    ehResultado: true,
    vigenciaInicio: '2020-01-01',
    vigenciaFim: null,
    baseLegal: null,
    criadoEm: '2026-08-30T12:00:00Z',
  },
] as const;

const REGRAS_RECURSO = [
  {
    codigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
    versao: 'v1',
    tipo: 'regra_prazo_recurso',
    esquemaArgs: {},
    invariantes: {},
    baseLegal: 'Lei 9.784/1999, art. 59',
    hash: 'a1b2c3',
    modalidadesAdmitidas: null,
  },
] as const;

/**
 * Matriz do Uni+ DS para a superfície de configuração por fase.
 *
 * A tela é toda formulário — seletores em laço, caixas de seleção agrupadas,
 * mensagem de erro por campo — e é onde uma violação de rótulo ou de contraste
 * escapa da inspeção do template. O axe roda sobre a superfície preenchida e
 * sobre ela em estado recusado, porque a mensagem de erro tem papel e cor
 * próprios: no tema de contraste, é ali que uma violação passaria sem ser vista.
 *
 * O CI do frontend sobe Keycloak, mas não a API: os catálogos que a tela
 * consulta são materializados por rota, o que mantém o cenário determinístico.
 */
test.describe('Configuração por fase — matriz DS @ds', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await mockarCatalogos(page);
    await instalarPreferencia(page, temaDoProject(testInfo.project.name));
    await page.goto('/processo-seletivo/novo');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await irAoPasso(page, 'Cronograma', testInfo);
    await acrescentarFase(page);
    await irAoPasso(page, 'Config. por fase', testInfo);
    await expect(page.getByLabel('Fase a configurar')).toBeVisible();
  });

  /**
   * A asserção é sobre a coleção inteira. `impact` é severidade do axe, não
   * nível de conformidade: filtrar por ele deixaria passar violação de WCAG
   * 2.1 AA classificada como moderada, num teste que promete o contrário.
   */
  test('não viola WCAG 2.1 AA com a fase inteira declarada', async ({ page }) => {
    await declararPublicacao(page, 'Resultado definitivo');
    await ligarRecursoComBanca(page);

    const resultado = await runAxeWcagAA(page);

    expect(identificadoresDe(resultado)).toEqual([]);
  });

  /**
   * Estado recusado: a fase publica preliminar sem a definitiva da matéria, e a
   * conferência cobra quem conclui o ciclo recursal. O que interessa aqui é a
   * mensagem — ela precisa existir com papel de alerta e passar no contraste.
   */
  test('não viola WCAG 2.1 AA com a conferência acusando', async ({ page }) => {
    await declararPublicacao(page, 'Resultado preliminar');
    await expect(page.getByRole('alert').first()).toBeVisible();

    const resultado = await runAxeWcagAA(page);

    expect(identificadoresDe(resultado)).toEqual([]);
  });

  /**
   * Todo campo da superfície é alcançável pelo nome que o operador lê. É o que
   * um leitor de tela anuncia e o que o comando de voz precisa casar (SC 2.5.3);
   * um `getByLabel` que não encontra é rótulo solto no DOM.
   */
  test('nomeia cada campo da fase pelo rótulo visível', async ({ page }) => {
    await declararPublicacao(page, 'Resultado definitivo');
    await ligarRecursoComBanca(page);

    await expect(page.getByLabel('Fase a configurar')).toBeVisible();
    await expect(page.getByLabel('Publicação', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Papel', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Cabe recurso do que esta fase publica')).toBeVisible();
    await expect(page.getByLabel('Prazo de interposição')).toBeVisible();
    await expect(page.getByLabel('Unidade do prazo')).toBeVisible();
    await expect(page.getByLabel('Tipo de banca')).toBeVisible();
    await expect(page.getByLabel('Raça e etnia')).toBeVisible();
  });

  /**
   * O erro de um campo é anunciado, não só desenhado: `role="alert"` é o que
   * leva a recusa ao leitor de tela sem que ele precise varrer a página.
   */
  test('anuncia a recusa da conferência no campo que a provocou', async ({ page }) => {
    await declararPublicacao(page, 'Resultado preliminar');

    await expect(page.getByRole('alert').filter({ hasText: 'ciclo recursal' })).toBeVisible();
  });

  test('não transborda horizontalmente', async ({ page }) => {
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
  await page.getByLabel('Fase do catálogo').selectOption({ label: 'Heteroidentificação' });
  await page.getByRole('button', { name: 'Acrescentar à linha do tempo' }).click();
}

/** Declara uma publicação da fase aberta, com o papel que o nome do ato indica. */
async function declararPublicacao(page: Page, ato: string): Promise<void> {
  await page.getByRole('button', { name: 'Acrescentar publicação' }).click();
  await page.getByLabel('Publicação', { exact: true }).selectOption({ label: ato });
  await page
    .getByLabel('Papel', { exact: true })
    .selectOption({
      label: ato === 'Resultado preliminar' ? 'Resultado preliminar' : 'Resultado definitivo',
    });
}

/** Liga o recurso e requer uma banca com recorte — o estado mais cheio da tela. */
async function ligarRecursoComBanca(page: Page): Promise<void> {
  await page.getByLabel('Cabe recurso do que esta fase publica').check();
  await page.getByLabel('Prazo de interposição').fill('2');
  await page.getByLabel('Unidade do prazo').selectOption({ label: 'dias úteis' });

  await page.getByRole('button', { name: 'Acrescentar banca' }).click();
  await page.getByLabel('Tipo de banca').selectOption({ label: 'Banca de heteroidentificação' });
  await page.getByLabel('Raça e etnia').check();
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
 * Os catálogos que a linha do tempo e a superfície da fase consultam. Vazio
 * onde a tela não precisa da lista, com conteúdo onde ela é o que se exercita.
 */
async function mockarCatalogos(page: Page): Promise<void> {
  await responderCatalogo(page, /\/api\/configuracao\/tipos-processo(\?.*)?$/, TIPOS_PROCESSO);
  await responderCatalogo(page, /\/api\/configuracao\/fases-canonicas(\?.*)?$/, FASES_CANONICAS);
  await responderCatalogo(page, /\/api\/configuracao\/precedencias-fase(\?.*)?$/, []);
  await responderCatalogo(page, /\/api\/configuracao\/tipos-banca(\?.*)?$/, TIPOS_BANCA);
  await responderCatalogo(
    page,
    /\/api\/configuracao\/categorias-documento(\?.*)?$/,
    CATEGORIAS_DOCUMENTO,
  );
  await responderCatalogo(page, /\/api\/configuracao\/tipos-etapa(\?.*)?$/, []);
  await responderCatalogo(page, /\/api\/publicacoes\/tipos-ato(\?.*)?$/, TIPOS_ATO);
  await responderCatalogo(page, /\/api\/selecao\/regras-catalogo(\?.*)?$/, REGRAS_RECURSO);
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
