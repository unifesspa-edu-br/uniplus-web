import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { appRoutes } from './app.routes';
import { apiResultInterceptor, loadingInterceptor } from '@uniplus/shared-core';
import { provideRuntimeConfig } from '@uniplus/shared-data';
import { authErrorInterceptor, provideAuth, tokenInterceptor } from '@uniplus/shared-auth';

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
    // AppConfigService. DEVE vir antes de provideAuth().
    provideRuntimeConfig(),
    provideAuth(),
  ],
};
