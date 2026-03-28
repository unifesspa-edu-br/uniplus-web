import { APP_INITIALIZER, EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { AuthConfig } from '../models/auth-config.model';
import { tokenInterceptor } from '../interceptors/token.interceptor';

export function provideAuth(config: AuthConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideHttpClient(withInterceptors([tokenInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: (authService: AuthService) => () => authService.init(config),
      deps: [AuthService],
      multi: true,
    },
  ]);
}
