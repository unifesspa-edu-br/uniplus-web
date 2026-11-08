import type { Page, Route } from '@playwright/test';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept',
};

const ERRO_INTERNO = {
  type: 'about:blank',
  title: 'Erro interno',
  status: 500,
  code: 'uniplus.internal.unexpected',
};

export const CAMPUS = {
  id: '01960000-0000-7000-0000-0000000000b1',
  sigla: 'MARABA',
  nome: 'Campus de Marabá',
  codigoEmec: '12345',
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

const CURSO = {
  id: '01960000-0000-7000-0000-0000000000c1',
  codigo: 'ENG-CIV',
  nome: 'Engenharia Civil',
  grau: 'Bacharelado',
  nivelEnsino: 'Graduação',
  grupoAreaEnem: { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' },
  criadoEm: '2026-06-10T12:00:00Z',
};

const ATRASO_EM_MS = Number(process.env['ATRASO_DA_NOVA_TENTATIVA_EM_MS'] ?? 800);

export async function responder(route: Route, falha: boolean, corpo: unknown): Promise<void> {
  await route.fulfill({
    status: falha ? 500 : 200,
    headers: CORS_HEADERS,
    contentType: falha ? 'application/problem+json' : 'application/json',
    body: JSON.stringify(falha ? ERRO_INTERNO : corpo),
  });
}

/** A primeira leitura falha; as seguintes demoram e seguem `desfecho`. */
export async function simularCampi(page: Page, desfecho: 'falha' | 'sucesso'): Promise<void> {
  let consultas = 0;
  await page.route(/\/api\/configuracao\/campi(\?.*)?$/, async (route) => {
    consultas += 1;
    if (consultas > 1) await new Promise((resolve) => setTimeout(resolve, ATRASO_EM_MS));
    await responder(route, consultas === 1 || desfecho === 'falha', [CAMPUS]);
  });
}

/** A listagem de ofertas abre com o catálogo de cursos em falha; as leituras seguintes demoram e a terceira dá certo. */
export async function simularOfertas(page: Page): Promise<void> {
  await page.route(/\/api\/configuracao\/ofertas-curso(\?.*)?$/, (route) =>
    responder(route, false, []),
  );
  await page.route(/\/api\/configuracao\/locais-oferta(\?.*)?$/, (route) =>
    responder(route, false, []),
  );
  await page.route(/\/api\/organizacao\/unidades(\?.*)?$/, (route) => responder(route, false, []));
  let consultasAosCursos = 0;
  await page.route(/\/api\/configuracao\/cursos(\?.*)?$/, async (route) => {
    consultasAosCursos += 1;
    if (consultasAosCursos > 1) await new Promise((resolve) => setTimeout(resolve, ATRASO_EM_MS));
    await responder(route, consultasAosCursos < 3, [CURSO]);
  });
}
