import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Banner de fallback exibido quando `AuthService.init()` falha
 * (ex.: provedor OIDC indisponível). É renderizado no shell do app
 * (`AppComponent`) para garantir visibilidade mesmo antes do router.
 *
 * Acessibilidade: `role="alert"` + `aria-live="assertive"` para leitores
 * de tela; cores e foco seguem os tokens semânticos do Uni+ DS.
 */
@Component({
  selector: 'auth-error-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (authService.initError(); as message) {
      <div
        role="alert"
        aria-live="assertive"
        class="alert alert--danger ui-auth-banner"
      >
        <span aria-hidden="true" class="alert__icon">!</span>
        <div class="alert__body">
          <strong class="alert__title">Serviço de autenticação indisponível</strong>
          <span class="alert__msg">{{ message }}</span>
          <span class="u-caption">
            Você pode continuar navegando em áreas públicas. Recursos
            protegidos ficarão indisponíveis até o restabelecimento do
            serviço.
          </span>
        </div>
      </div>
    }
  `,
})
export class AuthErrorBannerComponent {
  protected readonly authService = inject(AuthService);
}
