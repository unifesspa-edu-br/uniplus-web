import type { Page, Route } from '@playwright/test';
import {
  CORS_HEADERS,
  ERRO_INTERNO,
  esperarARecarga,
  problema,
  reter,
  type Resposta,
} from './escritas-retidas';

/** Mock de uma tela de lista com escritas retidas: cada POST, PUT ou DELETE consome a próxima resposta e espera `liberar`. */

export const PROBLEMA_409_PROCESSANDO = problema(
  409,
  'uniplus.idempotency.processing_conflict',
  'Escrita em processamento',
);

export type Estado = { gravou: boolean };
export type Recarga = 'com-o-item' | 'sem-o-item' | 'com-falha';
export type PrimeiraConsulta = 'ok' | 'falha';

/** `recarga` é a lista devolvida depois da escrita bem-sucedida, ou `'falha'` para a recarga responder 500. */
export interface Leitura {
  readonly inicial: unknown;
  readonly recarga: unknown;
  readonly primeiraFalha: boolean;
}

export interface Cenario {
  readonly respostas: readonly Resposta[];
  readonly envios: string[];
  readonly chaves: (string | null)[];
  readonly estado: Estado;
  readonly retida: Promise<void>;
  readonly liberar: () => void;
}

export interface Rotas {
  readonly lista: RegExp;
  readonly escritas: readonly RegExp[];
}

export function novoCenario(respostas: readonly Resposta[]): Cenario {
  const { retida, liberar } = reter();
  return { respostas, envios: [], chaves: [], estado: { gravou: false }, retida, liberar };
}

/** Lista que mantém o item, o tira ou falha na recarga, conforme o nome da recarga. */
export function leituraDoItem(
  item: unknown,
  recarga: Recarga,
  primeiraConsulta: PrimeiraConsulta,
): Leitura {
  const recargas = { 'com-o-item': [item], 'sem-o-item': [], 'com-falha': 'falha' };
  return {
    inicial: [item],
    recarga: recargas[recarga],
    primeiraFalha: primeiraConsulta === 'falha',
  };
}

export const responderProblema = (route: Route, status: number, corpo: unknown) =>
  route.fulfill({
    status,
    headers: CORS_HEADERS,
    contentType: 'application/problem+json',
    body: JSON.stringify(corpo),
  });

async function responderLeitura(route: Route, leitura: Leitura, estado: Estado, consulta: number) {
  if (leitura.primeiraFalha && consulta === 1) {
    await responderProblema(route, 500, ERRO_INTERNO);
    return;
  }
  if (estado.gravou || consulta > 1) await esperarARecarga();
  const gravou = estado.gravou;
  if (gravou && leitura.recarga === 'falha') {
    await responderProblema(route, 500, ERRO_INTERNO);
    return;
  }
  const json = gravou ? leitura.recarga : leitura.inicial;
  await route.fulfill({ status: 200, headers: CORS_HEADERS, json });
}

export function atenderLeitura(leitura: Leitura, cenario: Cenario) {
  let consultas = 0;
  return async (route: Route): Promise<void> => {
    consultas += 1;
    await responderLeitura(route, leitura, cenario.estado, consultas);
  };
}

async function responderEscrita(route: Route, resposta: Resposta): Promise<void> {
  if (resposta.corpo !== undefined) {
    await responderProblema(route, resposta.status, resposta.corpo);
    return;
  }
  const criado =
    resposta.status === 201
      ? { contentType: 'application/json', body: JSON.stringify('novo-id') }
      : {};
  await route.fulfill({ status: resposta.status, headers: CORS_HEADERS, ...criado });
}

export function atenderEscrita(cenario: Cenario) {
  return async (route: Route): Promise<void> => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    const resposta = cenario.respostas[cenario.envios.length];
    cenario.envios.push(route.request().method());
    cenario.chaves.push(await route.request().headerValue('idempotency-key'));
    await cenario.retida;
    if (resposta.status < 300) cenario.estado.gravou = true;
    await responderEscrita(route, resposta);
  };
}

/** Rota única que atende a leitura (GET) e as escritas de um mesmo recurso. */
export function atenderLeituraEEscrita(
  leitura: (route: Route) => Promise<void>,
  escrita: (route: Route) => Promise<void>,
) {
  return (route: Route): Promise<void> =>
    route.request().method() === 'GET' ? leitura(route) : escrita(route);
}

export async function registrarRotas(
  page: Page,
  rotas: Rotas,
  leitura: Leitura,
  cenario: Cenario,
): Promise<void> {
  await page.route(rotas.lista, atenderLeitura(leitura, cenario));
  const escrita = atenderEscrita(cenario);
  for (const rota of rotas.escritas) await page.route(rota, escrita);
}
