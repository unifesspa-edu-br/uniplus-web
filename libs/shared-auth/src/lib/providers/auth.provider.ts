import { APP_INITIALIZER, EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { AuthConfig } from '../models/auth-config.model';

export function provideAuth(config: AuthConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: APP_INITIALIZER,
      useFactory: (authService: AuthService) => () => authService.init(config),
      deps: [AuthService],
      multi: true,
    },
  ]);
}
