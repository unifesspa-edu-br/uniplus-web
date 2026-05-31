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
    // Ordem dos interceptors (ADR-0011 + ADR-0012): apiResultInterceptor é
    // o mais interno e envelopa toda response em `ApiResult<T>` antes de
    // chegar ao authErrorInterceptor, que lê o status do `HttpResponse`
    // envelopado para disparar login()/redirect em 401/403.
    provideHttpClient(
      withInterceptors([
        tokenInterceptor,
        loadingInterceptor,
        authErrorInterceptor,
        apiResultInterceptor,
      ]),
    ),
    // Runtime config (ADR-0021) — fetch /assets/runtime-config.json antes
    // do bootstrap das rotas + provê AUTH_CONFIG e BASE_PATHs a partir do
    // AppConfigService. Portal pode consumir endpoints públicos de selecao
    // e ingresso, então ambos os BASE_PATHs vêm da mesma apiUrl.
    provideRuntimeConfig(),
    provideAuth(),
  ],
};
