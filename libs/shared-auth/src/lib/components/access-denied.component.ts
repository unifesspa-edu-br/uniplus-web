import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { UserContextService } from '../services/user-context.service';

/**
 * Página de "Acesso negado" (HTTP 403). Exibida quando um usuário
 * autenticado tenta acessar uma rota para a qual não possui a role
 * requerida — cenário comum quando a SPA aplica `fullScopeAllowed=false`
 * + `scopeMappings` por client (Story uniplus-api#67 / PR #87).
 *
 * Não redireciona para login automaticamente (diferente de 401):
 * o usuário já está autenticado; precisa de outra conta ou de
 * solicitação de papel.
 */
@Component({
  selector: 'auth-access-denied',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      role="main"
      class="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 p-6 text-center"
    >
      <span aria-hidden="true" class="text-5xl">🚫</span>
      <div>
        <h1 class="text-2xl font-bold text-govbr-danger">Acesso negado</h1>
        <p class="mt-2 text-govbr-text">
          Sua conta não possui permissão para acessar esta área.
        </p>
        @if (user(); as profile) {
          <p class="mt-1 text-sm text-govbr-text-secondary">
            Conectado como <strong>{{ profile.username }}</strong>.
          </p>
        }
      </div>
      <div class="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          class="rounded-govbr bg-govbr-primary px-4 py-2 text-white hover:bg-govbr-primary-hover"
          (click)="voltar()"
        >
          Voltar ao início
        </button>
      </div>
    </main>
  `,
})
export class AccessDeniedComponent {
  private readonly router = inject(Router);
  private readonly userContext = inject(UserContextService);
  protected readonly user = this.userContext.user;

  protected voltar(): void {
    void this.router.navigate(['/']);
  }
}
