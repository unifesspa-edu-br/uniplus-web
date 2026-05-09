import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Banner de fallback exibido quando `AuthService.init()` falha
 * (ex.: Keycloak indisponível). É renderizado no shell do app
 * (`AppComponent`) para garantir visibilidade mesmo antes do router.
 *
 * Acessibilidade: `role="alert"` + `aria-live="assertive"` para leitores
 * de tela; cores e foco seguem tokens Gov.br DS (erro).
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
        class="flex items-start gap-3 border-b border-govbr-danger bg-govbr-danger-light px-6 py-3 text-govbr-gray-80"
      >
        <span aria-hidden="true" class="mt-0.5 text-lg text-govbr-danger">⚠</span>
        <div class="flex-1 text-sm">
          <strong class="block font-semibold">Serviço de autenticação indisponível</strong>
          <span class="block">{{ message }}</span>
          <span class="block text-xs text-govbr-gray-60">
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
