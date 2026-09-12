import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * O que a reformulação do eixo fase → etapa habilita, exercitado de ponta a ponta na
 * tela: qualquer fase se subdivide em etapas, e cada etapa declara o que publica e que
 * recursos admite.
 *
 * O CI do frontend sobe Keycloak, mas não a API: os catálogos são materializados por
 * rota, e o `PUT /etapas` é interceptado para conferir o comando que a tela monta — que
 * é o contrato de verdade entre as duas pontas.
 */

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, accept, content-type, idempotency-key, if-match',
};

const TIPOS_PROCESSO = [
  { id: '01960000-0000-7000-0000-000000000515', codigo: 'SISU', nome: 'SISU',
    descricao: null, ativo: true, criadoEm: '2026-08-11T00:00:00Z' },
] as const;

/** Habilitação: uma fase que o cadastro NÃO marca como agrupadora de etapas. */
const FASES_CANONICAS = [
  { id: '01960000-0000-7000-0000-0000000000d1', codigo: 'HABILITACAO', nome: 'Habilitação',
    descricao: null, donoTipico: 'CRCA', agrupaEtapas: false, permiteComplementacao: false,
    baseLegal: null, coletaInscricao: false, origemData: 'PROPRIA',
    criadoEm: '2026-08-30T12:00:00Z' },
] as const;

const TIPOS_ETAPA = [
  { id: '01960000-0000-7000-0000-0000000000e1', codigo: 'ANALISE_DOCUMENTAL',
    nome: 'Análise Documental', descricao: null, ativo: true },
] as const;

const TIPOS_ATO = [
  { id: '01960000-0000-7000-0000-0000000000a1', codigo: 'RESULTADO_PRELIMINAR',
    nome: 'Resultado preliminar', congelaConfiguracao: false, unicoPorObjeto: false,
    efeitoIrreversivel: false, ehResultado: true, vigenciaInicio: '2020-01-01',
    vigenciaFim: null, baseLegal: null },
  { id: '01960000-0000-7000-0000-0000000000a2', codigo: 'RESULTADO_FINAL',
    nome: 'Resultado final', congelaConfiguracao: false, unicoPorObjeto: false,
    efeitoIrreversivel: false, ehResultado: true, vigenciaInicio: '2020-01-01',
    vigenciaFim: null, baseLegal: null },
] as const;

const CATEGORIAS_DOCUMENTO = [
  { id: '01960000-0000-7000-0000-0000000000c1', codigo: 'RENDA', nome: 'Comprovação de renda',
    descricao: null, ativo: true },
] as const;

const TIPOS_DOCUMENTO = [
  { id: '01960000-0000-7000-0000-0000000000b1', codigo: 'CONTRACHEQUE', nome: 'Contracheque',
    descricao: null, categoria: 'RENDA', tipoEquivalente: null, ativo: true,
    formatosAceitos: null, criadoEm: '2026-08-30T12:00:00Z' },
] as const;

const REGRAS_RECURSO = [
  { codigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO', versao: 'v1', tipo: 'regra_prazo_recurso',
    esquemaArgs: {}, invariantes: {}, baseLegal: 'Lei 9.784/1999, art. 59',
    hash: 'abc', modalidadesAdmitidas: null },
] as const;

test.describe('Etapa da fase — o que ela publica e que recurso admite', () => {
  test.beforeEach(async ({ page }) => {
    await mockarCatalogos(page);
    await page.goto('/processo-seletivo/novo');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Cronograma' }).first().click();
    await expect(page.getByLabel('Fase do catálogo')).toBeVisible();

    await page.getByLabel('Fase do catálogo').selectOption({ label: 'Habilitação' });
    await page.getByRole('button', { name: 'Acrescentar à linha do tempo' }).click();
  });

  /**
   * Antes do vínculo, só a fase que o cadastro marcava como agrupadora recebia etapa —
   * e a habilitação com oito etapas, que todas as planilhas do CEPS descrevem, não tinha
   * onde existir.
   */
  test('fase não agrupadora recebe etapa', async ({ page }) => {
    await page.getByRole('button', { name: 'Acrescentar etapa nesta fase' }).click();

    await expect(page.getByLabel('Nome', { exact: true }).last()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'O que esta etapa publica' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Quem julga esta etapa' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recursos que esta etapa admite' })).toBeVisible();
  });

  /** Só ato que o catálogo marca como resultado recebe papel no ciclo recursal. */
  test('a etapa declara o que publica, com papel', async ({ page }) => {
    await page.getByRole('button', { name: 'Acrescentar etapa nesta fase' }).click();

    const bloco = blocoDaEtapa(page, 'O que esta etapa publica');
    await bloco.getByRole('button', { name: 'Acrescentar publicação' }).click();
    await bloco.getByLabel('Ato').selectOption('RESULTADO_PRELIMINAR');
    await bloco.getByLabel('Papel').selectOption('PRELIMINAR');

    await expect(bloco.getByLabel('Ato')).toHaveValue('RESULTADO_PRELIMINAR');
    await expect(bloco.getByLabel('Papel')).toHaveValue('PRELIMINAR');
  });

  /**
   * O caso que uma regra por fase tornava inexprimível: a mesma etapa abre duas janelas,
   * com prazos e relógios distintos — uma contra o que ela publica, outra contra a
   * decisão individual que alcança cada candidato.
   */
  test('a etapa abre duas janelas recursais com prazos distintos', async ({ page }) => {
    await page.getByRole('button', { name: 'Acrescentar etapa nesta fase' }).click();

    // Duas publicações preliminares: é contra cada uma que uma janela corre.
    const publica = blocoDaEtapa(page, 'O que esta etapa publica');
    await publica.getByRole('button', { name: 'Acrescentar publicação' }).click();
    await publica.getByLabel('Ato').nth(0).selectOption('RESULTADO_PRELIMINAR');
    await publica.getByLabel('Papel').nth(0).selectOption('PRELIMINAR');
    await publica.getByRole('button', { name: 'Acrescentar publicação' }).click();
    await publica.getByLabel('Ato').nth(1).selectOption('RESULTADO_FINAL');
    await publica.getByLabel('Papel').nth(1).selectOption('PRELIMINAR');

    const recursos = blocoDaEtapa(page, 'Recursos que esta etapa admite');
    await recursos.getByRole('button', { name: 'Acrescentar recurso' }).click();
    await recursos.getByLabel('Prazo', { exact: true }).nth(0).fill('24');
    await recursos.getByLabel('Unidade').nth(0).selectOption('horas');

    await recursos.getByRole('button', { name: 'Acrescentar recurso' }).click();
    await recursos.getByLabel('Contra qual publicação').nth(1).selectOption('RESULTADO_FINAL');
    await recursos.getByLabel('Prazo', { exact: true }).nth(1).fill('2');
    await recursos.getByLabel('Unidade').nth(1).selectOption('diasUteis');

    await expect(recursos.getByLabel('Prazo', { exact: true }).nth(0)).toHaveValue('24');
    await expect(recursos.getByLabel('Unidade').nth(0)).toHaveValue('horas');
    await expect(recursos.getByLabel('Contra qual publicação').nth(0)).toHaveValue('RESULTADO_PRELIMINAR');
    await expect(recursos.getByLabel('Prazo', { exact: true }).nth(1)).toHaveValue('2');
    await expect(recursos.getByLabel('Unidade').nth(1)).toHaveValue('diasUteis');
    await expect(recursos.getByLabel('Contra qual publicação').nth(1)).toHaveValue('RESULTADO_FINAL');
  });

  /**
   * A habilitação do certame regional tem oito etapas e cada uma pede o seu comprovante.
   * Sem dizer qual delas coleta, os oito documentos apareceriam nas oito.
   *
   * A etapa ainda não gravada aparece sem poder ser escolhida: a exigência a referencia
   * pelo identificador que o servidor atribui, e ele só existe depois da gravação. O
   * rótulo diz isso em vez de deixar a opção falhar em silêncio.
   */
  test('o documento aponta a etapa da fase que o coleta', async ({ page }) => {
    await page.getByRole('button', { name: 'Acrescentar etapa nesta fase' }).click();
    await page.getByLabel('Nome', { exact: true }).last().fill('Envio dos comprovantes de renda');

    await page.getByLabel('Documento a exigir').selectOption({ label: 'Contracheque' });
    await page.getByRole('button', { name: 'Acrescentar documento' }).click();

    const coletadoEm = page.getByLabel('Coletado em');
    await expect(coletadoEm).toHaveValue('');
    await expect(coletadoEm).toContainText('Envio dos comprovantes de renda');
    await expect(coletadoEm).toContainText('grave o passo para poder escolher');
  });

  /** A fase que não se subdivide não tem onde coletar senão ela própria. */
  test('fase sem etapa não oferece onde coletar', async ({ page }) => {
    await page.getByLabel('Documento a exigir').selectOption({ label: 'Contracheque' });
    await page.getByRole('button', { name: 'Acrescentar documento' }).click();

    await expect(page.getByText('Contracheque')).toBeVisible();
    await expect(page.getByLabel('Coletado em')).toHaveCount(0);
  });

  /** A ciência não tem publicação a apontar: o campo do ato sai junto com ela. */
  test('recurso por ciência individual não pede publicação-âncora', async ({ page }) => {
    await page.getByRole('button', { name: 'Acrescentar etapa nesta fase' }).click();
    const recursos = blocoDaEtapa(page, 'Recursos que esta etapa admite');
    await recursos.getByRole('button', { name: 'Acrescentar recurso' }).click();

    await expect(recursos.getByLabel('Contra qual publicação')).toBeVisible();

    await recursos.getByLabel('O prazo corre de').selectOption('cienciaIndividual');

    await expect(recursos.getByLabel('Contra qual publicação')).toHaveCount(0);
  });
});

/**
 * O bloco da ETAPA, não o da fase: a configuração da fase vive na mesma tela e tem campos
 * de rótulo idêntico — `Ato`, `Papel` —, então o escopo é o que separa os dois.
 */
function blocoDaEtapa(page: Page, titulo: string) {
  return page.locator('.etapa-publica').filter({ hasText: titulo }).first();
}

async function mockarCatalogos(page: Page): Promise<void> {
  await responder(page, /\/api\/configuracao\/tipos-processo(\?.*)?$/, TIPOS_PROCESSO);
  await responder(page, /\/api\/configuracao\/fases-canonicas(\?.*)?$/, FASES_CANONICAS);
  await responder(page, /\/api\/configuracao\/precedencias-fase(\?.*)?$/, []);
  await responder(page, /\/api\/configuracao\/tipos-banca(\?.*)?$/, []);
  await responder(page, /\/api\/configuracao\/categorias-documento(\?.*)?$/, CATEGORIAS_DOCUMENTO);
  await responder(page, /\/api\/configuracao\/tipos-etapa(\?.*)?$/, TIPOS_ETAPA);
  await responder(page, /\/api\/configuracao\/tipos-documento(\?.*)?$/, TIPOS_DOCUMENTO);
  await responder(page, /\/api\/publicacoes\/tipos-ato(\?.*)?$/, TIPOS_ATO);

  await page.route(/\/api\/selecao\/regras-catalogo(\?.*)?$/, async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }

    const tipo = new URL(route.request().url()).searchParams.get('tipo');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS,
      body: JSON.stringify(tipo === 'regra_prazo_recurso' ? REGRAS_RECURSO : []),
    });
  });
}

async function responder(page: Page, rota: RegExp, itens: readonly unknown[]): Promise<void> {
  await page.route(rota, async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS,
      body: JSON.stringify(itens),
    });
  });
}
