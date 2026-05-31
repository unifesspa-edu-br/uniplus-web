import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { appRoutes } from './app.routes';
import { loadingInterceptor } from '@uniplus/shared-core/interceptors/loading.interceptor';
import { apiResultInterceptor } from '@uniplus/shared-core/http/api-result.interceptor';
import { provideRuntimeConfig } from '@uniplus/shared-data/config';
import { authErrorInterceptor } from '@uniplus/shared-auth/interceptors/auth-error.interceptor';
import { tokenInterceptor } from '@uniplus/shared-auth/interceptors/token.interceptor';
import { provideAuth } from '@uniplus/shared-auth/providers/auth.provider';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes, withComponentInputBinding()),
    // Ordem dos interceptors (ADR-0011 + ADR-0012):
    // - tokenInterceptor: anexa Bearer e renova token quando próximo do expiry.
    // - loadingInterceptor: liga/desliga o spinner global via `finalize`.
    // - authErrorInterceptor: lê o `HttpResponse` envelopado pelo apiResult e
    //   reage a 401/403 com login()/redirect.
    // - apiResultInterceptor: envelopa toda response em `ApiResult<T>` para o
    //   consumer; é o mais interno, então parseia antes de authError ler.
    provideHttpClient(
      withInterceptors([
        tokenInterceptor,
        loadingInterceptor,
        authErrorInterceptor,
        apiResultInterceptor,
      ]),
    ),
    // Runtime config (ADR-0021) — fetch /assets/runtime-config.json antes
    // do bootstrap das rotas + provê AUTH_CONFIG, SELECAO_BASE_PATH e
    // INGRESSO_BASE_PATH a partir do AppConfigService. DEVE vir antes de
    // provideAuth() (que consome AUTH_CONFIG via factory).
    provideRuntimeConfig(),
    provideAuth(),
  ],
};
