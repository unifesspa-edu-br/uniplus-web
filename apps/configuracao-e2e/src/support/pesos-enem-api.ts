import { expect, type Locator, type Page, type Route } from '@playwright/test';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

export const RESOLUCAO = 'Res. 805/2024';
export const RESOLUCAO_NOVA = 'Res. 900/2026';
const AREAS = [
  { codigo: 'REDACAO', rotulo: 'Redação' },
  { codigo: 'CIENCIAS_DA_NATUREZA', rotulo: 'Ciências da Natureza e suas Tecnologias' },
  { codigo: 'CIENCIAS_HUMANAS', rotulo: 'Ciências Humanas e suas Tecnologias' },
  { codigo: 'LINGUAGENS', rotulo: 'Linguagens e suas Tecnologias' },
  { codigo: 'MATEMATICA', rotulo: 'Matemática e suas Tecnologias' },
];
const GRUPOS = [
  { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' },
  { codigo: 'HUMANISTICA_I', rotulo: 'Humanística I' },
  { codigo: 'HUMANISTICA_II', rotulo: 'Humanística II' },
  { codigo: 'SAUDE_E_BIOLOGICAS', rotulo: 'Saúde e Biológicas' },
];

function linhasDa(resolucao: string, prefixo: string, criadoEm: string) {
  return GRUPOS.map((grupoCurso, indice) => ({
    id: `01960000-0000-7000-0000-${prefixo}${indice + 1}`,
    resolucao,
    grupoCurso,
    areas: AREAS.map((area) => ({ ...area, peso: 1, corte: null })),
    baseLegal: `${resolucao} Anexo I`,
    criadoEm,
  }));
}

export const SEED = linhasDa(RESOLUCAO, '0000000000a', '2026-06-24T12:00:00Z');
/** A resolução recém-cadastrada: `criadoEm` posterior à do SEED, por isso passa a ser a vigente. */
const NOVA = linhasDa(RESOLUCAO_NOVA, '0000000000b', '2026-11-05T12:00:00Z');

/** Atraso da recarga da lista após a escrita: os botões da tela ainda estão indisponíveis quando o diálogo fecha. */
const ATRASO_DA_RECARGA_EM_MS = 1500;
const QUANTIDADE_DE_GRUPOS = GRUPOS.length;

export const PROBLEMA_500 = {
  type: 'about:blank',
  title: 'Erro interno',
  status: 500,
  code: 'uniplus.internal.unexpected',
};
export const PROBLEMA_409_PAR = {
  type: 'about:blank',
  title: 'Já existe peso para esta resolução e este grupo',
  status: 409,
  code: 'uniplus.configuracao.peso_area_enem.par_ja_existe',
};
export const PROBLEMA_422_RESOLUCAO = {
  type: 'about:blank',
  title: 'Dados inválidos',
  status: 422,
  code: 'uniplus.configuracao.peso_area_enem.resolucao_tamanho',
  errors: [
    {
      field: 'resolucao',
      code: 'uniplus.configuracao.peso_area_enem.resolucao_tamanho',
      message: 'Resolução fora do padrão.',
    },
  ],
};

/** O que a lista devolve depois da escrita: a mesma, sem a resolução removida, com a nova ou com falha. */
export type Recarga = 'igual' | 'sem-o-item' | 'com-a-nova' | 'com-falha';
export type Resposta = { status: number; corpo?: unknown };
export const CRIADO: Resposta = { status: 201 };
export const SALVO: Resposta = { status: 204 };

interface Opcoes {
  /** Uma resposta por rodada de escrita (quatro requisições, uma por grupo); a última repete. */
  readonly respostas: readonly Resposta[];
  readonly recarga: Recarga;
  readonly inicial?: readonly unknown[];
  readonly primeiraConsulta?: 'ok' | 'falha';
}

/** Cada rodada de escrita fica retida até `liberar`, que a espera chegar por inteiro. */
export async function mockApi(page: Page, opcoes: Opcoes) {
  const { respostas, recarga, inicial = SEED, primeiraConsulta = 'ok' } = opcoes;
  const portoes: Array<{ aberto: Promise<void>; abrir: () => void }> = [];
  const portao = (rodada: number) => {
    if (!portoes[rodada]) {
      let abrir: () => void = () => undefined;
      const aberto = new Promise<void>((resolve) => (abrir = resolve));
      portoes[rodada] = { aberto, abrir };
    }
    return portoes[rodada];
  };
  const envios: string[] = [];
  let rodadasLiberadas = 0;
  let gravou = false;
  let consultas = 0;
  const problema = (route: Route, corpo: unknown, status: number) =>
    route.fulfill({
      status,
      headers: CORS_HEADERS,
      contentType: 'application/problem+json',
      body: JSON.stringify(corpo),
    });
  await page.route(/\/api\/configuracao\/pesos-area-enem(\?.*)?$/, async (route) => {
    consultas += 1;
    if (primeiraConsulta === 'falha' && consultas === 1) {
      await problema(route, PROBLEMA_500, 500);
      return;
    }
    if (gravou || consultas > 1) {
      await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
    }
    if (!gravou) {
      await route.fulfill({ status: 200, headers: CORS_HEADERS, json: inicial });
      return;
    }
    if (recarga === 'com-falha') {
      await problema(route, PROBLEMA_500, 500);
      return;
    }
    const itens = { igual: inicial, 'sem-o-item': [], 'com-a-nova': [...NOVA, ...inicial] };
    await route.fulfill({ status: 200, headers: CORS_HEADERS, json: itens[recarga] });
  });
  await page.route(/\/api\/configuracao\/pesos-area-enem\/areas$/, (route) =>
    route.fulfill({ status: 200, headers: CORS_HEADERS, json: AREAS }),
  );
  await page.route(/\/api\/configuracao\/vocabularios\/grupos-area-enem$/, (route) =>
    route.fulfill({ status: 200, headers: CORS_HEADERS, json: GRUPOS }),
  );
  const escrita = async (route: Route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    const rodada = Math.floor(envios.length / QUANTIDADE_DE_GRUPOS);
    envios.push(route.request().method());
    await portao(rodada).aberto;
    const atual = respostas[Math.min(rodada, respostas.length - 1)];
    if (atual.status < 300) gravou = true;
    if (atual.corpo !== undefined) {
      await problema(route, atual.corpo, atual.status);
      return;
    }
    await route.fulfill({
      status: atual.status,
      headers: CORS_HEADERS,
      ...(atual.status === 201
        ? { contentType: 'application/json', body: JSON.stringify('novo-id') }
        : {}),
    });
  };
  await page.route(/\/api\/configuracao\/admin\/pesos-area-enem\/[^/?]+$/, escrita);
  await page.route(/\/api\/configuracao\/admin\/pesos-area-enem$/, escrita);
  const liberar = async (): Promise<void> => {
    const rodada = rodadasLiberadas;
    rodadasLiberadas += 1;
    await expect
      .poll(() => envios.length)
      .toBeGreaterThanOrEqual((rodada + 1) * QUANTIDADE_DE_GRUPOS);
    portao(rodada).abrir();
  };
  return { liberar, envios };
}

export const titulo = (page: Page): Locator =>
  page.getByRole('heading', { name: 'Peso por Área', level: 1 });
export const cadastrar = (page: Page): Locator =>
  page.getByRole('button', { name: 'Cadastrar nova resolução', exact: true }).first();
export const editar = (page: Page): Locator =>
  page.getByRole('button', { name: 'Editar parâmetros', exact: true });
export const remover = (page: Page): Locator =>
  page.getByRole('button', { name: `Remover resolução ${RESOLUCAO}`, exact: true });
export const drawer = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Formulário de nova resolução de pesos do ENEM' });
export const confirmacao = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Remover resolução?' });

export async function abrirCadastro(page: Page): Promise<Locator> {
  await page.goto('/pesos-por-area');
  await cadastrar(page).click();
  const formulario = drawer(page);
  await expect(formulario).toBeVisible();
  await formulario.locator('[formcontrolname="resolucao"]').fill(RESOLUCAO_NOVA);
  await formulario.locator('[formcontrolname="baseLegalGlobal"]').fill(`${RESOLUCAO_NOVA} Anexo I`);
  return formulario;
}

export async function abrirEdicao(page: Page): Promise<void> {
  await page.goto('/pesos-por-area');
  await editar(page).click();
  await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toBeVisible();
}

export async function abrirRemocao(page: Page) {
  await page.goto('/pesos-por-area');
  await remover(page).click();
  const dialogo = confirmacao(page);
  return {
    dialogo,
    confirmar: dialogo.getByRole('button', { name: 'Confirmar remoção', exact: true }),
  };
}
