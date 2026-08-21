/**
 * Configuração resolvida em runtime via `/assets/runtime-config.json`
 * (ADR-0021). A mesma imagem Docker é promovida entre ambientes; só o
 * ConfigMap montado pelo Kubernetes muda o conteúdo deste arquivo.
 *
 * Não embute URL de API/provedor OIDC no bundle (ADR-0020 do publish:
 * imagem única por app).
 */
export interface OidcRuntimeConfig {
  readonly issuerUrl: string;
  readonly clientId: string;
}

export interface AppConfig {
  readonly apiUrl: string;
  /**
   * Origin do backend geo, quando genuinamente separado do `apiUrl` (ex.:
   * HML, onde `geo-api` é um deployable próprio, host distinto). Opcional:
   * ausente cai no `apiUrl` (dev local, onde um único gateway proxeia
   * `uniplus-api` e `geo-api` sob a mesma origin).
   */
  readonly geoApiUrl?: string;
  readonly oidc: OidcRuntimeConfig;
}

export function resolveOidcConfig(cfg: AppConfig): OidcRuntimeConfig {
  if (!cfg.oidc) {
    throw new Error(
      'runtime-config.json deve conter o bloco "oidc" com issuerUrl e clientId.',
    );
  }
  return cfg.oidc;
}
