import { APP_INITIALIZER, EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AUTH_CONFIG, AuthService } from '@uniplus/shared-auth/bootstrap';
import type { AuthConfig } from '@uniplus/shared-auth/bootstrap';
import { INGRESSO_BASE_PATH } from '@uniplus/shared-data/ingresso';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { AppConfigService } from './app-config.service';
import { resolveOidcConfig, type AppConfig } from './app-config.model';

/**
 * Path canônico do runtime-config (ADR-0021). nginx serve este arquivo
 * (presente como placeholder na imagem; sobrescrito por ConfigMap K8s
 * em produção) com `Cache-Control: no-store`.
 */
export const RUNTIME_CONFIG_PATH = '/assets/runtime-config.json';

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
 * `AUTH_CONFIG`, `SELECAO_BASE_PATH` e `INGRESSO_BASE_PATH` continuam
 * provedidos como factories síncronas que leem do store. São injetados
 * lazy (ex.: `tokenInterceptor` lê `AUTH_ALLOWED_URLS` no primeiro HTTP
 * request, que ocorre post-bootstrap, quando store já está populado).
 *
 * Erros de fetch (404, JSON malformado, network) são re-lançados — o
 * Angular aborta o bootstrap e exibe console error claro, em vez de
 * subir a app em estado inconsistente (CA-02 da Story #84).
 */
export function provideRuntimeConfig(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: APP_INITIALIZER,
      useFactory:
        (backend: HttpBackend, store: AppConfigService, auth: AuthService) => async () => {
          // HttpClient construído com HttpBackend direto não passa por
          // nenhum interceptor — necessário porque o pipeline padrão
          // depende de tokens que ainda não estão prontos neste momento.
          const http = new HttpClient(backend);
          const cfg = await firstValueFrom(http.get<AppConfig>(RUNTIME_CONFIG_PATH));
          assertNaoEhPlaceholder(cfg);
          store.load(cfg);
          await auth.init(toAuthConfig(cfg));
        },
      deps: [HttpBackend, AppConfigService, AuthService],
      multi: true,
    },
    {
      provide: AUTH_CONFIG,
      useFactory: (store: AppConfigService): AuthConfig => toAuthConfig(store.get()),
      deps: [AppConfigService],
    },
    {
      provide: SELECAO_BASE_PATH,
      useFactory: (store: AppConfigService) => store.get().apiUrl,
      deps: [AppConfigService],
    },
    {
      provide: INGRESSO_BASE_PATH,
      useFactory: (store: AppConfigService) => store.get().apiUrl,
      deps: [AppConfigService],
    },
  ]);
}

function toAuthConfig(cfg: AppConfig): AuthConfig {
  const oidc = resolveOidcConfig(cfg);
  return {
    issuerUrl: oidc.issuerUrl,
    clientId: oidc.clientId,
    allowedUrls: Object.freeze([cfg.apiUrl, oidc.issuerUrl]),
  };
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
          `provavelmente não está montado em /assets/runtime-config.json (ADR-0021). ` +
          `Bootstrap abortado para evitar app subir em estado inconsistente.`,
      );
    }
  }
}
