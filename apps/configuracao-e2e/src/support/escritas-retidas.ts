import type { Request, Route } from '@playwright/test';

/** Apoio dos mocks que retêm cada escrita até o teste liberá-la, para conferir a tela pendente. */

export const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, accept, idempotency-key',
  'access-control-expose-headers': 'etag',
};

/** Atraso da recarga da lista após a escrita: o botão da linha ainda está indisponível quando a sobreposição fecha. */
export const ATRASO_DA_RECARGA_EM_MS = 1500;

export type Recarga = 'com-o-item' | 'sem-o-item' | 'com-falha';
/** `listaMudou`: a escrita foi recusada porque a lista já estava desatualizada; a recarga traz o estado novo. */
export type Resposta = { status: number; corpo?: unknown; listaMudou?: boolean };
export type Envio = { metodo: string; caminho: string; corpo: unknown; chave: string | undefined };

export const OK = { status: 204 };

export const problema = (status: number, code: string, title: string, errors?: unknown[]) => ({
  type: 'about:blank',
  title,
  status,
  code,
  ...(errors ? { errors } : {}),
});
export const ERRO_INTERNO = problema(500, 'uniplus.internal.unexpected', 'Erro interno');

export async function responder(route: Route, resposta: Resposta): Promise<void> {
  const { status, corpo } = resposta;
  const conteudo =
    corpo === undefined
      ? {}
      : {
          contentType: status >= 400 ? 'application/problem+json' : 'application/json',
          body: JSON.stringify(corpo),
        };
  await route.fulfill({ status, headers: CORS_HEADERS, ...conteudo });
}

export const responderPreflight = (route: Route) =>
  route.fulfill({ status: 204, headers: CORS_HEADERS });

export const esperarARecarga = () =>
  new Promise((resolve) => setTimeout(resolve, ATRASO_DA_RECARGA_EM_MS));

/** A escrita como a tela a enviou: método, caminho, corpo e a chave de idempotência, se lida. */
export function envioDe(requisicao: Request, chave: string | undefined): Envio {
  return {
    metodo: requisicao.method(),
    caminho: new URL(requisicao.url()).pathname,
    corpo: requisicao.postData() === null ? null : requisicao.postDataJSON(),
    chave,
  };
}

/** Uma barreira que retém as escritas até o teste chamar `liberar`. */
export function reter(): { retida: Promise<void>; liberar: () => void } {
  let liberar: () => void = () => undefined;
  const retida = new Promise<void>((resolve) => (liberar = resolve));
  return { retida, liberar };
}
