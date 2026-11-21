import type { Page } from '@playwright/test';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept',
};

/** O que a API devolve em `/vocabularios/tipos-de-decisao`: o código e o rótulo de cada tipo. */
export const TIPOS_DE_DECISAO = [
  { codigo: 'ISENCAO_DA_TAXA', rotulo: 'Isenção da taxa' },
  { codigo: 'GABARITO_DA_PROVA', rotulo: 'Gabarito da prova' },
] as const;

/** Responde o vocabulário de tipos de decisão que o formulário de tipo de banca e a tela de motivos leem. */
export async function mockarVocabularioDeTiposDeDecisao(page: Page): Promise<void> {
  await page.route(/\/api\/configuracao\/vocabularios\/tipos-de-decisao$/, (route) =>
    route.fulfill({ status: 200, headers: CORS_HEADERS, json: TIPOS_DE_DECISAO }),
  );
}
