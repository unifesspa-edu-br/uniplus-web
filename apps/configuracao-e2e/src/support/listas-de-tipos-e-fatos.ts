import { expect, type Locator, type Page, type Route, type TestInfo } from '@playwright/test';
import { assertReflowContract } from '@uniplus/shared-e2e';
import {
  ATOS_DO_FATO,
  ATOS_DO_TIPO,
  CATEGORIAS,
  DECISOES,
  FATOS,
  PENDENCIAS,
  SOLICITADA,
  SOLICITADOS,
  TIPOS,
} from './dados-de-tipos-e-fatos';
import { mockConfiguracaoRuntimeConfig } from './runtime-config';

export type VisualTheme = 'light' | 'dark' | 'contrast';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

const ADMIN = '\\/api\\/configuracao\\/admin';
const PROXIMA_PAGINA =
  '<http://localhost:5000/api/configuracao/admin/protecao-do-catalogo/decisoes?cursor=PROX&direction=next>; rel="next"';

export async function json(route: Route, body: unknown): Promise<void> {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
    return;
  }
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  });
}

/** Os cadastros e o histórico de cada um, que as listas e os drawers leem. */
async function mockCadastros(page: Page): Promise<void> {
  await page.route(/\/api\/configuracao\/tipos-documento(\?.*)?$/, (r) => json(r, TIPOS));
  await page.route(/\/api\/configuracao\/categorias-documento(\?.*)?$/, (r) => json(r, CATEGORIAS));
  await page.route(/\/api\/configuracao\/admin\/fatos-candidato(\?.*)?$/, (r) => json(r, FATOS));
  await page.route(/\/api\/configuracao\/fatos-candidato(\?.*)?$/, (r) => json(r, []));
  await page.route(/\/api\/configuracao\/fases-canonicas(\?.*)?$/, (r) => json(r, []));
  await page.route(new RegExp(`${ADMIN}\\/tipos-documento\\/[^/?]+\\/protecao\\/atos$`), (r) =>
    json(r, ATOS_DO_TIPO),
  );
  await page.route(new RegExp(`${ADMIN}\\/fatos-candidato\\/[^/?]+\\/protecao\\/atos$`), (r) =>
    json(r, ATOS_DO_FATO),
  );
}

/** As decisões que os filtros da URL escolhem: decisão, cadastro e busca pelo nome. */
function decisoesFiltradas(url: URL) {
  const atos = url.searchParams.getAll('ato');
  const cadastro = url.searchParams.get('cadastro');
  const busca = (url.searchParams.get('busca') ?? '').toLowerCase();
  return DECISOES.filter(
    (d) =>
      (atos.length === 0 || atos.includes(d.ato)) &&
      (cadastro === null || d.cadastro === cadastro) &&
      d.itemNome.toLowerCase().includes(busca),
  );
}

async function responderDecisoes(route: Route): Promise<void> {
  if (route.request().method() === 'OPTIONS') return json(route, null);
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { ...CORS_HEADERS, 'access-control-expose-headers': 'Link', Link: PROXIMA_PAGINA },
    body: JSON.stringify(decisoesFiltradas(new URL(route.request().url()))),
  });
}

const DETALHE_DO_FATO = {
  descricao: 'Soma da renda mensal bruta dos membros da família.',
  tipoDocumento: null,
  fato: {
    dominio: 'NUMERICO',
    cardinalidade: 'ESCALAR',
    sistema: false,
    componenteExibicao: 'MOEDA',
    valores: [],
  },
};

const DETALHE_DO_TIPO = {
  descricao: 'Laudo que complementa o pedido de atendimento especializado.',
  fato: null,
  tipoDocumento: { categoria: 'SAUDE', formatosAceitos: 'pdf,jpg,png,tiff', tamanhoMaximoMb: 10 },
};

/** O detalhe do item aguardando a decisão, sem manifestação vigente. */
function detalheDe(url: string) {
  const item = PENDENCIAS.find((p) => url.endsWith(p.id)) ?? PENDENCIAS[0];
  const fato = url.includes('/fatos/');
  const proprio = fato ? DETALHE_DO_FATO : DETALHE_DO_TIPO;
  const atos = fato ? ATOS_DO_FATO : ATOS_DO_TIPO;
  return { ...item, ...proprio, atos, aprovacao: SOLICITADA, manifestacoesVigentes: [] };
}

/** A fila: com `situacao`, a pedida; sem ela, a da situação que o cenário escolheu. */
function filaDe(url: URL, situacaoDaFila: 'PENDENTE' | 'SOLICITADA') {
  const pedida = url.searchParams.get('situacao') === 'SOLICITADA' ? SOLICITADOS : PENDENCIAS;
  return situacaoDaFila === 'SOLICITADA' && !url.searchParams.has('situacao')
    ? SOLICITADOS
    : pedida;
}

async function mockProtecao(page: Page, situacaoDaFila: 'PENDENTE' | 'SOLICITADA'): Promise<void> {
  const raiz = `${ADMIN}\\/protecao-do-catalogo`;
  await page.route(new RegExp(`${raiz}\\/decisoes(\\?.*)?$`), responderDecisoes);
  await page.route(new RegExp(`${raiz}\\/(tipos-documento|fatos)\\/[^/?]+\\/manifestacoes$`), (r) =>
    json(r, []),
  );
  await page.route(new RegExp(`${raiz}\\/(tipos-documento|fatos)\\/[^/?]+$`), (r) =>
    json(r, detalheDe(r.request().url())),
  );
  await page.route(new RegExp(`${raiz}(\\?.*)?$`), (r) =>
    json(r, filaDe(new URL(r.request().url()), situacaoDaFila)),
  );
}

/** A API dos tipos de documento, dos fatos do candidato e da proteção de dados deles. */
export async function mockApi(
  page: Page,
  situacaoDaFila: 'PENDENTE' | 'SOLICITADA',
): Promise<void> {
  await mockCadastros(page);
  await mockProtecao(page, situacaoDaFila);
}

export function tema(testInfo: TestInfo): VisualTheme {
  return testInfo.project.metadata['theme'] as VisualTheme;
}

export function ehDesktop(testInfo: TestInfo): boolean {
  return testInfo.project.metadata['viewport'] === 'desktop';
}

/** Roda no navegador antes do app: grava o tema do projeto nas preferências de acessibilidade. */
function gravarPreferencias(valor: VisualTheme): void {
  const preferencias = {
    theme: valor === 'contrast' ? 'auto' : valor,
    contrast: valor === 'contrast',
    fontMode: 'default',
  };
  window.localStorage.setItem('uniplus.a11y', JSON.stringify(preferencias));
}

/** Prepara a página no tema do projeto visual e com a API simulada. */
export async function prepararPagina(
  page: Page,
  testInfo: TestInfo,
  situacaoDaFila: 'PENDENTE' | 'SOLICITADA',
): Promise<void> {
  await mockConfiguracaoRuntimeConfig(page);
  await page.addInitScript(gravarPreferencias, tema(testInfo));
  await mockApi(page, situacaoDaFila);
}

export async function semRolagemHorizontal(page: Page, alvo: Locator): Promise<void> {
  const medidas = await alvo.evaluate((el) => ({ rola: el.scrollWidth > el.clientWidth + 1 }));
  expect(medidas.rola, 'a área não rola na horizontal').toBe(false);
  // O contrato de reflow a 320 px abre o menu e espera nenhum `dialog.uni-drawer` no DOM, o que não vale
  // para páginas que já trazem seus drawers; a ausência de estouro horizontal é conferida acima.
  if ((page.viewportSize()?.width ?? 0) > 340) await assertReflowContract(page);
}

/** Alturas das linhas da tabela principal, em pixels. */
async function alturasDasLinhas(page: Page): Promise<number[]> {
  return page
    .locator('.panel tbody tr')
    .evaluateAll((linhas) =>
      linhas.map((linha) => Math.round(linha.getBoundingClientRect().height)),
    );
}

/** O que a conferência da lista espera: as colunas, a anotação das alturas e se há coluna de ações. */
export interface ColunasDaLista {
  readonly colunas: readonly string[];
  readonly anotacao: string;
  readonly comAcoes?: boolean;
}

/** No cartão, cada valor tem a sua célula e a página não estoura a largura. */
async function conferirCartao(page: Page, celulas: number): Promise<void> {
  const primeira = page.locator('.panel tbody tr').first().locator('td[data-label]');
  await expect(primeira).toHaveCount(celulas);
  await semRolagemHorizontal(page, page.locator('html'));
}

/**
 * Confere a lista: no desktop, as colunas, a ausência de rolagem horizontal e as alturas das linhas; no
 * cartão, que as células de cada valor aparecem e que a página não estoura a largura.
 */
export async function conferirLista(
  page: Page,
  testInfo: TestInfo,
  { colunas, anotacao, comAcoes = true }: ColunasDaLista,
): Promise<void> {
  if (!ehDesktop(testInfo)) return conferirCartao(page, colunas.length + (comAcoes ? 1 : 0));
  await expect(page.locator('.panel thead th')).toHaveText(
    comAcoes ? [...colunas, 'Ações'] : [...colunas],
  );
  await semRolagemHorizontal(page, page.locator('.panel .table-responsive'));
  const alturas = await alturasDasLinhas(page);
  testInfo.annotations.push({ type: anotacao, description: alturas.join(',') });
}

/** Clica no centro da célula, como a pessoa faz: o alvo estendido do botão do nome recebe o clique. */
export async function clicarNaCelula(page: Page, celula: Locator): Promise<void> {
  await celula.scrollIntoViewIfNeeded();
  const caixa = await celula.boundingBox();
  expect(caixa, 'a célula está visível').not.toBeNull();
  await page.mouse.click(
    (caixa?.x ?? 0) + (caixa?.width ?? 0) / 2,
    (caixa?.y ?? 0) + (caixa?.height ?? 0) / 2,
  );
}

/** A caixa de seleção do DS fica escondida: quem recebe o clique é o rótulo que a envolve. */
export function caixa(dialogo: Locator, nome: string): Locator {
  return dialogo
    .locator('label.checkbox')
    .filter({ has: dialogo.page().getByRole('checkbox', { name: nome }) });
}

export async function aoAbrirPeloTeclado(
  page: Page,
  nome: string,
  ariaDoDrawer: string,
): Promise<void> {
  const alvo = page.getByRole('button', { name: `Ver o detalhe de ${nome}`, exact: true });
  await alvo.focus();
  await expect(alvo).toBeFocused();
  await page.keyboard.press('Enter');
  await fecharPeloTeclado(page, nome, ariaDoDrawer);
  await expect(alvo).toBeFocused();
}

/** O drawer aberto leva o foco ao título, e o Esc o fecha. */
async function fecharPeloTeclado(page: Page, nome: string, ariaDoDrawer: string): Promise<void> {
  const drawer = page.getByRole('dialog', { name: ariaDoDrawer });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('heading', { name: nome, level: 2 })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
}
