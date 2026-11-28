import type { Page } from '@playwright/test';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept',
};

/** O que a API devolve em `/vocabularios/tipos-campo`: o código e o rótulo de cada tipo, na ordem dela. */
export const TIPOS_DE_CAMPO = [
  'NUMERO',
  'SIM_OU_NAO',
  'ESCOLHA_UNICA',
  'ESCOLHA_MULTIPLA',
  'TEXTO',
  'DATA',
  'ENDERECO',
  'MUNICIPIO',
].map((codigo) => ({ codigo, rotulo: `Rótulo simulado: ${codigo}` }));

/** Responde o vocabulário de tipos de campo que o editor de formulário lê ao abrir. */
export async function mockarVocabularioDeTiposDeCampo(page: Page): Promise<void> {
  await page.route(/\/api\/configuracao\/vocabularios\/tipos-campo$/, (route) =>
    route.fulfill({ status: 200, headers: CORS_HEADERS, json: TIPOS_DE_CAMPO }),
  );
}
