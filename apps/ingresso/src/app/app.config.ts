import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { appRoutes } from './app.routes';
import { errorInterceptor, loadingInterceptor } from '@uniplus/shared-core';
import { provideAuth, tokenInterceptor } from '@uniplus/shared-auth';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideHttpClient(
      withInterceptors([tokenInterceptor, loadingInterceptor, errorInterceptor]),
    ),
    provideAuth({
      keycloakUrl: environment.keycloak.url,
      realm: environment.keycloak.realm,
      clientId: environment.keycloak.clientId,
      allowedUrls: [environment.apiUrl, environment.keycloak.url],
    }),
  ],
};
