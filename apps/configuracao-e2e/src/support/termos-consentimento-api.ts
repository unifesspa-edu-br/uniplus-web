import type { Page, Request, Route } from '@playwright/test';

export const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
};

export const ID = '01960000-0000-7000-0000-0000000000a1';

/** Atraso da releitura que segue a escrita: os botões ainda estão indisponíveis quando a escrita termina. */
export const ATRASO_DA_RECARGA_EM_MS = 1500;

export const TERMO = {
  id: ID,
  codigo: 'DECLARACAO_DE_VERACIDADE',
  nome: 'Declaração de veracidade',
  textoRascunho: 'Declaro que as informações são verdadeiras.',
  baseLegalRascunho: 'Lei nº 13.709/2018',
  formaAceiteRascunho: 'A_DEFINIR',
  revisado: false,
  revisadoEm: null,
  versoes: [] as unknown[],
  criadoEm: '2026-08-11T12:00:00Z',
};

export const TERMO_REVISADO = { ...TERMO, revisado: true, revisadoEm: '2026-08-11T13:00:00Z' };

export const TERMO_PROMOVIDO = {
  ...TERMO,
  versoes: [
    {
      id: '01960000-0000-7000-0000-0000000000a2',
      numero: 1,
      texto: TERMO.textoRascunho,
      baseLegal: TERMO.baseLegalRascunho,
      formaAceite: 'A_DEFINIR',
      hash: 'abcdef0123456789',
      promovidaEm: '2026-08-11T14:00:00Z',
    },
  ],
};

export const RESUMO = {
  id: ID,
  codigo: TERMO.codigo,
  nome: TERMO.nome,
  formaAceiteRascunho: 'A_DEFINIR',
  revisado: false,
  criadoEm: TERMO.criadoEm,
};

export const ERRO_INTERNO = {
  type: 'about:blank',
  title: 'Erro interno',
  status: 500,
  code: 'uniplus.internal.unexpected',
};

export const REMOCAO_BLOQUEADA = {
  type: 'about:blank',
  title: 'Termo com ao menos uma versão promovida não pode ser removido',
  status: 409,
  code: 'uniplus.configuracao.termo_consentimento.remocao_bloqueada_com_versao_promovida',
};

export const CONFLITO_DE_CONCORRENCIA = {
  type: 'about:blank',
  title: 'O rascunho foi modificado concorrentemente',
  status: 409,
  code: 'uniplus.configuracao.termo_consentimento.conflito_de_concorrencia',
};

export const RECUSA_DO_TEXTO = {
  type: 'about:blank',
  title: 'Dados inválidos',
  status: 422,
  code: 'uniplus.validacao',
  errors: [
    {
      field: 'TextoRascunho',
      code: 'uniplus.configuracao.termo_consentimento.texto_tamanho',
      message: 'Texto fora do tamanho permitido.',
    },
  ],
};

export const RECUSA_DO_NOME = {
  type: 'about:blank',
  title: 'Dados inválidos',
  status: 422,
  code: 'uniplus.validacao',
  errors: [
    {
      field: 'Nome',
      code: 'uniplus.configuracao.termo_consentimento.nome_tamanho',
      message: 'Nome fora do tamanho permitido.',
    },
  ],
};

export interface Resposta {
  readonly status: number;
  readonly corpo?: unknown;
}

/** O que a releitura do termo (e, depois da remoção, a lista) devolve. */
export type Releitura = 'com-o-termo' | 'com-falha';

export interface OpcoesDoMock {
  /** As respostas das escritas, na ordem; cada uma fica retida até `liberar`. */
  readonly respostas?: readonly Resposta[];
  /** O termo na primeira leitura. */
  readonly termo?: unknown;
  /** O termo nas leituras seguintes; por padrão, o mesmo. */
  readonly termoApos?: unknown;
  readonly releitura?: Releitura;
  readonly primeiraLeitura?: 'ok' | 'falha';
}

async function responder(route: Route, status: number, corpo: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: status >= 400 ? 'application/problem+json' : 'application/json',
    headers: CORS_HEADERS,
    body: status === 204 ? undefined : JSON.stringify(corpo),
  });
}

const esperar = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A API de termos de consentimento. As escritas ficam retidas até `liberar()` e são registradas
 * em `envios` ("PUT rascunho", "DELETE" etc.); a leitura do termo depois da primeira demora
 * `ATRASO_DA_RECARGA_EM_MS`; depois de uma remoção bem-sucedida, a lista não traz mais o termo.
 */
export async function mockTermosConsentimento(page: Page, opcoes: OpcoesDoMock = {}) {
  const estado: Estado = { envios: [], leituras: 0, removido: false };
  let liberar: () => void = () => undefined;
  const retida = new Promise<void>((resolve) => (liberar = resolve));
  await registrarRotas(page, opcoes, estado, retida);
  return { liberar, envios: estado.envios, leituras: () => estado.leituras };
}

async function registrarRotas(
  page: Page,
  opcoes: OpcoesDoMock,
  estado: Estado,
  retida: Promise<void>,
): Promise<void> {
  await registrarLeituras(page, opcoes, estado);
  const respostas = opcoes.respostas ?? [{ status: 204 }];
  await page.route(/\/api\/configuracao\/admin\/termos-consentimento(\/.*)?$/, (route) =>
    tratarEscrita({ route, respostas, estado, retida }),
  );
}

async function registrarLeituras(page: Page, opcoes: OpcoesDoMock, estado: Estado): Promise<void> {
  await page.route(/\/api\/configuracao\/termos-consentimento(\?.*)?$/, (route) =>
    tratarLista(route, estado),
  );
  await page.route(/\/api\/configuracao\/termos-consentimento\/[^/?]+$/, (route) =>
    tratarLeitura(route, opcoes, estado),
  );
}

interface Estado {
  readonly envios: string[];
  leituras: number;
  removido: boolean;
}

async function tratarLista(route: Route, estado: Estado): Promise<void> {
  if (estado.removido) await esperar(ATRASO_DA_RECARGA_EM_MS);
  await responder(route, 200, estado.removido ? [] : [RESUMO]);
}

async function tratarLeitura(route: Route, opcoes: OpcoesDoMock, estado: Estado): Promise<void> {
  estado.leituras += 1;
  const releitura = estado.leituras > 1;
  if (opcoes.primeiraLeitura === 'falha' && estado.leituras === 1) {
    await responder(route, 500, ERRO_INTERNO);
    return;
  }
  if (releitura) await esperar(ATRASO_DA_RECARGA_EM_MS);
  if (releitura && opcoes.releitura === 'com-falha') {
    await responder(route, 500, ERRO_INTERNO);
    return;
  }
  const termo = releitura ? (opcoes.termoApos ?? opcoes.termo ?? TERMO) : (opcoes.termo ?? TERMO);
  await responder(route, 200, termo);
}

interface Escrita {
  readonly route: Route;
  readonly respostas: readonly Resposta[];
  readonly estado: Estado;
  readonly retida: Promise<void>;
}

function descreverEnvio(requisicao: Request): string {
  const caminho = new URL(requisicao.url()).pathname.split('/').slice(5).join('/');
  return `${requisicao.method()} ${caminho.replace(ID, ':id')}`.trim();
}

async function tratarEscrita({ route, respostas, estado, retida }: Escrita): Promise<void> {
  const requisicao = route.request();
  if (requisicao.method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
    return;
  }
  const resposta = respostas[Math.min(estado.envios.length, respostas.length - 1)];
  estado.envios.push(descreverEnvio(requisicao));
  await retida;
  if (requisicao.method() === 'DELETE' && resposta.status < 400) estado.removido = true;
  await responderEscrita(route, resposta);
}

const responderEscrita = (route: Route, resposta: Resposta) =>
  responder(route, resposta.status, resposta.corpo ?? (resposta.status === 201 ? ID : undefined));
