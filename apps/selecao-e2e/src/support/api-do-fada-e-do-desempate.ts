import type { Page, Route } from '@playwright/test';
import type { CriterioDesempateInput, DefinirFadaRequest } from '@uniplus/shared-data/selecao';
import type { JsonDaApi } from '@uniplus/shared-e2e';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, OPTIONS',
  'access-control-allow-headers': 'authorization, accept, content-type, idempotency-key',
};

/** O que o servidor recebeu do Fator de Atenuação e dos critérios de desempate. */
export interface FadaEDesempateGravados {
  readonly fada: JsonDaApi<DefinirFadaRequest>[];
  readonly desempates: JsonDaApi<readonly CriterioDesempateInput[]>[];
}

async function gravar<T>(route: Route, corpos: T[]): Promise<void> {
  const requisicao = route.request();
  if (requisicao.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  const corpo: T = requisicao.postDataJSON();
  corpos.push(corpo);
  return route.fulfill({ status: 204, headers: CORS });
}

/**
 * Captura o `PUT /fada` e o `PUT /criterios-desempate` do processo. Registrada depois das
 * rotas do processo, porque o Playwright consulta as rotas da mais recente para a mais antiga.
 */
export async function capturarFadaEDesempate(
  page: Page,
  processoId: string,
): Promise<FadaEDesempateGravados> {
  const gravados: FadaEDesempateGravados = { fada: [], desempates: [] };
  const base = `/api/selecao/processos-seletivos/${processoId}`;
  await page.route(new RegExp(`${base}/fada$`), (rota) => gravar(rota, gravados.fada));
  await page.route(new RegExp(`${base}/criterios-desempate$`), (rota) =>
    gravar(rota, gravados.desempates),
  );
  return gravados;
}
