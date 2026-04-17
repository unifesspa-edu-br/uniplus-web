import { APP_INITIALIZER, EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { AuthConfig } from '../models/auth-config.model';
import { AUTH_ALLOWED_URLS } from '../tokens/auth.tokens';

export function provideAuth(config: AuthConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: AUTH_ALLOWED_URLS,
      useValue: Object.freeze([...config.allowedUrls]),
    },
    {
      provide: APP_INITIALIZER,
      useFactory: (authService: AuthService) => () => authService.init(config),
      deps: [AuthService],
      multi: true,
    },
  ]);
}
