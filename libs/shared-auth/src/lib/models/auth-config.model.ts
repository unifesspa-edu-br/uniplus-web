export interface AuthConfig {
  keycloakUrl: string;
  realm: string;
  clientId: string;
  /**
   * Lista de URLs (prefixos de origem) para as quais o `tokenInterceptor`
   * pode anexar o header `Authorization: Bearer`. Ex.: URL da API do
   * back-end e URL do próprio Keycloak. Requisições para qualquer outro
   * destino são enviadas sem Bearer.
   *
   * Sempre que o consumidor não configurar explicitamente, o interceptor
   * se comporta de forma conservadora (nenhum Bearer é anexado).
   */
  allowedUrls: readonly string[];
}
