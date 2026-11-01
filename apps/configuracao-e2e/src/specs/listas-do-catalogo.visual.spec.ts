import { expect, test, type Locator, type Page, type Route, type TestInfo } from '@playwright/test';
import { assertReflowContract, runAxeWcagAA } from '@uniplus/shared-e2e';
import { mockConfiguracaoRuntimeConfig } from '../support/runtime-config';

type VisualTheme = 'light' | 'dark' | 'contrast';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const APROVADA = { situacao: 'APROVADA', solicitadaEm: null, decididaEm: null, classificacaoRecomendada: null, justificativa: null, aceitaEm: null };
const AJUSTE = { ...APROVADA, situacao: 'AJUSTE_RECOMENDADO', classificacaoRecomendada: 'SENSIVEL', justificativa: 'O dado revela a identidade de gênero.' };
const PENDENTE = { ...APROVADA, situacao: 'PENDENTE' };
const SOLICITADA = { ...APROVADA, situacao: 'SOLICITADA' };

const PROTECAO = {
  classificacaoProtecao: 'PESSOAL',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  finalidadeTratamento: 'Conferir o documento do candidato.',
};

const CATEGORIAS = [
  { codigo: 'IDENTIFICACAO', nome: 'Identificação' },
  { codigo: 'SAUDE', nome: 'Saúde' },
].map((categoria, indice) => ({
  id: `01990000-0000-7000-0000-00000000000${indice + 1}`,
  ...categoria,
  descricao: null,
  ordem: indice + 1,
  criadoEm: '2026-08-30T12:00:00Z',
}));

const TIPOS = [
  {
    id: '01960000-0000-7000-0000-0000000000d1',
    codigo: 'RG',
    nome: 'Registro Geral',
    descricao: 'Documento de identificação civil.',
    categoria: 'IDENTIFICACAO',
    formatosAceitos: 'pdf,jpg',
    tamanhoMaximoMb: 10,
    tipoEquivalente: 'CIN',
    criadoEm: '2026-06-10T12:00:00Z',
    protecaoAprovada: true,
    ...PROTECAO,
  },
  {
    id: '01960000-0000-7000-0000-0000000000d2',
    codigo: 'LAUDO_MEDICO',
    nome: 'Laudo médico complementar',
    descricao: null,
    categoria: 'SAUDE',
    formatosAceitos: 'pdf,jpg,png,tiff',
    tamanhoMaximoMb: null,
    tipoEquivalente: null,
    criadoEm: '2026-06-11T12:00:00Z',
    protecaoAprovada: false,
    ...PROTECAO,
    classificacaoProtecao: 'INTERNO',
  },
];

const FATOS = [
  {
    id: '01960000-0000-7000-0000-0000000000f1',
    codigo: 'IDENTIDADE_GENERO',
    nome: 'Identidade de gênero',
    descricao: 'Como o candidato se identifica.',
    componenteExibicao: null,
    dominio: 'CATEGORICO',
    origem: 'DECLARADO',
    cardinalidade: 'ESCALAR',
    fonteValores: 'GLOBAL',
    formato: null,
    pontoResolucao: 'INSCRICAO',
    binding: 'CAMPO_INSCRICAO:IDENTIDADE_GENERO',
    escopo: 'CANDIDATO',
    ...PROTECAO,
    classificacaoProtecao: 'SENSIVEL',
    sistema: false,
    ativo: true,
    valores: [
      { codigo: 'MULHER_CIS', descricao: 'Mulher cis', ordem: 1, ativo: true, orientacao: 'Marque se a identidade coincide com o sexo de nascimento.' },
      { codigo: 'HOMEM_TRANS', descricao: 'Homem trans', ordem: 2, ativo: true, orientacao: null },
    ],
    regrasPadrao: [],
    aprovacao: AJUSTE,
  },
  {
    id: '01960000-0000-7000-0000-0000000000f2',
    codigo: 'RENDA_FAMILIAR_BRUTA',
    nome: 'Renda familiar bruta',
    descricao: 'Soma da renda mensal bruta dos membros da família.',
    componenteExibicao: 'MOEDA',
    dominio: 'NUMERICO',
    origem: 'DECLARADO',
    cardinalidade: 'ESCALAR',
    fonteValores: null,
    formato: null,
    pontoResolucao: 'INSCRICAO',
    binding: 'CAMPO_INSCRICAO:RENDA',
    escopo: 'CANDIDATO',
    ...PROTECAO,
    sistema: false,
    ativo: true,
    valores: [],
    regrasPadrao: [],
    aprovacao: SOLICITADA,
  },
];

const PENDENCIAS = [
  { tipo: 'TIPO_DOCUMENTO', id: TIPOS[1].id, codigo: TIPOS[1].codigo, nome: TIPOS[1].nome, ...PROTECAO, classificacaoProtecao: 'INTERNO', aprovacao: PENDENTE },
  { tipo: 'FATO', id: FATOS[1].id, codigo: FATOS[1].codigo, nome: FATOS[1].nome, ...PROTECAO, aprovacao: PENDENTE },
];

const SOLICITADOS = PENDENCIAS.map((item) => ({ ...item, aprovacao: SOLICITADA }));

const ATO = { classificacaoRecomendada: null, justificativa: null, ...PROTECAO };

/** Os atos de cada item, em ordem cronológica, com as personas fictícias do portal. */
const ATOS_DO_TIPO = [
  { ato: 'SOLICITACAO', instante: '2026-10-29T15:00:00Z', atorNome: 'Isabella Priscila Figueiredo', ...ATO, classificacaoProtecao: 'INTERNO' },
  {
    ato: 'AJUSTE_RECOMENDADO',
    instante: '2026-10-30T13:30:00Z',
    atorNome: 'Caroline Stefany Jesus',
    ...ATO,
    classificacaoProtecao: 'INTERNO',
    classificacaoRecomendada: 'PESSOAL',
    justificativa: 'O laudo identifica o candidato e traz dado de saúde.',
  },
  { ato: 'ACEITE', instante: '2026-10-31T10:15:00Z', atorNome: 'Isabella Priscila Figueiredo', ...ATO, classificacaoProtecao: 'PESSOAL' },
];

const ATOS_DO_FATO = [
  { ato: 'SOLICITACAO', instante: '2026-10-28T14:00:00Z', atorNome: 'Isabella Priscila Figueiredo', ...ATO },
  {
    ato: 'REPROVACAO',
    instante: '2026-10-29T09:20:00Z',
    atorNome: 'Betina Marina Valentina das Neves',
    ...ATO,
    justificativa: 'A renda familiar bruta é dado pessoal que exige a finalidade declarada com mais precisão.',
  },
  { ato: 'SOLICITACAO', instante: '2026-10-30T16:45:00Z', atorNome: 'Isabella Priscila Figueiredo', ...ATO },
];

const DECISOES = [
  {
    cadastro: 'FATO',
    itemId: FATOS[1].id,
    itemCodigo: FATOS[1].codigo,
    itemNome: FATOS[1].nome,
    ...ATOS_DO_FATO[1],
  },
  {
    cadastro: 'TIPO_DOCUMENTO',
    itemId: TIPOS[1].id,
    itemCodigo: TIPOS[1].codigo,
    itemNome: TIPOS[1].nome,
    ...ATOS_DO_TIPO[1],
  },
  {
    cadastro: 'FATO',
    itemId: FATOS[0].id,
    itemCodigo: FATOS[0].codigo,
    itemNome: FATOS[0].nome,
    ato: 'APROVACAO',
    instante: '2026-10-27T11:00:00Z',
    atorNome: 'Caroline Stefany Jesus',
    ...ATO,
    classificacaoProtecao: 'SENSIVEL',
  },
];

async function json(route: Route, body: unknown): Promise<void> {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
    return;
  }
  await route.fulfill({ status: 200, contentType: 'application/json', headers: CORS_HEADERS, body: JSON.stringify(body) });
}

async function mockApi(page: Page, situacaoDaFila: 'PENDENTE' | 'SOLICITADA'): Promise<void> {
  await page.route(/\/api\/configuracao\/tipos-documento(\?.*)?$/, (route) => json(route, TIPOS));
  await page.route(/\/api\/configuracao\/categorias-documento(\?.*)?$/, (route) => json(route, CATEGORIAS));
  await page.route(/\/api\/configuracao\/admin\/fatos-candidato(\?.*)?$/, (route) => json(route, FATOS));
  await page.route(/\/api\/configuracao\/fatos-candidato(\?.*)?$/, (route) => json(route, []));
  await page.route(/\/api\/configuracao\/fases-canonicas(\?.*)?$/, (route) => json(route, []));
  await page.route(/\/api\/configuracao\/admin\/tipos-documento\/[^/?]+\/protecao\/atos$/, (route) => json(route, ATOS_DO_TIPO));
  await page.route(/\/api\/configuracao\/admin\/fatos-candidato\/[^/?]+\/protecao\/atos$/, (route) => json(route, ATOS_DO_FATO));
  await page.route(/\/api\/configuracao\/admin\/protecao-do-catalogo\/decisoes(\?.*)?$/, async (route) => {
    if (route.request().method() === 'OPTIONS') return json(route, null);
    const url = new URL(route.request().url());
    const atos = url.searchParams.getAll('ato');
    const cadastro = url.searchParams.get('cadastro');
    const busca = (url.searchParams.get('busca') ?? '').toLowerCase();
    const lista = DECISOES.filter(
      (d) =>
        (atos.length === 0 || atos.includes(d.ato)) &&
        (cadastro === null || d.cadastro === cadastro) &&
        d.itemNome.toLowerCase().includes(busca),
    );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        ...CORS_HEADERS,
        'access-control-expose-headers': 'Link',
        Link: '<http://localhost:5000/api/configuracao/admin/protecao-do-catalogo/decisoes?cursor=PROX&direction=next>; rel="next"',
      },
      body: JSON.stringify(lista),
    });
  });
  await page.route(/\/api\/configuracao\/admin\/protecao-do-catalogo\/(tipos-documento|fatos)\/[^/?]+$/, (route) => {
    const fato = route.request().url().includes('/fatos/');
    const item = PENDENCIAS.find((p) => route.request().url().endsWith(p.id)) ?? PENDENCIAS[0];
    const detalhe = fato
      ? { ...item, atos: ATOS_DO_FATO, aprovacao: SOLICITADA, descricao: 'Soma da renda mensal bruta dos membros da família.', tipoDocumento: null, fato: { dominio: 'NUMERICO', cardinalidade: 'ESCALAR', sistema: false, componenteExibicao: 'MOEDA', valores: [] } }
      : { ...item, atos: ATOS_DO_TIPO, aprovacao: SOLICITADA, descricao: 'Laudo que complementa o pedido de atendimento especializado.', fato: null, tipoDocumento: { categoria: 'SAUDE', formatosAceitos: 'pdf,jpg,png,tiff', tamanhoMaximoMb: 10 } };
    return json(route, detalhe);
  });
  await page.route(/\/api\/configuracao\/admin\/protecao-do-catalogo(\?.*)?$/, (route) => {
    const url = new URL(route.request().url());
    const fila = url.searchParams.get('situacao') === 'SOLICITADA' ? SOLICITADOS : PENDENCIAS;
    return json(route, situacaoDaFila === 'SOLICITADA' && !url.searchParams.has('situacao') ? SOLICITADOS : fila);
  });
}

function tema(testInfo: TestInfo): VisualTheme {
  return testInfo.project.metadata['theme'] as VisualTheme;
}

function ehDesktop(testInfo: TestInfo): boolean {
  return testInfo.project.metadata['viewport'] === 'desktop';
}

async function semRolagemHorizontal(page: Page, alvo: Locator): Promise<void> {
  const medidas = await alvo.evaluate((el) => ({ rola: el.scrollWidth > el.clientWidth + 1 }));
  expect(medidas.rola, 'a área não rola na horizontal').toBe(false);
  // O contrato de reflow a 320 px abre o menu e espera nenhum `dialog.uni-drawer` no DOM, o que não vale
  // para páginas que já trazem seus drawers; a ausência de estouro horizontal é conferida acima.
  if ((page.viewportSize()?.width ?? 0) > 340) await assertReflowContract(page);
}

/** Alturas das linhas da tabela principal, em pixels. */
async function alturasDasLinhas(page: Page): Promise<number[]> {
  return page.locator('.panel tbody tr').evaluateAll((linhas) => linhas.map((linha) => Math.round(linha.getBoundingClientRect().height)));
}

/**
 * Confere a lista: no desktop, as colunas, a ausência de rolagem horizontal e as alturas das linhas; no
 * cartão, que as células de cada valor aparecem e que a página não estoura a largura.
 */
async function conferirLista(
  page: Page,
  testInfo: TestInfo,
  colunas: readonly string[],
  anotacao: string,
  comAcoes = true,
): Promise<void> {
  if (!ehDesktop(testInfo)) {
    await expect(page.locator('.panel tbody tr').first().locator('td[data-label]')).toHaveCount(colunas.length + (comAcoes ? 1 : 0));
    await semRolagemHorizontal(page, page.locator('html'));
    return;
  }
  await expect(page.locator('.panel thead th')).toHaveText(comAcoes ? [...colunas, 'Ações'] : [...colunas]);
  await semRolagemHorizontal(page, page.locator('.panel .table-responsive'));
  const alturas = await alturasDasLinhas(page);
  testInfo.annotations.push({ type: anotacao, description: alturas.join(',') });
}

/** Clica no centro da célula, como a pessoa faz: o alvo estendido do botão do nome recebe o clique. */
async function clicarNaCelula(page: Page, celula: Locator): Promise<void> {
  await celula.scrollIntoViewIfNeeded();
  const caixa = await celula.boundingBox();
  expect(caixa, 'a célula está visível').not.toBeNull();
  await page.mouse.click((caixa?.x ?? 0) + (caixa?.width ?? 0) / 2, (caixa?.y ?? 0) + (caixa?.height ?? 0) / 2);
}

/** A caixa de seleção do DS fica escondida: quem recebe o clique é o rótulo que a envolve. */
function caixa(dialogo: Locator, nome: string): Locator {
  return dialogo.locator('label.checkbox').filter({ has: dialogo.page().getByRole('checkbox', { name: nome }) });
}

async function aoAbrirPeloTeclado(page: Page, nome: string, ariaDoDrawer: string): Promise<void> {
  const alvo = page.getByRole('button', { name: `Ver o detalhe de ${nome}`, exact: true });
  await alvo.focus();
  await expect(alvo).toBeFocused();
  await page.keyboard.press('Enter');
  const drawer = page.getByRole('dialog', { name: ariaDoDrawer });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('heading', { name: nome, level: 2 })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(alvo).toBeFocused();
}

test.describe('Listas do catálogo — linha clicável e detalhe no drawer', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const dsTheme = tema(testInfo);
    await mockConfiguracaoRuntimeConfig(page);
    await page.addInitScript((valor: VisualTheme) => {
      window.localStorage.setItem(
        'uniplus.a11y',
        JSON.stringify({ theme: valor === 'contrast' ? 'auto' : valor, contrast: valor === 'contrast', fontMode: 'default' }),
      );
    }, dsTheme);
    await mockApi(page, 'PENDENTE');
  });

  test('Tipo de Documento: colunas, linha de uma só linha, abertura por clique e teclado', async ({ page }, testInfo) => {
    await page.goto('/tipos-documento');
    await expect(page.getByRole('heading', { name: 'Tipo de Documento', level: 1 })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', tema(testInfo));
    await conferirLista(
      page,
      testInfo,
      ['Código', 'Nome', 'Categoria', 'Formatos aceitos', 'Sensibilidade', 'Situação'],
      'altura-das-linhas-tipos-documento',
    );

    // Clicar em qualquer ponto da linha abre o detalhe; a ação da linha não.
    const linha = page.locator('.panel tbody tr').first();
    await clicarNaCelula(page, linha.locator('td[data-label="Categoria"]'));
    const drawer = page.getByRole('dialog', { name: 'Detalhe do tipo de documento' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('heading', { name: 'Registro Geral', level: 2 })).toBeFocused();
    await expect(drawer.getByText('Documento de identificação civil.')).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Editar' })).toBeVisible();
    const axe = await runAxeWcagAA(page);
    expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('tipos-documento-drawer.png') });
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();

    await page.getByRole('button', { name: 'Editar tipo de documento RG', exact: true }).click();
    const formulario = page.getByRole('dialog', { name: 'Formulário de tipo de documento' });
    await expect(formulario).toBeVisible();
    await expect(drawer).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(formulario).toBeHidden();

    await aoAbrirPeloTeclado(page, 'Registro Geral', 'Detalhe do tipo de documento');
  });

  test('Tipo de Documento: abre e fecha pelo teclado, com o foco no título e de volta ao nome', async ({ page }) => {
    await page.goto('/tipos-documento');
    await expect(page.getByRole('heading', { name: 'Tipo de Documento', level: 1 })).toBeVisible();
    await aoAbrirPeloTeclado(page, 'Registro Geral', 'Detalhe do tipo de documento');
  });

  test('Tipo de Documento: Editar a partir do detalhe devolve o foco à linha ao fechar', async ({ page }) => {
    await page.goto('/tipos-documento');
    const alvo = page.getByRole('button', { name: 'Ver o detalhe de Registro Geral', exact: true });
    await alvo.click();
    await page.getByRole('dialog', { name: 'Detalhe do tipo de documento' }).getByRole('button', { name: 'Editar' }).click();
    const edicao = page.getByRole('dialog', { name: 'Formulário de tipo de documento' });
    await expect(edicao).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(edicao).toBeHidden();
    await expect(alvo).toBeFocused();
  });

  test('Fato do Candidato: colunas, linha de uma só linha e detalhe com valores e orientação', async ({ page }, testInfo) => {
    await page.goto('/fatos-candidato');
    await expect(page.getByRole('heading', { name: 'Fato do Candidato', level: 1 })).toBeVisible();
    await conferirLista(
      page,
      testInfo,
      ['Código', 'Nome', 'Origem', 'Tipo de dado', 'Situação', 'Sensibilidade', 'Aprovação'],
      'altura-das-linhas-fatos',
    );

    await clicarNaCelula(page, page.locator('.panel tbody tr').first().locator('td[data-label="Origem"]'));
    const drawer = page.getByRole('dialog', { name: 'Detalhe do fato do candidato' });
    await expect(drawer.getByRole('heading', { name: 'Identidade de gênero', level: 2 })).toBeFocused();
    await expect(drawer.getByText('Marque se a identidade coincide com o sexo de nascimento.')).toBeVisible();
    await expect(drawer.getByText('Classificação recomendada: Pessoal sensível')).toBeVisible();
    await expect(drawer.getByText('Justificativa: O dado revela a identidade de gênero.')).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Aceitar recomendação' })).toBeVisible();
    const axe = await runAxeWcagAA(page);
    expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('fatos-drawer.png') });
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();

    await aoAbrirPeloTeclado(page, 'Identidade de gênero', 'Detalhe do fato do candidato');
  });

  test('Proteção de Dados do Catálogo: lista enxuta e drawer com a proposta', async ({ page }, testInfo) => {
    await page.goto('/protecao-do-catalogo');
    await expect(page.getByRole('heading', { name: 'Proteção de Dados do Catálogo', level: 1 })).toBeVisible();
    await expect(page.locator('.page-header__desc')).not.toContainText('UNI-REQ');

    await conferirLista(page, testInfo, ['Cadastro', 'Item', 'Sensibilidade'], 'altura-das-linhas-protecao', false);
    await expect(page.locator('.panel tbody')).not.toContainText('LAUDO_MEDICO');

    await clicarNaCelula(page, page.locator('.panel tbody tr').first().locator('td').first());
    const drawer = page.getByRole('dialog', { name: 'Detalhe do item aguardando a decisão' });
    await expect(drawer.getByRole('heading', { name: 'Laudo médico complementar', level: 2 })).toBeFocused();
    await expect(drawer.getByText('Proposta de proteção')).toBeVisible();
    await expect(drawer.getByText('O que é o item')).toBeVisible();
    await expect(drawer.getByText('LAUDO_MEDICO')).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Aprovar' })).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Recomendar ajuste' })).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'Reprovar' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('protecao-drawer.png') });
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await aoAbrirPeloTeclado(page, 'Laudo médico complementar', 'Detalhe do item aguardando a decisão');
  });

  test('cartão a 320 px: sem rolagem horizontal, com o alvo estendido e o drawer na largura da tela', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 700 });
    for (const [rota, nome, ariaDoDrawer] of [
      ['/tipos-documento', 'Registro Geral', 'Detalhe do tipo de documento'],
      ['/fatos-candidato', 'Identidade de gênero', 'Detalhe do fato do candidato'],
      ['/protecao-do-catalogo', 'Laudo médico complementar', 'Detalhe do item aguardando a decisão'],
    ] as const) {
      await page.goto(rota);
      await expect(page.getByRole('button', { name: `Ver o detalhe de ${nome}`, exact: true })).toBeVisible();
      await semRolagemHorizontal(page, page.locator('html'));
      await clicarNaCelula(page, page.locator('.panel tbody tr').first().locator('td').nth(1));
      const drawer = page.getByRole('dialog', { name: ariaDoDrawer });
      await expect(drawer).toBeVisible();
      const largura = await drawer.locator('.uni-drawer__panel').evaluate((el) => el.getBoundingClientRect().width);
      expect(largura).toBeLessThanOrEqual(320);
      await semRolagemHorizontal(page, drawer.locator('.uni-drawer__body'));
      await page.screenshot({ path: testInfo.outputPath(`320-${rota.slice(1)}.png`) });
      await page.keyboard.press('Escape');
      await expect(drawer).toBeHidden();
    }
  });

  test('Proteção de Dados do Catálogo: reprovar exige a justificativa, com contador e erro associado', async ({ page }, testInfo) => {
    await page.goto('/protecao-do-catalogo');
    const drawer = page.getByRole('dialog', { name: 'Detalhe do item aguardando a decisão' });
    await page.getByRole('button', { name: 'Ver o detalhe de Laudo médico complementar', exact: true }).click();
    await expect(drawer.getByRole('button', { name: 'Reprovar' })).toBeVisible();
    await drawer.getByRole('button', { name: 'Reprovar' }).click();

    const dialogo = page.getByRole('dialog', { name: 'Reprovar a proteção de dados do item' });
    await expect(dialogo).toBeVisible();
    await expect(dialogo).not.toContainText('LAUDO_MEDICO');
    const campo = dialogo.getByRole('textbox', { name: 'Justificativa' });
    await expect(dialogo.getByText('0 de 2.000')).toBeVisible();
    await dialogo.getByRole('button', { name: 'Reprovar item' }).click();
    await expect(dialogo.getByText('Informe a justificativa da reprovação.')).toBeVisible();
    await expect(campo).toBeFocused();
    await expect(campo).toHaveAttribute('aria-invalid', 'true');
    await campo.fill('Falta a base legal.');
    await expect(dialogo.getByText('19 de 2.000')).toBeVisible();
    const axe = await runAxeWcagAA(page);
    expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('protecao-reprovar.png') });

    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    await drawer.getByRole('button', { name: 'Recomendar ajuste' }).click();
    const ajuste = page.getByRole('dialog', { name: 'Recomendar ajuste da proteção de dados' });
    await expect(ajuste.getByRole('combobox', { name: 'Classificação recomendada' })).toBeVisible();
    await expect(ajuste.getByRole('textbox', { name: 'Justificativa' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('protecao-recomendar-ajuste.png') });
  });

  test('Tipo de Documento: o drawer mostra o histórico da proteção em ordem, com quem agiu e a justificativa', async ({ page }, testInfo) => {
    await page.goto('/tipos-documento');
    await page.getByRole('button', { name: 'Ver o detalhe de Laudo médico complementar', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Detalhe do tipo de documento' });
    const secao = drawer.locator('section', { has: page.getByRole('heading', { name: 'Histórico da proteção', level: 3 }) });
    await expect(secao.locator('.cfg-atos__item')).toHaveCount(3);
    await expect(secao.locator('.cfg-atos__item').nth(0)).toContainText('Solicitação');
    await expect(secao.locator('.cfg-atos__item').nth(1)).toContainText('Ajuste recomendado');
    await expect(secao.locator('.cfg-atos__item').nth(1)).toContainText('Caroline Stefany Jesus');
    await expect(secao.locator('.cfg-atos__item').nth(1)).toContainText('Classificação recomendada: Pessoal');
    await expect(secao.locator('.cfg-atos__item').nth(1)).toContainText('O laudo identifica o candidato e traz dado de saúde.');
    await expect(secao.locator('.cfg-atos__item').nth(2)).toContainText('Aceite da recomendação');
    await expect(secao.locator('.cfg-atos__item').nth(2)).toContainText('31/10/2026');
    await semRolagemHorizontal(page, drawer.locator('.uni-drawer__body'));
    const axe = await runAxeWcagAA(page);
    expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
    await secao.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('tipos-documento-historico.png') });
  });

  test('Fato do Candidato: o drawer mostra o histórico, inclusive a reprovação que a correção não apagou', async ({ page }, testInfo) => {
    await page.goto('/fatos-candidato');
    await page.getByRole('button', { name: 'Ver o detalhe de Renda familiar bruta', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Detalhe do fato do candidato' });
    const secao = drawer.locator('section', { has: page.getByRole('heading', { name: 'Histórico da proteção', level: 3 }) });
    await expect(secao.locator('.cfg-atos__item')).toHaveCount(3);
    await expect(secao.locator('.cfg-atos__item').nth(1)).toContainText('Reprovação');
    await expect(secao.locator('.cfg-atos__item').nth(1)).toContainText('Betina Marina Valentina das Neves');
    await expect(secao.locator('.cfg-atos__item').nth(1)).toContainText('Justificativa: A renda familiar bruta');
    await semRolagemHorizontal(page, drawer.locator('.uni-drawer__body'));
    const axe = await runAxeWcagAA(page);
    expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
    await secao.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('fatos-historico.png') });
  });

  test('Proteção de Dados do Catálogo: abas, filtros na URL e lista de decisões de uma só linha', async ({ page }, testInfo) => {
    await page.goto('/protecao-do-catalogo');
    const abas = page.getByRole('group', { name: 'Mostrar' });
    await expect(abas.getByRole('button', { name: 'Aguardando decisão' })).toHaveAttribute('aria-pressed', 'true');
    await abas.getByRole('button', { name: 'Decisões' }).click();
    await expect(page).toHaveURL(/[?&]aba=decisoes/u);
    await expect(page.getByRole('heading', { name: 'Decisões registradas', level: 2 })).toBeVisible();

    await conferirLista(
      page,
      testInfo,
      ['Item', 'Cadastro', 'Decisão', 'Sensibilidade conferida', 'Data'],
      'altura-das-linhas-decisoes',
      false,
    );
    await expect(page.locator('.panel tbody tr')).toHaveCount(3);

    // Os filtros ficam na URL e a lista os respeita; o bloco recolhido resume os ativos.
    await page.getByRole('button', { name: /^Filtros/u }).click();
    await page.getByRole('button', { name: 'Reprovado', exact: true }).click();
    await expect(page).toHaveURL(/ato=REPROVACAO/u);
    await expect(page.locator('.panel tbody tr')).toHaveCount(1);
    await expect(page.locator('.panel tbody')).toContainText('Renda familiar bruta');
    await expect(page.getByRole('button', { name: 'Reprovado', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Fato do candidato', exact: true }).click();
    await expect(page).toHaveURL(/cadastro=FATO/u);
    await expect(page.getByLabel('Decidido a partir de')).toBeVisible();
    await expect(page.getByLabel('Decidido até')).toBeVisible();
    await expect(page.getByLabel('Só as minhas')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Paginação das decisões' })).toBeVisible();
    const axe = await runAxeWcagAA(page);
    expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('decisoes-filtros.png') });

    // Recarregar a página volta ao mesmo recorte.
    await page.reload();
    await expect(page.getByRole('button', { name: /^Filtros/u })).toContainText('Reprovação');
    await page.getByRole('button', { name: /^Filtros/u }).click();
    await expect(page.getByRole('button', { name: 'Reprovado', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.panel tbody tr')).toHaveCount(1);
  });

  test('Proteção de Dados do Catálogo: o drawer da decisão traz a proteção conferida e o histórico do item', async ({ page }, testInfo) => {
    await page.goto('/protecao-do-catalogo?aba=decisoes');
    await clicarNaCelula(page, page.locator('.panel tbody tr').first().locator('td[data-label="Cadastro"]'));
    const drawer = page.getByRole('dialog', { name: 'Detalhe da decisão' });
    await expect(drawer.getByRole('heading', { name: 'Renda familiar bruta', level: 2 })).toBeFocused();
    await expect(drawer.getByText('Decidido por')).toBeVisible();
    await expect(drawer.getByText('Betina Marina Valentina das Neves').first()).toBeVisible();
    await expect(drawer.getByText('Proteção conferida')).toBeVisible();
    await expect(drawer.getByRole('heading', { name: 'Histórico do item', level: 3 })).toBeVisible();
    await expect(drawer.locator('.cfg-atos__item')).toHaveCount(3);
    await semRolagemHorizontal(page, drawer.locator('.uni-drawer__body'));
    const axe = await runAxeWcagAA(page);
    expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('decisoes-drawer.png') });
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(page.getByRole('button', { name: 'Ver a decisão sobre Renda familiar bruta', exact: true })).toBeFocused();
  });

  test('cartão a 320 px: as decisões e o histórico não estouram a largura', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/protecao-do-catalogo?aba=decisoes');
    await expect(page.getByRole('button', { name: 'Ver a decisão sobre Renda familiar bruta', exact: true })).toBeVisible();
    await semRolagemHorizontal(page, page.locator('html'));
    await page.screenshot({ path: testInfo.outputPath('320-decisoes.png') });
    await clicarNaCelula(page, page.locator('.panel tbody tr').first().locator('td').nth(1));
    const drawer = page.getByRole('dialog', { name: 'Detalhe da decisão' });
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('.cfg-atos__item')).toHaveCount(3);
    const largura = await drawer.locator('.uni-drawer__panel').evaluate((el) => el.getBoundingClientRect().width);
    expect(largura).toBeLessThanOrEqual(320);
    await semRolagemHorizontal(page, drawer.locator('.uni-drawer__body'));
    await page.screenshot({ path: testInfo.outputPath('320-decisoes-drawer.png') });
  });

  test('Enviar solicitação: o diálogo largo cabe sem rolagem horizontal e sem código técnico', async ({ page }, testInfo) => {
    await page.goto('/tipos-documento');
    await page.getByRole('button', { name: 'Enviar solicitação', exact: true }).click();
    const dialogo = page.getByRole('dialog', { name: 'Enviar solicitação de aprovação' });
    await expect(dialogo).toBeVisible();
    await expect(dialogo.locator('thead th')).toHaveText(['Enviar', 'Cadastro', 'Item', 'Sensibilidade']);
    await expect(dialogo.getByRole('button', { name: 'Enviar 2 itens' })).toBeEnabled();
    await expect(dialogo.getByRole('checkbox', { name: 'Enviar Laudo médico complementar' })).toBeChecked();
    await caixa(dialogo, 'Enviar Renda familiar bruta').click();
    await expect(dialogo.getByRole('button', { name: 'Enviar 1 item' })).toBeEnabled();
    await expect(dialogo.getByRole('checkbox', { name: 'Marcar todos os itens' })).toHaveJSProperty('indeterminate', true);
    // Do estado misto, o "marcar todos" marca tudo; só então desmarca tudo.
    await caixa(dialogo, 'Marcar todos os itens').click();
    await expect(dialogo.getByRole('button', { name: 'Enviar 2 itens' })).toBeEnabled();
    await caixa(dialogo, 'Marcar todos os itens').click();
    await expect(dialogo.getByRole('button', { name: 'Enviar 0 itens' })).toBeDisabled();
    await caixa(dialogo, 'Marcar todos os itens').click();
    await expect(dialogo.getByRole('button', { name: 'Enviar 2 itens' })).toBeEnabled();
    await expect(dialogo).not.toContainText('LAUDO_MEDICO');
    await expect(dialogo).not.toContainText('aprova ou nega');
    await expect(dialogo).toContainText('Os itens marcados vão para a proteção de dados');
    const tabela = dialogo.locator('.table-responsive');
    const rola = await tabela.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(rola).toBe(false);
    const largura = await dialogo.locator('.uni-dialog__panel').evaluate((el) => Math.round(el.getBoundingClientRect().width));
    testInfo.annotations.push({ type: 'largura-do-dialogo', description: String(largura) });
    expect(largura).toBeLessThanOrEqual(page.viewportSize()?.width ?? Infinity);
    await page.screenshot({ path: testInfo.outputPath('solicitacao-dialogo.png') });
  });
});
