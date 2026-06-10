import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAuth } from '@uniplus/shared-auth/bootstrap';
import { authErrorInterceptor, tokenInterceptor } from '@uniplus/shared-auth/interceptors';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { loadingInterceptor } from '@uniplus/shared-core/interceptors';
import { provideRuntimeConfig } from '@uniplus/shared-data/config';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideHttpClient(
      withInterceptors([
        tokenInterceptor,
        loadingInterceptor,
        authErrorInterceptor,
        apiResultInterceptor,
      ]),
    ),
    provideRuntimeConfig(),
    provideAuth(),
  ],
};
