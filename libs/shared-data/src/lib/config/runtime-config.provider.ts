import {
  APP_INITIALIZER,
  EnvironmentProviders,
  InjectionToken,
  Provider,
  makeEnvironmentProviders,
} from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  AUTH_CONFIG,
  AUTORIZACAO_BASE_PATH,
  AuthService,
  PROFILE_BASE_PATH,
} from '@uniplus/shared-auth/bootstrap';
import type { AuthConfig } from '@uniplus/shared-auth/bootstrap';
import {
  CONFIGURACAO_BASE_PATH,
  GEO_BASE_PATH,
  INGRESSO_BASE_PATH,
  ORGANIZACAO_BASE_PATH,
  PORTAL_BASE_PATH,
  PUBLICACOES_BASE_PATH,
  SELECAO_BASE_PATH,
} from '@uniplus/shared-data/tokens';
import { AppConfigService } from './app-config.service';
import { resolveOidcConfig, type AppConfig } from './app-config.model';

/**
 * Path canônico do runtime-config (ADR-0021). nginx serve este arquivo
 * (presente como placeholder na imagem; sobrescrito por ConfigMap K8s
 * em produção) com `Cache-Control: no-store`.
 *
 * Resolvido relativo a `document.baseURI` (não fixo em `/assets/...`) para
 * respeitar o `<base href>` quando o app é servido sob subpath, o mesmo `baseHref: "./"` que já faz o Angular resolver assets e
 * rotas corretamente sob `/portal/`, `/selecao/` etc.
 */
export function resolveRuntimeConfigPath(): string {
  return new URL('assets/runtime-config.json', document.baseURI).toString();
}

/**
 * Origin do backend geo: `geoApiUrl` quando configurado (ambientes onde
 * `geo-api` é deployable separado, host próprio — ex. HML), senão cai no
 * mesmo `apiUrl` dos demais módulos (dev local, gateway único).
 */
export function resolveGeoBasePath(store: AppConfigService): string {
  return store.get().geoApiUrl ?? store.get().apiUrl;
}

/**
 * Bootstrap completo de runtime-config + autenticação num **único**
 * `APP_INITIALIZER` (ADR-0021). Consolidar é necessário porque o
 * Angular dispara initializers em paralelo (não em série), então um
 * `AUTH_CONFIG` factory injetado por outro initializer pode resolver
 * antes do store estar populado. Encadeamos sequencialmente aqui:
 *
 *   1. `HttpBackend.handle()` — bypass intencional dos interceptors
 *      `tokenInterceptor`, `apiResultInterceptor`, `authErrorInterceptor`.
 *      Sem isso, o fetch do `runtime-config.json` tentaria resolver
 *      `AUTH_ALLOWED_URLS` (que depende de `AUTH_CONFIG` não-loaded) e
 *      a resposta JSON viria envelopada em `ApiResult<T>` em vez do
 *      `AppConfig` literal.
 *   2. `AppConfigService.load(cfg)` — populando o singleton.
 *   3. `AuthService.init(authConfig)` — cliente OIDC inicializado com
 *      URLs reais já carregadas.
 *
 * `AUTH_CONFIG`, `AUTORIZACAO_BASE_PATH`, `SELECAO_BASE_PATH`, `INGRESSO_BASE_PATH`,
 * `ORGANIZACAO_BASE_PATH`, `CONFIGURACAO_BASE_PATH`, `PUBLICACOES_BASE_PATH`, `PORTAL_BASE_PATH` e
 * `GEO_BASE_PATH` continuam
 * provedidos como factories síncronas que leem do store. São injetados
 * lazy (ex.: `tokenInterceptor` lê `AUTH_ALLOWED_URLS` no primeiro HTTP
 * request, que ocorre post-bootstrap, quando store já está populado).
 *
 * Erros de fetch (404, JSON malformado, network) são re-lançados — o
 * Angular aborta o bootstrap e exibe console error claro, em vez de
 * subir a app em estado inconsistente.
 */
export function provideRuntimeConfig(): EnvironmentProviders {
  return makeEnvironmentProviders([
    INICIALIZADOR_DO_RUNTIME_CONFIG,
    CONFIGURACAO_DE_AUTENTICACAO,
    ...TOKENS_NA_API_URL.map(provedorDaApiUrl),
    { provide: GEO_BASE_PATH, useFactory: resolveGeoBasePath, deps: [AppConfigService] },
  ]);
}

const INICIALIZADOR_DO_RUNTIME_CONFIG: Provider = {
  provide: APP_INITIALIZER,
  useFactory: carregarRuntimeConfigEIniciarAutenticacao,
  deps: [HttpBackend, AppConfigService, AuthService],
  multi: true,
};

const CONFIGURACAO_DE_AUTENTICACAO: Provider = {
  provide: AUTH_CONFIG,
  useFactory: (store: AppConfigService): AuthConfig => toAuthConfig(store.get()),
  deps: [AppConfigService],
};

function provedorDaApiUrl(token: InjectionToken<string>): Provider {
  return {
    provide: token,
    useFactory: (store: AppConfigService) => store.get().apiUrl,
    deps: [AppConfigService],
  };
}

/** Os módulos que a API serve na mesma origem, a `apiUrl`. */
const TOKENS_NA_API_URL: readonly InjectionToken<string>[] = [
  PROFILE_BASE_PATH,
  AUTORIZACAO_BASE_PATH,
  SELECAO_BASE_PATH,
  INGRESSO_BASE_PATH,
  ORGANIZACAO_BASE_PATH,
  CONFIGURACAO_BASE_PATH,
  PUBLICACOES_BASE_PATH,
  PORTAL_BASE_PATH,
];

function carregarRuntimeConfigEIniciarAutenticacao(
  backend: HttpBackend,
  store: AppConfigService,
  auth: AuthService,
): () => Promise<void> {
  return async () => {
    const cfg = await lerRuntimeConfig(backend);
    assertNaoEhPlaceholder(cfg);
    store.load(cfg);
    await auth.init(toAuthConfig(cfg));
  };
}

/**
 * `HttpClient` construído com `HttpBackend` direto não passa por nenhum interceptor — necessário
 * porque o pipeline padrão depende de tokens que ainda não estão prontos neste momento.
 */
function lerRuntimeConfig(backend: HttpBackend): Promise<AppConfig> {
  return firstValueFrom(new HttpClient(backend).get<AppConfig>(resolveRuntimeConfigPath()));
}

export function toAuthConfig(cfg: AppConfig): AuthConfig {
  const oidc = resolveOidcConfig(cfg);
  return {
    issuerUrl: oidc.issuerUrl,
    clientId: oidc.clientId,
    allowedUrls: Object.freeze(urlsComBearer(cfg, oidc.issuerUrl)),
  };
}

/**
 * `geoApiUrl` só entra na allowlist quando difere de `apiUrl` (host genuinamente separado, ex.
 * HML) — evita duplicar a mesma origin em dev local, onde cai no fallback do `apiUrl`
 * (`resolveGeoBasePath`). Sem isso, `tokenInterceptor` não anexa o Bearer em requests para o
 * `geoApiUrl`, e `/api/cep` e `/api/cidades` exigem autenticação (401).
 */
function urlsComBearer(cfg: AppConfig, issuerUrl: string): string[] {
  const geoSeparado = cfg.geoApiUrl && cfg.geoApiUrl !== cfg.apiUrl;
  return geoSeparado ? [cfg.apiUrl, issuerUrl, cfg.geoApiUrl] : [cfg.apiUrl, issuerUrl];
}

/**
 * Sentinelas embutidos no `docker/runtime-config.json` (que sobrescreve o
 * placeholder dev no build da imagem). Em produção sem ConfigMap K8s
 * montado corretamente, o app receberia esses valores e — porque
 * `AuthService.init()` captura erros do provedor OIDC — subiria
 * silenciosamente em modo "não autenticado" tentando alcançar URLs
 * `.invalid`.
 *
 * Ao detectar qualquer marcador, abortamos o bootstrap antes de
 * `store.load()` e `auth.init()` — falha visível no console + tela em
 * branco em vez de runtime quebrado em UX.
 */
const PLACEHOLDER_MARKERS = ['PLACEHOLDER_', 'configmap-nao-montado.invalid'] as const;

function assertNaoEhPlaceholder(cfg: AppConfig): void {
  const serializado = JSON.stringify(cfg);
  for (const marca of PLACEHOLDER_MARKERS) {
    if (serializado.includes(marca)) {
      throw new Error(
        `runtime-config.json contém placeholder '${marca}'. ConfigMap K8s ` +
          `provavelmente não está montado em ${resolveRuntimeConfigPath()} (ADR-0021). ` +
          `Bootstrap abortado para evitar app subir em estado inconsistente.`,
      );
    }
  }
}
