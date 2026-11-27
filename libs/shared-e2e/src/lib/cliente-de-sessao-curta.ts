import { request as playwrightRequest } from '@playwright/test';
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
  const cabecalho = await autenticarAdmin(api);
  const clientes = `/admin/realms/${KEYCLOAK_REALM}/clients`;
  const criado = await api.post(clientes, {
    headers: cabecalho,
    data: {
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
    },
  });
  if (!criado.ok()) throw new Error(`Falha ao criar o cliente de teste: ${criado.status()}`);
  const id = (criado.headers()['location'] ?? '').split('/').pop();
  const remover = async () => {
    await api.delete(`${clientes}/${id}`, { headers: cabecalho });
    await api.dispose();
  };
  return { clientId, remover };
}
