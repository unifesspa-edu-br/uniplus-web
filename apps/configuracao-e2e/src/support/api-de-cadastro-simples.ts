import type { Page, Request, Route } from '@playwright/test';
import {
  ERRO_INTERNO,
  esperarARecarga,
  reter,
  responder,
  responderPreflight,
  type Resposta,
} from './escritas-retidas';

/** Mock dos cadastros de lista simples (código, nome e descrição) cujas escritas ficam retidas até `liberar`. */

export type RecargaDeCadastro = 'com-o-item' | 'com-o-codigo-alterado' | 'sem-o-item' | 'com-falha';

export interface Cadastro {
  leitura: RegExp;
  escrita: RegExp;
  item: { codigo: string };
}

export interface MockDeCadastro {
  cadastro: Cadastro;
  recarga: RecargaDeCadastro;
  inicial: readonly unknown[];
}

interface Escritas {
  envios: string[];
  chaves: (string | undefined)[];
  retidas: ReturnType<typeof reter>[];
}

function corpoDaRecarga({ cadastro, recarga }: MockDeCadastro): readonly unknown[] {
  if (recarga === 'sem-o-item') return [];
  const alterado = { ...cadastro.item, codigo: `${cadastro.item.codigo}_V2` };
  return recarga === 'com-o-codigo-alterado' ? [alterado] : [cadastro.item];
}

async function responderALista(route: Route, consulta: number, mock: MockDeCadastro) {
  if (consulta === 1) {
    await responder(route, { status: 200, corpo: mock.inicial });
    return;
  }
  await esperarARecarga();
  if (mock.recarga === 'com-falha') {
    await responder(route, { status: 500, corpo: ERRO_INTERNO });
    return;
  }
  await responder(route, { status: 200, corpo: corpoDaRecarga(mock) });
}

function registrarEnvio(requisicao: Request, escritas: Escritas): number {
  escritas.envios.push(requisicao.method());
  escritas.chaves.push(requisicao.headers()['idempotency-key']);
  return escritas.envios.length - 1;
}

async function responderAEscrita(
  route: Route,
  respostas: readonly Resposta[],
  escritas: Escritas,
): Promise<void> {
  if (route.request().method() === 'OPTIONS') {
    await responderPreflight(route);
    return;
  }
  const indice = registrarEnvio(route.request(), escritas);
  await escritas.retidas[indice].retida;
  await responder(route, respostas[indice]);
}

export async function mockCadastro(
  page: Page,
  mock: MockDeCadastro,
  respostas: readonly Resposta[],
) {
  const escritas: Escritas = { envios: [], chaves: [], retidas: respostas.map(() => reter()) };
  let consultas = 0;
  await page.route(mock.cadastro.leitura, (route) => {
    consultas += 1;
    return responderALista(route, consultas, mock);
  });
  await page.route(mock.cadastro.escrita, (route) => responderAEscrita(route, respostas, escritas));
  const { envios, chaves, retidas } = escritas;
  return { envios, chaves, liberar: (indice = 0) => retidas[indice].liberar() };
}

/** A primeira leitura falha com 500; as seguintes devolvem o item do cadastro. */
export async function mockLeituraComFalhaInicial(page: Page, cadastro: Cadastro): Promise<void> {
  let consultas = 0;
  await page.route(cadastro.leitura, (route) => {
    consultas += 1;
    return consultas === 1
      ? responder(route, { status: 500, corpo: ERRO_INTERNO })
      : responder(route, { status: 200, corpo: [cadastro.item] });
  });
}
