import type { Page, Route } from '@playwright/test';
import { responderCom } from './responder';

export const CORS_DE_LEITURA = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, accept',
};

function corpoDoProcesso(id: string, detalhe: unknown, caminho: string): unknown {
  if (caminho.endsWith(id)) return detalhe;
  if (caminho.endsWith('/conformidade')) return { processoSeletivoId: id, itens: [], avisos: [] };
  return [];
}

function atenderProcesso(id: string, detalhe: unknown) {
  return async (route: Route): Promise<void> => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_DE_LEITURA });
      return;
    }
    const caminho = new URL(route.request().url()).pathname;
    await responderCom(route, corpoDoProcesso(id, detalhe, caminho), CORS_DE_LEITURA);
  };
}

/** O detalhe, os documentos e o checklist de um processo, todos sob o mesmo prefixo. */
export async function mockarProcessoSeletivo(
  page: Page,
  id: string,
  detalhe: unknown,
): Promise<void> {
  const prefixo = new RegExp(`/api/selecao/processos-seletivos/${id}(/.*)?(\\?.*)?$`);
  await page.route(prefixo, atenderProcesso(id, detalhe));
}
