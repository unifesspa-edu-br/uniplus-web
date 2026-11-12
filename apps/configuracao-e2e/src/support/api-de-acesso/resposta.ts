import type { Route } from '@playwright/test';
import type { EstadoDaApi } from './modelo';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
  'access-control-expose-headers': 'link',
};

/** A requisição que chegou à API simulada, com o estado que ela altera. */
export interface Requisicao {
  readonly route: Route;
  readonly metodo: string;
  readonly url: URL;
  readonly estado: EstadoDaApi;
}

/** Uma rota da API simulada: o caminho que atende, o método (todos, se ausente) e a resposta. */
export interface Rota {
  readonly caminho: RegExp;
  readonly metodo?: string;
  readonly responder: (requisicao: Requisicao) => Promise<void>;
}

export function json(route: Route, corpo: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: status >= 400 ? 'application/problem+json' : 'application/json',
    headers: CORS,
    body: JSON.stringify(corpo),
  });
}

export function semConteudo(route: Route): Promise<void> {
  return route.fulfill({ status: 204, headers: CORS });
}

/** O `sub` de quem fez a requisição, lido do Bearer, para os pedidos que a tela cria. */
export function subDe(route: Route): string {
  const token = (route.request().headers()['authorization'] ?? '').replace(/^Bearer /u, '');
  const carga = JSON.parse(
    Buffer.from(token.split('.')[1] ?? 'e30', 'base64url').toString('utf-8'),
  );
  return String(carga.sub ?? 'sub-desconhecido');
}
