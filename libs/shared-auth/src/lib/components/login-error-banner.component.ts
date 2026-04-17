import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { LoginErrorCode, classifyLoginError } from '../models/login-error.model';

/**
 * Banner contextual exibido quando o Keycloak redireciona de volta à
 * SPA com `error` / `error_description` na query string. Distingue
 * credenciais inválidas de conta bloqueada (H2 — brute force protection)
 * para cumprir a DoD da Task #62 sem exigir um formulário de login
 * customizado (o login acontece 100% na UI hospedada do Keycloak).
 *
 * Acessibilidade: `role="alert"` + `aria-live="assertive"`, cores
 * Gov.br danger/warning conforme severidade.
 */
@Component({
  selector: 'auth-login-error-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (details(); as d) {
      <div
        role="alert"
        aria-live="assertive"
        [class.border-govbr-danger]="isDanger()"
        [class.bg-govbr-danger-lightest]="isDanger()"
        [class.text-govbr-danger]="isDanger()"
        [class.border-govbr-warning]="!isDanger()"
        [class.bg-govbr-warning-lightest]="!isDanger()"
        [class.text-govbr-warning]="!isDanger()"
        class="flex items-start gap-3 border-b px-6 py-3"
      >
        <span aria-hidden="true" class="mt-0.5 text-lg">
          {{ isDanger() ? '⚠' : 'ℹ' }}
        </span>
        <div class="flex-1 text-sm">
          <strong class="block font-semibold">{{ title() }}</strong>
          <span class="block">{{ d.message }}</span>
        </div>
        <button
          type="button"
          class="text-xs underline opacity-80 hover:opacity-100"
          (click)="dismiss()"
          aria-label="Fechar mensagem"
        >
          Fechar
        </button>
      </div>
    }
  `,
})
export class LoginErrorBannerComponent {
  private readonly router = inject(Router);
  private readonly dismissed = signal(false);

  /**
   * Captura query params do URL inicial e de cada navegação. Emite
   * uma tupla `[error, error_description]` sempre que houver mudança.
   */
  private readonly currentParams = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      startWith(null),
      map(() => {
        const url = this.router.url;
        return extractErrorFromUrl(url);
      }),
    ),
    { initialValue: extractErrorFromUrl(this.router.url) },
  );

  protected readonly details = computed(() => {
    if (this.dismissed()) return null;
    const params = this.currentParams();
    if (!params) return null;
    const [error, description] = params;
    if (!error && !description) return null;
    return classifyLoginError({ error, error_description: description });
  });

  protected readonly isDanger = computed(() => {
    const d = this.details();
    if (!d) return false;
    return d.code === LoginErrorCode.InvalidCredentials || d.code === LoginErrorCode.UserLocked;
  });

  protected readonly title = computed(() => {
    const d = this.details();
    if (!d) return '';
    switch (d.code) {
      case LoginErrorCode.UserLocked:
        return 'Conta bloqueada';
      case LoginErrorCode.InvalidCredentials:
        return 'Credenciais inválidas';
      case LoginErrorCode.KeycloakUnavailable:
        return 'Serviço indisponível';
      case LoginErrorCode.AccessDenied:
        return 'Acesso recusado';
      default:
        return 'Falha no login';
    }
  });

  protected dismiss(): void {
    this.dismissed.set(true);
  }
}

function extractErrorFromUrl(url: string): [string | null, string | null] | null {
  const queryIndex = url.indexOf('?');
  if (queryIndex < 0) return null;
  const query = url.slice(queryIndex + 1);
  const params = new URLSearchParams(query);
  const error = params.get('error');
  const description = params.get('error_description');
  if (!error && !description) return null;
  return [error, description];
}
