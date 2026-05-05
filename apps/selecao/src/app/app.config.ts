import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { appRoutes } from './app.routes';
import { apiResultInterceptor, loadingInterceptor } from '@uniplus/shared-core';
import {
  INGRESSO_BASE_PATH,
  SELECAO_BASE_PATH,
} from '@uniplus/shared-data';
import { authErrorInterceptor, provideAuth, tokenInterceptor } from '@uniplus/shared-auth';
import { environment } from '../environments/environment';

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
    provideAuth({
      keycloakUrl: environment.keycloak.url,
      realm: environment.keycloak.realm,
      clientId: environment.keycloak.clientId,
      allowedUrls: [environment.apiUrl, environment.keycloak.url],
    }),
    // BASE_PATH dos clientes gerados (ADR-0013) — origin absoluta da
    // uniplus-api. Versionamento por recurso (ADR-0028) é injetado pelo
    // apiResultInterceptor via withVendorMime, não via prefixo de URL.
    { provide: SELECAO_BASE_PATH, useValue: environment.apiUrl },
    { provide: INGRESSO_BASE_PATH, useValue: environment.apiUrl },
  ],
};
