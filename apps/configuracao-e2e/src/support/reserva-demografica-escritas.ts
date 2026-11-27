import { expect, type Locator, type Page, type Route } from '@playwright/test';
import {
  CORS_HEADERS,
  ERRO_INTERNO,
  esperarARecarga,
  problema,
  reter,
  type Resposta,
} from './escritas-retidas';

const CENSO = {
  id: '01960000-0000-7000-0000-0000000000e1',
  censoReferencia: '2022',
  ppiPercentual: 78.5,
  quilombolaPercentual: 1.2,
  pcdPercentual: 8.4,
  baseLegal: 'Lei 12.711/2012, art. 10, III',
  criadoEm: '2026-06-10T12:00:00Z',
};

export const PROBLEMA_404 = problema(
  404,
  'uniplus.configuracao.referencia_reserva_demografica.nao_encontrada',
  'Referência de reserva demográfica não encontrada',
);
export const PROBLEMA_422 = problema(422, 'uniplus.validacao', 'Dados inválidos', [
  {
    field: 'PpiPercentual',
    code: 'uniplus.configuracao.referencia_reserva_demografica.percentual_fora_de_faixa',
    message: 'Percentual recusado.',
  },
]);
export const PROBLEMA_DUPLICADO = problema(
  409,
  'uniplus.configuracao.referencia_reserva_demografica.censo_ja_existe',
  'Já existe uma referência ativa para este Censo',
);
export const PROBLEMA_PROCESSANDO = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'A requisição anterior ainda está em processamento',
);

type Recarga = 'com-o-censo' | 'sem-o-censo' | 'com-falha';

async function responder(route: Route, status: number, corpo?: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: status >= 400 ? 'application/problem+json' : 'application/json',
    headers: CORS_HEADERS,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
}

async function responderLista(route: Route, recarga: Recarga, consulta: number): Promise<void> {
  if (consulta > 1) await esperarARecarga();
  if (consulta > 1 && recarga === 'com-falha') {
    await responder(route, 500, ERRO_INTERNO);
    return;
  }
  await responder(route, 200, consulta > 1 && recarga === 'sem-o-censo' ? [] : [CENSO]);
}

async function mockLista(page: Page, recarga: Recarga, primeiraFalha: boolean): Promise<void> {
  let consultas = 0;
  await page.route(
    /\/api\/configuracao\/referencias-reserva-demografica(\?.*)?$/,
    async (route) => {
      consultas += 1;
      if (primeiraFalha && consultas === 1) await responder(route, 500, ERRO_INTERNO);
      else await responderLista(route, recarga, consultas);
    },
  );
}

interface Escritas {
  readonly respostas: readonly Resposta[];
  readonly retidas: readonly ReturnType<typeof reter>[];
  readonly envios: string[];
  readonly chaves: (string | undefined)[];
}

const novasEscritas = (respostas: readonly Resposta[]): Escritas => ({
  respostas,
  retidas: respostas.map(() => reter()),
  envios: [],
  chaves: [],
});

async function atenderEscrita(route: Route, escritas: Escritas): Promise<void> {
  const requisicao = route.request();
  if (requisicao.method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
    return;
  }
  const indice = escritas.envios.length;
  escritas.envios.push(requisicao.method());
  escritas.chaves.push(requisicao.headers()['idempotency-key']);
  await escritas.retidas[indice].retida;
  const { status, corpo } = escritas.respostas[indice];
  await responder(route, status, corpo);
}

/**
 * Cada escrita consome a próxima resposta e fica retida até `liberar`; a recarga que a segue
 * responde conforme `recarga`, depois de `ATRASO_DA_RECARGA_EM_MS`.
 */
export async function mockApi(
  page: Page,
  respostas: readonly Resposta[],
  recarga: Recarga,
  primeiraConsulta: 'ok' | 'falha' = 'ok',
) {
  const escritas = novasEscritas(respostas);
  await mockLista(page, recarga, primeiraConsulta === 'falha');
  await page.route(
    /\/api\/configuracao\/admin\/referencias-reserva-demografica(\/[^/?]+)?$/,
    (route) => atenderEscrita(route, escritas),
  );
  const liberar = (indice = 0) => escritas.retidas[indice].liberar();
  return { envios: escritas.envios, chaves: escritas.chaves, liberar };
}

export const titulo = (page: Page) => page.getByRole('heading', { name: 'Referências', level: 2 });
export const editar = (page: Page) =>
  page.getByRole('button', { name: 'Editar reserva demográfica do censo 2022', exact: true });
export const remover = (page: Page) =>
  page.getByRole('button', { name: 'Remover reserva demográfica do censo 2022', exact: true });
export const novo = (page: Page) => page.getByRole('button', { name: 'Novo censo' }).first();
export const regiaoDeStatus = (page: Page) =>
  page.locator('cfg-reserva-demografica-page > [role="status"]');
export const campo = (drawer: Locator, nome: string) =>
  drawer.locator(`[formcontrolname="${nome}"]`);
export const criarReferencia = (drawer: Locator) =>
  drawer.getByRole('button', { name: 'Criar referência' });
export const salvarReferencia = (drawer: Locator) =>
  drawer.getByRole('button', { name: 'Salvar referência' });

async function abrirDrawer(page: Page, abrir: () => Promise<void>): Promise<Locator> {
  await page.goto('/reserva-demografica');
  await abrir();
  const drawer = page.getByRole('dialog', { name: 'Formulário de referência demográfica' });
  await expect(drawer).toBeVisible();
  return drawer;
}
export const abrirEdicao = (page: Page) => abrirDrawer(page, () => editar(page).click());
export const abrirCadastro = (page: Page) => abrirDrawer(page, () => novo(page).click());

export async function pedirRemocao(page: Page): Promise<{ dialogo: Locator; confirmar: Locator }> {
  await page.goto('/reserva-demografica');
  await remover(page).click();
  const dialogo = page.getByRole('dialog', { name: 'Remover referência demográfica' });
  return { dialogo, confirmar: dialogo.getByTestId('confirm-dialog-confirm') };
}

export async function preencherCadastro(drawer: Locator): Promise<void> {
  await campo(drawer, 'censoReferencia').fill('2010');
  await campo(drawer, 'ppiPercentual').fill('70');
  await campo(drawer, 'quilombolaPercentual').fill('1');
  await campo(drawer, 'pcdPercentual').fill('8');
}
