import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { appRoutes } from './app.routes';
import { apiResultInterceptor, loadingInterceptor } from '@uniplus/shared-core';
import { authErrorInterceptor, provideAuth, tokenInterceptor } from '@uniplus/shared-auth';
import { environment } from '../environments/environment';

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
    provideAuth({
      keycloakUrl: environment.keycloak.url,
      realm: environment.keycloak.realm,
      clientId: environment.keycloak.clientId,
      allowedUrls: [environment.apiUrl, environment.keycloak.url],
    }),
  ],
};
