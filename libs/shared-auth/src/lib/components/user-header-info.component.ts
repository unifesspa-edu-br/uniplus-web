import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { UserContextService } from '../services/user-context.service';
import { UserRole } from '../models/user.model';

const DOMAIN_ROLES = new Set<string>(['admin', 'gestor', 'avaliador', 'candidato'] satisfies UserRole[]);

/**
 * Bloco de identificação do usuário autenticado para uso em headers.
 * Exibe nome social (ou civil), username, roles do realm e botão de logout.
 * Renderiza vazio quando não há sessão ativa — seguro para uso em
 * layouts que misturam rotas públicas e autenticadas.
 */
@Component({
  selector: 'auth-user-header-info',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (userContext.user(); as profile) {
      <div class="flex items-center gap-3 text-sm">
        <div class="flex flex-col items-end leading-tight">
          <span class="font-semibold">{{ userContext.displayName() }}</span>
          <span class="text-xs opacity-80">
            &#64;{{ profile.username }}
            @if (domainRoles(profile.roles); as roles) {
              @if (roles.length) {
                · {{ roles.join(', ') }}
              }
            }
          </span>
        </div>
        <button
          type="button"
          class="rounded border border-white/40 px-3 py-1 hover:bg-white/10"
          (click)="logout()"
          aria-label="Sair da aplicação"
        >
          Sair
        </button>
      </div>
    }
  `,
})
export class UserHeaderInfoComponent {
  protected readonly userContext = inject(UserContextService);
  private readonly authService = inject(AuthService);

  protected domainRoles(roles: string[]): string[] {
    return roles.filter((r) => DOMAIN_ROLES.has(r));
  }

  protected logout(): void {
    void this.authService.logout();
  }
}
