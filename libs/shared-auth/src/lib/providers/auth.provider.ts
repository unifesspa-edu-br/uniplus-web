import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { AuthConfig } from '../models/auth-config.model';
import { AUTH_ALLOWED_URLS, AUTH_CONFIG } from '../tokens/auth.tokens';

/**
 * Configura os providers que dependem de `AUTH_CONFIG` (ADR-0021):
 *
 * - `AUTH_ALLOWED_URLS` — derivado lazy de `AUTH_CONFIG`. Consumido
 *   pelo `tokenInterceptor` no primeiro HTTP request, post-bootstrap,
 *   quando o store já foi populado pelo `provideRuntimeConfig`.
 *
 * O `APP_INITIALIZER` que faz `AuthService.init()` vive em
 * `provideRuntimeConfig()` (em `@uniplus/shared-data`) — Angular
 * dispara initializers em paralelo, então auth.init precisa estar
 * no MESMO initializer que faz `AppConfigService.load()` para
 * garantir ordem sequencial. `provideAuth()` aqui só registra os
 * providers que `tokenInterceptor` e outros consumers leem lazy.
 */
export function provideAuth(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: AUTH_ALLOWED_URLS,
      useFactory: (config: AuthConfig) => Object.freeze([...config.allowedUrls]),
      deps: [AUTH_CONFIG],
    },
  ]);
}
