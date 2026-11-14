import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { LoginErrorCode, classifyLoginError } from '@uniplus/shared-auth/bootstrap';

/**
 * Banner contextual exibido quando o provedor OIDC redireciona de volta à
 * SPA com `error` / `error_description` na query string. Distingue
 * credenciais inválidas de conta bloqueada (proteção contra
 * força bruta) sem exigir um formulário de login
 * customizado (o login acontece 100% na UI hospedada pelo provedor).
 *
 * Acessibilidade: `role="alert"` + `aria-live="assertive"`, com tokens
 * semânticos Uni+ DS conforme severidade.
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
        class="alert ui-auth-banner"
        [class.alert--danger]="isDanger()"
        [class.alert--warning]="!isDanger()"
      >
        <span aria-hidden="true" class="alert__icon">
          {{ isDanger() ? '!' : 'i' }}
        </span>
        <div class="alert__body">
          <strong class="alert__title">{{ title() }}</strong>
          <span class="alert__msg">{{ d.message }}</span>
        </div>
        <button
          type="button"
          class="btn btn--tertiary btn--sm"
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
    return d ? tituloDoErro(d.code) : '';
  });

  protected dismiss(): void {
    this.dismissed.set(true);
  }
}

const TITULOS_DO_ERRO: Partial<Record<LoginErrorCode, string>> = {
  [LoginErrorCode.UserLocked]: 'Conta bloqueada',
  [LoginErrorCode.InvalidCredentials]: 'Credenciais inválidas',
  [LoginErrorCode.OidcProviderUnavailable]: 'Serviço indisponível',
  [LoginErrorCode.AccessDenied]: 'Acesso recusado',
};

function tituloDoErro(code: LoginErrorCode): string {
  return TITULOS_DO_ERRO[code] ?? 'Falha no login';
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
