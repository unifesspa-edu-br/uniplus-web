import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { ApiResult } from '@uniplus/shared-core/http';
import { DOMAIN_ROLES, PROFILE_BASE_PATH, ROLE_LABELS } from '@uniplus/shared-auth/bootstrap';

/** Resposta de `GET /api/profile/me` (`UserProfileResponse` da uniplus-api). */
interface ProfileResponse {
  readonly userId: string | null;
  readonly name: string | null;
  readonly email: string | null;
  readonly cpf: string | null;
  readonly nomeSocial: string | null;
  readonly roles: readonly string[];
  readonly timestamp: string;
}

type Estado =
  | { readonly tipo: 'carregando' }
  | { readonly tipo: 'erro' }
  | { readonly tipo: 'pronto'; readonly perfil: ProfileResponse };

/**
 * Modal "Meu perfil": exibe os dados devolvidos por `GET /api/profile/me`.
 * Montado sob demanda pelo `auth-user-header-info` (a requisição só acontece
 * quando o usuário pede o perfil) e se abre sozinho ao ser renderizado;
 * `closed` avisa o dono para desmontá-lo e devolver o foco ao menu.
 *
 * Usa `<dialog>` nativo com a anatomia `uni-dialog` do DS — `shared-auth` não
 * pode depender de `shared-ui` (fronteira de tipos do Nx), e o `<dialog>` já
 * entrega modalidade, foco preso e Esc.
 */
@Component({
  selector: 'auth-user-profile-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="uni-dialog"
      aria-labelledby="auth-profile-title"
      (close)="closed.emit()"
    >
      <div class="uni-dialog__panel">
        <div class="uni-dialog__header">
          <h3 id="auth-profile-title" class="uni-dialog__title">Meu perfil</h3>
          <button
            type="button"
            class="btn btn--tertiary btn--icon-only btn--rect"
            aria-label="Fechar"
            (click)="fechar()"
          >
            &times;
          </button>
        </div>
        <div class="uni-dialog__body" aria-live="polite">
          @switch (estado().tipo) {
            @case ('carregando') {
              <p data-testid="auth-profile-loading">Carregando seus dados…</p>
            }
            @case ('erro') {
              <p role="alert" data-testid="auth-profile-error">
                Não foi possível carregar o seu perfil. Tente novamente em instantes.
              </p>
            }
            @case ('pronto') {
              @if (perfil(); as p) {
                <dl class="auth-profile__list" data-testid="auth-profile-data">
                  <div>
                    <dt>Nome</dt>
                    <dd>{{ p.name || '—' }}</dd>
                  </div>
                  <div>
                    <dt>Nome social</dt>
                    <dd>{{ p.nomeSocial || '—' }}</dd>
                  </div>
                  <div>
                    <dt>E-mail</dt>
                    <dd>{{ p.email || '—' }}</dd>
                  </div>
                  <div>
                    <dt>CPF</dt>
                    <dd class="auth-profile__cpf">
                      <span data-testid="auth-profile-cpf"
                        >@let c = cpfPartes(p.cpf, cpfVisivel());
                        @if (c.mascara) {<span class="auth-profile__mask">{{ c.mascara }}</span
                          >}{{ c.aberto }}</span
                      >
                      @if (p.cpf) {
                        <button
                          type="button"
                          class="btn btn--tertiary btn--icon-only btn--rect"
                          data-testid="auth-profile-cpf-toggle"
                          [attr.aria-label]="cpfVisivel() ? 'Ocultar CPF' : 'Mostrar CPF'"
                          [attr.aria-pressed]="cpfVisivel()"
                          (click)="cpfVisivel.set(!cpfVisivel())"
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                          >
                            @if (cpfVisivel()) {
                              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24M1 1l22 22" />
                            } @else {
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            }
                          </svg>
                        </button>
                      }
                    </dd>
                  </div>
                  <div>
                    <dt>Perfis de acesso</dt>
                    <dd>{{ perfisDeAcesso(p.roles) }}</dd>
                  </div>
                </dl>
              }
            }
          }
        </div>
        <div class="uni-dialog__footer">
          <button type="button" class="btn btn--secondary" (click)="fechar()">Fechar</button>
        </div>
      </div>
    </dialog>
  `,
  styles: `
    .auth-profile__list {
      display: grid;
      gap: var(--space-3);
      margin: 0;
    }
    .auth-profile__list dt {
      font-size: var(--text-xs);
      font-weight: var(--weight-bold);
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    /* O asterisco fica no topo da linha na maioria das fontes; desce até a altura dos dígitos. */
    .auth-profile__mask {
      display: inline-block;
      transform: translateY(0.3em);
    }
    .auth-profile__cpf {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .auth-profile__list dd {
      margin: 0;
      color: var(--text-primary);
      overflow-wrap: anywhere;
    }
  `,
})
export class UserProfileDialogComponent {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(PROFILE_BASE_PATH);
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly closed = output<void>();

  /** O CPF abre mascarado (LGPD); o olho revela, e o modal recém-aberto volta a ocultar. */
  protected readonly cpfVisivel = signal(false);
  protected readonly estado = signal<Estado>({ tipo: 'carregando' });

  constructor() {
    afterNextRender(() => {
      const dialog = this.dialogRef().nativeElement;
      // Listener nativo: o clique no backdrop é conveniência de mouse (Esc e o
      // botão Fechar cobrem teclado), então não cabe handler no template.
      dialog.addEventListener('click', (event) => {
        // O `<dialog>` ocupa a tela toda: clicar nele mesmo, e não no painel, é clicar fora.
        if (event.target === dialog) this.fechar();
      });
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    });
    this.carregar();
  }

  protected perfil(): ProfileResponse | null {
    const estado = this.estado();
    return estado.tipo === 'pronto' ? estado.perfil : null;
  }

  protected fechar(): void {
    const dialog = this.dialogRef().nativeElement;
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
      this.closed.emit();
    }
  }

  /** `mascara` recebe o ajuste de altura do asterisco; `aberto` é o que aparece como digitado. */
  protected cpfPartes(
    cpf: string | null,
    visivel: boolean,
  ): { readonly mascara: string; readonly aberto: string } {
    const digitos = cpf?.replace(/\D/g, '') ?? '';
    if (!cpf) return { mascara: '', aberto: '—' };
    if (digitos.length !== 11) return { mascara: '***.***.***', aberto: '-**' };
    if (visivel) {
      return {
        mascara: '',
        aberto: digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'),
      };
    }
    return { mascara: '***.***.***', aberto: `-${digitos.slice(9)}` };
  }

  protected perfisDeAcesso(roles: readonly string[]): string {
    const rotulos = roles.filter((r) => DOMAIN_ROLES.has(r)).map((r) => ROLE_LABELS[r] ?? r);
    return rotulos.length ? rotulos.join(', ') : '—';
  }

  private carregar(): void {
    this.http.get<ApiResult<ProfileResponse>>(`${this.basePath}/api/profile/me`).subscribe({
      next: (resultado) =>
        this.estado.set(
          resultado.ok ? { tipo: 'pronto', perfil: resultado.data } : { tipo: 'erro' },
        ),
      error: () => this.estado.set({ tipo: 'erro' }),
    });
  }
}
