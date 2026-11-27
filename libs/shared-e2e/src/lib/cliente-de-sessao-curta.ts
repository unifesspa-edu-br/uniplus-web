import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import { autenticarAdmin, KEYCLOAK_BASE, KEYCLOAK_REALM } from './keycloak-login';

/** Prazos curtos, em segundos, que só o cliente de teste recebe: o realm compartilhado não muda. */
export interface PrazosDaSessaoCurta {
  readonly acessoEmSegundos: number;
  readonly ociosidadeEmSegundos: number;
}

export interface ClienteDeSessaoCurta {
  readonly clientId: string;
  /** Apaga o cliente, mesmo que o teste tenha falhado. */
  readonly remover: () => Promise<void>;
}

/**
 * Cria no realm um cliente de login só deste teste, copiando o cliente do aplicativo, mas com o
 * acesso e a ociosidade da sessão curtos. Assim o fim da sessão acontece em segundos reais, sem
 * mexer nos prazos que os outros testes usam.
 */
export async function criarClienteDeSessaoCurta(
  appBaseUrl: string,
  prazos: PrazosDaSessaoCurta,
): Promise<ClienteDeSessaoCurta> {
  const clientId = `sessao-curta-e2e-${Date.now()}`;
  const api = await playwrightRequest.newContext({ baseURL: KEYCLOAK_BASE });
  const clientes = `/admin/realms/${KEYCLOAK_REALM}/clients`;
  const criado = await api.post(clientes, {
    headers: await autenticarAdmin(api),
    data: corpoDoCliente(clientId, appBaseUrl, prazos),
  });
  if (!criado.ok()) throw new Error(`Falha ao criar o cliente de teste: ${criado.status()}`);
  const id = (criado.headers()['location'] ?? '').split('/').pop() ?? '';
  return { clientId, remover: () => apagarCliente(api, `${clientes}/${id}`) };
}

function corpoDoCliente(clientId: string, appBaseUrl: string, prazos: PrazosDaSessaoCurta) {
  return {
    clientId,
    publicClient: true,
    standardFlowEnabled: true,
    redirectUris: [`${appBaseUrl}/*`],
    webOrigins: [appBaseUrl],
    attributes: {
      'pkce.code.challenge.method': 'S256',
      'access.token.lifespan': String(prazos.acessoEmSegundos),
      'client.session.idle.timeout': String(prazos.ociosidadeEmSegundos),
    },
  };
}

/** Entra de novo como administrador, porque o acesso obtido na criação pode ter vencido. */
async function apagarCliente(api: APIRequestContext, caminho: string): Promise<void> {
  try {
    const apagado = await api.delete(caminho, { headers: await autenticarAdmin(api) });
    if (!apagado.ok()) throw new Error(`Falha ao apagar o cliente de teste: ${apagado.status()}`);
  } finally {
    await api.dispose();
  }
}
