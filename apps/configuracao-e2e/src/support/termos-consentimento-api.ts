import type { Page, Route } from '@playwright/test';

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
  nome: TERMO.nome,
  formaAceiteRascunho: 'A_DEFINIR',
  revisado: false,
  criadoEm: TERMO.criadoEm,
};

export const ERRO_INTERNO = {
  type: 'about:blank',
  title: 'Erro interno',
  status: 500,
  code: 'uniplus.erro_interno',
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
  const respostas = opcoes.respostas ?? [{ status: 204 }];
  const envios: string[] = [];
  let liberar: () => void = () => undefined;
  const retida = new Promise<void>((resolve) => (liberar = resolve));
  let leituras = 0;
  let removido = false;

  await page.route(/\/api\/configuracao\/termos-consentimento(\?.*)?$/, async (route) => {
    if (removido) await esperar(ATRASO_DA_RECARGA_EM_MS);
    await responder(route, 200, removido ? [] : [RESUMO]);
  });
  await page.route(/\/api\/configuracao\/termos-consentimento\/[^/?]+$/, async (route) => {
    leituras += 1;
    if (opcoes.primeiraLeitura === 'falha' && leituras === 1) {
      await responder(route, 500, ERRO_INTERNO);
      return;
    }
    if (leituras > 1) await esperar(ATRASO_DA_RECARGA_EM_MS);
    if (leituras > 1 && opcoes.releitura === 'com-falha') {
      await responder(route, 500, ERRO_INTERNO);
      return;
    }
    const termo =
      leituras > 1 ? (opcoes.termoApos ?? opcoes.termo ?? TERMO) : (opcoes.termo ?? TERMO);
    await responder(route, 200, termo);
  });
  await page.route(/\/api\/configuracao\/admin\/termos-consentimento(\/.*)?$/, async (route) => {
    const requisicao = route.request();
    if (requisicao.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    const resposta = respostas[Math.min(envios.length, respostas.length - 1)];
    const caminho = new URL(requisicao.url()).pathname.split('/').slice(5).join('/');
    envios.push(`${requisicao.method()} ${caminho.replace(ID, ':id')}`.trim());
    await retida;
    if (requisicao.method() === 'DELETE' && resposta.status < 400) removido = true;
    await responder(
      route,
      resposta.status,
      resposta.corpo ?? (resposta.status === 201 ? ID : undefined),
    );
  });
  return { liberar, envios, leituras: () => leituras };
}
