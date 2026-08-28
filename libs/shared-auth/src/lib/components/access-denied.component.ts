import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService, UserContextService } from '@uniplus/shared-auth/bootstrap';

/**
 * Página de "Acesso negado" (HTTP 403). Exibida quando um usuário
 * autenticado tenta acessar uma rota para a qual não possui a role
 * requerida — cenário comum quando a SPA aplica `fullScopeAllowed=false`
 * + `scopeMappings` por client (Story uniplus-api#67 / PR #87).
 *
 * Não redireciona para login automaticamente (diferente de 401): o usuário já
 * está autenticado; precisa de outra conta ou de solicitação de papel.
 *
 * Encerrar a sessão é a saída que vale em qualquer app. Voltar a alguma rota
 * só vale onde houver uma alcançável sem a role que faltou — nos apps
 * administrativos a raiz é protegida pelo mesmo guard que trouxe o usuário
 * aqui, e mandá-lo para lá o traria de volta. Por isso o destino é declarado
 * por quem monta a rota, em `data.rotaDeVolta`, e não presumido.
 */
@Component({
  selector: 'auth-access-denied',
  standalone: true,
  imports: [RouterLink],
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
        <div class="ui-access-denied__acoes">
          @if (rotaDeVolta(); as rota) {
            <a class="btn btn--tertiary" [routerLink]="rota">Voltar ao início</a>
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
      </div>
    </main>
  `,
})
export class AccessDeniedComponent {
  private readonly authService = inject(AuthService);
  private readonly userContext = inject(UserContextService);

  protected readonly user = this.userContext.user;

  /**
   * Rota alcançável sem a role que faltou, declarada por quem monta a rota de
   * acesso negado. Ausente, a tela oferece apenas a saída.
   */
  protected readonly rotaDeVolta = signal<string | null>(
    (inject(ActivatedRoute).snapshot.data['rotaDeVolta'] as string | undefined) ?? null,
  ).asReadonly();

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
