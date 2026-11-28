import type { Page, Response } from '@playwright/test';

const ENDPOINT_DE_TOKEN = '/protocol/openid-connect/token';

/** O que o provedor informou numa resposta do endpoint de token. */
export interface SessaoDoToken {
  readonly sid: string;
  /** Vencimento da credencial de renovação, em segundos do servidor. */
  readonly fimDoPeriodo: number;
  /** Instante da autenticação, em segundos do servidor. */
  readonly autenticadoEm: number;
}

export interface AcompanhamentoDosTokens {
  /** Uma entrada por resposta aceita do endpoint de token. */
  readonly sessoes: SessaoDoToken[];
  /** O `grant_type` de cada pedido ao endpoint de token, na ordem em que saíram. */
  readonly pedidos: string[];
  /** Quantos pedidos de renovação (`refresh_token`) já saíram. */
  readonly renovacoes: () => number;
}

/**
 * Observa o endpoint de token desde o primeiro pedido: ligue antes de `page.goto`. Separa o
 * login e a volta da página (`authorization_code`) das renovações (`refresh_token`).
 */
export function acompanharTokens(page: Page): AcompanhamentoDosTokens {
  const sessoes: SessaoDoToken[] = [];
  const pedidos: string[] = [];
  page.on('request', (pedido) => {
    if (!pedido.url().includes(ENDPOINT_DE_TOKEN)) return;
    pedidos.push(new URLSearchParams(pedido.postData() ?? '').get('grant_type') ?? '');
  });
  page.on('response', (resposta) => guardarSessao(resposta, sessoes));
  return {
    sessoes,
    pedidos,
    renovacoes: () => pedidos.filter((g) => g === 'refresh_token').length,
  };
}

async function guardarSessao(resposta: Response, sessoes: SessaoDoToken[]): Promise<void> {
  if (!resposta.url().includes(ENDPOINT_DE_TOKEN) || !resposta.ok()) return;
  const corpo = await resposta.json().catch(() => null);
  if (!corpo?.access_token || !corpo?.refresh_token) return;
  sessoes.push({
    sid: payloadDe(corpo.access_token)['sid'] as string,
    fimDoPeriodo: payloadDe(corpo.refresh_token)['exp'] as number,
    autenticadoEm: payloadDe(corpo.access_token)['auth_time'] as number,
  });
}

function payloadDe(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
}
