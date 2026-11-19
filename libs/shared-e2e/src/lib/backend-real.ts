import type { Browser, Page } from '@playwright/test';

import { SENHA_DAS_PERSONAS } from './credenciais';
import { keycloakLogin } from './keycloak-login';

/**
 * Apoio das specs `*.backend.spec.ts`, que rodam contra a API, o Keycloak e o Kafka de verdade
 * (`E2E_BACKEND_REAL=1`). Concentra o que todas repetem: o token de uma persona fictícia do
 * portal, a chamada autenticada à API, a montagem de perfis e concessões pelo fluxo de pedido
 * (solicitação, aceite, aprovação funcional e da proteção de dados) e o login pela interface.
 *
 * Só persona do portal entra aqui: o login é o do realm `unifesspa` local, sem CPF, nome ou
 * e-mail inventado.
 */

const KEYCLOAK_URL = process.env['KEYCLOAK_URL'] ?? 'http://localhost:8080';
const REALM = 'unifesspa';

/** Endereço direto do monólito; as specs de interface usam o gateway pelo `runtime-config` do app. */
export const API_URL = process.env['E2E_API_URL'] ?? 'http://localhost:5200';

/** Personas que operam o fluxo de pedidos de concessão. */
export const GESTOR_DE_ACESSOS = 'leandro.viana';
export const SEGUNDO_GESTOR_DE_ACESSOS = 'diogo.souza';
/** Representante do controlador titular, que decide a segunda etapa. */
export const REPRESENTANTE_DO_CONTROLADOR = 'betina.neves';
export const SOLICITANTE_DE_PEDIDOS = 'manoel.aparicio';

export interface RespostaDaApi<T = unknown> {
  readonly status: number;
  readonly corpo: T;
  readonly cabecalhos: Headers;
}

interface IdentidadeDoToken {
  readonly sub: string;
  readonly email: string;
}

/** Folga antes do vencimento em que o token deixa de ser reaproveitado. */
const FOLGA_DO_TOKEN_MS = 30_000;

const tokens = new Map<string, { readonly token: string; readonly venceEm: number }>();

/** Token da persona pelo `admin-cli` (senha), reaproveitado até perto do vencimento: uma spec pode esperar minutos. */
export async function tokenDaPersona(username: string): Promise<string> {
  const guardado = tokens.get(username);
  if (guardado !== undefined && guardado.venceEm - FOLGA_DO_TOKEN_MS > Date.now()) {
    return guardado.token;
  }
  const token = await pedirToken(username);
  tokens.set(username, { token, venceEm: validadeDoToken(token) });
  return token;
}

const ENDERECO_DO_TOKEN = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`;

/** A senha da persona pelo `admin-cli`, no formulário que o endpoint de token espera. */
const credenciaisDa = (username: string) =>
  new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username,
    password: SENHA_DAS_PERSONAS,
  });

async function pedirToken(username: string): Promise<string> {
  const resposta = await fetch(ENDERECO_DO_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: credenciaisDa(username),
  });
  const json = (await resposta.json()) as { access_token?: string };
  if (json.access_token === undefined) {
    throw new Error(`Sem token para a persona ${username}: ${resposta.status}`);
  }
  return json.access_token;
}

function validadeDoToken(token: string): number {
  const [, carga] = token.split('.');
  const { exp } = JSON.parse(Buffer.from(carga ?? '', 'base64url').toString('utf-8')) as {
    exp: number;
  };
  return exp * 1000;
}

export function identidadeDoToken(token: string): IdentidadeDoToken {
  const [, carga] = token.split('.');
  return JSON.parse(Buffer.from(carga ?? '', 'base64url').toString('utf-8')) as IdentidadeDoToken;
}

export interface OpcoesDaChamada {
  readonly corpo?: unknown;
  readonly cabecalhos?: Record<string, string>;
}

export async function chamarApi<T = unknown>(
  username: string,
  metodo: string,
  caminho: string,
  opcoes: OpcoesDaChamada = {},
): Promise<RespostaDaApi<T>> {
  const token = await tokenDaPersona(username);
  const resposta = await fetch(`${API_URL}${caminho}`, {
    method: metodo,
    headers: cabecalhosDaChamada(token, metodo, opcoes),
    body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
  });
  const corpo = await corpoDaResposta(resposta);
  return { status: resposta.status, corpo: corpo as T, cabecalhos: resposta.headers };
}

/** O Bearer, a chave de idempotência nas escritas e o tipo do corpo, quando há corpo. */
function cabecalhosDaChamada(
  token: string,
  metodo: string,
  opcoes: OpcoesDaChamada,
): Record<string, string> {
  return {
    authorization: `Bearer ${token}`,
    ...(metodo === 'GET' ? {} : { 'idempotency-key': crypto.randomUUID() }),
    ...(opcoes.corpo === undefined ? {} : { 'content-type': 'application/json' }),
    ...opcoes.cabecalhos,
  };
}

/** O corpo em JSON; vazio vira `null`, e o que não é JSON (arquivo ou erro de proxy) segue como texto. */
async function corpoDaResposta(resposta: Response): Promise<unknown> {
  const texto = await resposta.text();
  if (texto === '') return null;
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

/**
 * Entra no app pela interface, com o login real do Keycloak, e devolve a página já autenticada.
 * O contexto é novo a cada chamada: cada persona vê só a própria sessão.
 */
export async function entrarComoPersona(
  browser: Browser,
  appBaseUrl: string,
  username: string,
  rotaProtegida = '/dashboard',
): Promise<Page> {
  const pagina = await paginaSemSessao(browser, appBaseUrl);
  await pagina.goto(rotaProtegida);
  const expectRedirectTo = new RegExp(appBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  await keycloakLogin(pagina, username, SENHA_DAS_PERSONAS, { expectRedirectTo });
  return pagina;
}

/** Sessão vazia: o project pode declarar o storageState do admin, e a persona precisa da própria. */
async function paginaSemSessao(browser: Browser, appBaseUrl: string): Promise<Page> {
  const semSessao = { cookies: [], origins: [] };
  const contexto = await browser.newContext({ baseURL: appBaseUrl, storageState: semSessao });
  return contexto.newPage();
}

/** Percorre uma listagem paginada por cursor, pelo `Link rel="next"`, até achar o item. */
export async function acharNaListagem<T>(
  username: string,
  caminho: string,
  procurado: (item: T) => boolean,
): Promise<T | undefined> {
  let proximo: string | null = caminho;
  while (proximo !== null) {
    const pagina: RespostaDaApi<T[]> = await paginaDaListagem<T>(username, proximo);
    const achado = pagina.corpo.find(procurado);
    if (achado !== undefined) return achado;
    proximo = proximaPagina(pagina.cabecalhos);
  }
  return undefined;
}

async function paginaDaListagem<T>(username: string, caminho: string): Promise<RespostaDaApi<T[]>> {
  const pagina = await chamarApi<T[]>(username, 'GET', caminho);
  if (!Array.isArray(pagina.corpo)) {
    throw new Error(
      `Listagem ${caminho} respondeu ${pagina.status}: ${JSON.stringify(pagina.corpo).slice(0, 300)}`,
    );
  }
  return pagina;
}

/** O caminho da próxima página, sem a origem, lido do `Link rel="next"`; `null` na última. */
function proximaPagina(cabecalhos: Headers): string | null {
  const link = /<([^>]+)>;\s*rel="next"/.exec(cabecalhos.get('link') ?? '');
  return link === null ? null : (link[1] ?? '').replace(/^https?:\/\/[^/]+/, '');
}
