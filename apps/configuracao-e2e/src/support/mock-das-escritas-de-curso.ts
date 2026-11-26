import { type Page, type Route } from '@playwright/test';
import { OFERTA } from './dados-de-oferta-de-curso';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};
const CURSO = {
  id: '01960000-0000-7000-0000-0000000000c1',
  codigo: 'ENG_CIV',
  nome: 'Engenharia Civil',
  grau: 'Bacharelado',
  nivelEnsino: 'Graduação',
  grupoAreaEnem: null,
  criadoEm: '2026-06-10T12:00:00Z',
};
/** Atraso da recarga da lista após a escrita: o botão da linha ainda está indisponível quando o drawer fecha. */
const ATRASO_DA_RECARGA_EM_MS = 1500;

const ERRO_INTERNO = {
  type: 'about:blank',
  title: 'Erro interno',
  status: 500,
  code: 'uniplus.internal.unexpected',
};

async function responder(route: Route, status: number, corpo?: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: status >= 400 ? 'application/problem+json' : 'application/json',
    headers: CORS_HEADERS,
    body: status === 204 || corpo === undefined ? undefined : JSON.stringify(corpo),
  });
}

type Recarga = 'com-o-curso' | 'sem-o-curso' | 'com-falha';

type Resposta = { status: number; corpo?: unknown };
type Estado = { consultas: number; recarga: Recarga; primeiraConsulta: 'ok' | 'falha' };

async function opcoes(route: Route): Promise<boolean> {
  if (route.request().method() !== 'OPTIONS') return false;
  await route.fulfill({ status: 204, headers: CORS_HEADERS });
  return true;
}

async function responderConsulta(route: Route, estado: Estado): Promise<void> {
  if (await opcoes(route)) return;
  estado.consultas += 1;
  const recarga = estado.consultas > 1;
  if (recarga) await new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));
  if (
    (!recarga && estado.primeiraConsulta === 'falha') ||
    (recarga && estado.recarga === 'com-falha')
  ) {
    await responder(route, 500, ERRO_INTERNO);
    return;
  }
  await responder(route, 200, recarga && estado.recarga === 'sem-o-curso' ? [] : [CURSO]);
}

async function registrarConsultas(page: Page, estado: Estado): Promise<void> {
  await page.route(/\/api\/configuracao\/vocabularios\/grupos-area-enem$/, (r) =>
    responder(r, 200, []),
  );
  await page.route(/\/api\/configuracao\/ofertas-curso(\?.*)?$/, (r) =>
    responder(r, 200, [OFERTA]),
  );
  await page.route(/\/api\/configuracao\/cursos(\?.*)?$/, (r) => responderConsulta(r, estado));
}

async function registrarEscritas(
  page: Page,
  resposta: Resposta,
  retida: Promise<void>,
  envios: string[],
): Promise<void> {
  await page.route(/\/api\/configuracao\/admin\/cursos(\/[^/?]+)?$/, async (route) => {
    if (await opcoes(route)) return;
    envios.push(route.request().method());
    await retida;
    await responder(route, resposta.status, resposta.corpo);
  });
}

export async function mockApi(
  page: Page,
  resposta: Resposta,
  recarga: Recarga = 'com-o-curso',
  primeiraConsulta: 'ok' | 'falha' = 'ok',
) {
  let liberar: () => void = () => undefined;
  const retida = new Promise<void>((resolve) => (liberar = resolve));
  const envios: string[] = [];
  await registrarConsultas(page, { consultas: 0, recarga, primeiraConsulta });
  await registrarEscritas(page, resposta, retida, envios);
  return { liberar, envios };
}

export async function mockFalhaNaPrimeiraConsultaDeOfertas(page: Page): Promise<void> {
  let consultas = 0;
  await page.route(/\/api\/configuracao\/ofertas-curso(\?.*)?$/, async (route) => {
    consultas += 1;
    if (consultas === 1) {
      await responder(route, 500, ERRO_INTERNO);
      return;
    }
    await new Promise((resolver) => setTimeout(resolver, ATRASO_DA_RECARGA_EM_MS));
    await responder(route, 200, [OFERTA]);
  });
}
