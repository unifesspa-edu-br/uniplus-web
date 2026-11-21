import type { Page, Route } from '@playwright/test';
import type {
  CriterioDesempateInput,
  DefinirBonusRegionalRequest,
} from '@uniplus/shared-data/selecao';
import type { JsonDaApi } from '@uniplus/shared-e2e';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, OPTIONS',
  'access-control-allow-headers': 'authorization, accept, content-type, idempotency-key',
};

/** O que o servidor recebeu do bônus regional e dos critérios de desempate. */
export interface BonusEDesempateGravados {
  readonly bonus: JsonDaApi<DefinirBonusRegionalRequest>[];
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
 * Captura o `PUT /bonus-regional` e o `PUT /criterios-desempate` do processo. Registrada depois das
 * rotas do processo, porque o Playwright consulta as rotas da mais recente para a mais antiga.
 */
export async function capturarBonusEDesempate(
  page: Page,
  processoId: string,
): Promise<BonusEDesempateGravados> {
  const gravados: BonusEDesempateGravados = { bonus: [], desempates: [] };
  const base = `/api/selecao/processos-seletivos/${processoId}`;
  await page.route(new RegExp(`${base}/bonus-regional$`), (rota) => gravar(rota, gravados.bonus));
  await page.route(new RegExp(`${base}/criterios-desempate$`), (rota) =>
    gravar(rota, gravados.desempates),
  );
  return gravados;
}
