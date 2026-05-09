/**
 * Configuração resolvida em runtime via `/assets/runtime-config.json`
 * (ADR-0021). A mesma imagem Docker é promovida entre ambientes; só o
 * ConfigMap montado pelo Kubernetes muda o conteúdo deste arquivo.
 *
 * Não embute URL de Keycloak/API no bundle (ADR-0020 do publish: imagem
 * única por app).
 */
export interface AppConfig {
  readonly apiUrl: string;
  readonly keycloak: {
    readonly url: string;
    readonly realm: string;
    readonly clientId: string;
  };
}
