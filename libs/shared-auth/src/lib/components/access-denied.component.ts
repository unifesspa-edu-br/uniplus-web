import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';

import { AuthService } from '../services/auth.service';

/**
 * Página de "Acesso negado" (HTTP 403). Exibida quando um usuário
 * autenticado tenta acessar uma rota para a qual não possui a role
 * requerida — cenário comum quando a SPA aplica `fullScopeAllowed=false`
 * + `scopeMappings` por client (Story uniplus-api#67 / PR #87).
 *
 * Não redireciona para login automaticamente (diferente de 401): o usuário já
 * está autenticado; precisa de outra conta ou de solicitação de papel. Por
 * isso a única saída oferecida é encerrar a sessão — navegar para a raiz não
 * serve, porque nos apps ela é protegida pelo mesmo guard que trouxe o
 * usuário até aqui, e o levaria de volta.
 */
@Component({
  selector: 'auth-access-denied',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main role="main" class="ui-access-denied">
      <div class="empty-state empty-state--error">
        <div class="empty-state__icon" aria-hidden="true">!</div>
        <h1 class="empty-state__title">Acesso negado</h1>
        <p class="empty-state__desc">Sua conta não possui permissão para acessar esta área.</p>
        @if (user(); as profile) {
          <p class="u-caption">
            Conectado como <strong>{{ profile.username }}</strong
            >.
          </p>
        }
        <button
          type="button"
          class="btn"
          [disabled]="saindo()"
          [attr.aria-busy]="saindo() || null"
          (click)="sair()"
        >
          {{ saindo() ? 'Saindo…' : 'Sair' }}
        </button>
      </div>
    </main>
  `,
})
export class AccessDeniedComponent {
  private readonly authService = inject(AuthService);
  private readonly userContext = inject(UserContextService);

  protected readonly user = this.userContext.user;

  /** Encerramento em curso, para não disparar duas vezes no mesmo clique duplo. */
  protected readonly saindo = signal(false);

  protected async sair(): Promise<void> {
    if (this.saindo()) return;
    this.saindo.set(true);
    try {
      await this.authService.logout();
    } finally {
      this.saindo.set(false);
    }
  }
}
