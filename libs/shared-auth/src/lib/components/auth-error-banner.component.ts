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
        class="flex items-start gap-3 border-b border-govbr-danger bg-govbr-danger-lightest px-6 py-3 text-govbr-danger"
      >
        <span aria-hidden="true" class="mt-0.5 text-lg">⚠</span>
        <div class="flex-1 text-sm">
          <strong class="block font-semibold">Serviço de autenticação indisponível</strong>
          <span class="block">{{ message }}</span>
          <span class="block text-xs opacity-80">
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
