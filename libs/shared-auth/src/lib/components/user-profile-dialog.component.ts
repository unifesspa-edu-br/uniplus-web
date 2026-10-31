import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  AuthService,
  PerfisDeAcessoService,
  escopoDoPerfil,
  prazoDoPerfil,
  type RespostaDoPerfil,
} from '@uniplus/shared-auth/bootstrap';
import { cpfRevelavel, type TrechoMascarado } from '@uniplus/shared-utils';

type Estado =
  | { readonly tipo: 'carregando' }
  | { readonly tipo: 'erro' }
  | { readonly tipo: 'pronto'; readonly perfil: RespostaDoPerfil };

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
    <dialog #dialog class="uni-dialog" aria-labelledby="auth-profile-title" (close)="closed.emit()">
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
        <div class="uni-dialog__body">
          <!-- Só o carregamento e a falha são anunciados: os dados, com o CPF, não são lidos sozinhos. -->
          <div aria-live="polite" data-testid="auth-profile-status">
            @switch (estado().tipo) {
              @case ('carregando') {
                <p data-testid="auth-profile-loading">Carregando seus dados…</p>
              }
              @case ('erro') {
                <p role="alert" data-testid="auth-profile-error">
                  Não foi possível carregar o seu perfil. Tente novamente em instantes.
                </p>
              }
            }
          </div>
          @if (perfil(); as p) {
            <dl class="auth-profile__list" data-testid="auth-profile-data">
              <div>
                <dt>Nome</dt>
                <dd>{{ p.name || '—' }}</dd>
              </div>
              <div>
                <dt>Nome social</dt>
                <dd class="auth-profile__acao">
                  <span data-testid="auth-profile-nome-social">{{ p.nomeSocial || '—' }}</span>
                  <button
                    type="button"
                    class="btn btn--tertiary btn--sm"
                    data-testid="auth-profile-nome-social-acao"
                    (click)="atualizarPerfil()"
                  >
                    {{ p.nomeSocial ? 'Alterar nome social' : 'Cadastrar nome social' }}
                  </button>
                </dd>
              </div>
              <div>
                <dt>E-mail</dt>
                <dd>{{ p.email || '—' }}</dd>
              </div>
              <div>
                <dt>CPF</dt>
                <dd class="auth-profile__cpf">
                  <span data-testid="auth-profile-cpf">
                    @for (parte of cpfSegmentos(p.cpf, cpfVisivel()); track $index) {
                      <span [class.auth-profile__mask]="parte.oculto">{{ parte.texto }}</span>
                    }
                  </span>
                  @if (cpfValido(p.cpf)) {
                    <button
                      type="button"
                      class="btn btn--tertiary btn--icon-only btn--rect"
                      data-testid="auth-profile-cpf-toggle"
                      aria-label="Mostrar CPF"
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
                          <path
                            d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24M1 1l22 22"
                          />
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
                <dd data-testid="auth-profile-perfis">
                  @switch (perfis.estado()) {
                    @case ('carregada') {
                      @if (perfis.perfis().length) {
                        <ul class="auth-profile__perfis">
                          @for (perfil of perfis.perfis(); track perfil.concessaoId) {
                            <li data-testid="auth-profile-perfil">
                              <strong>{{ perfil.nome }}</strong> — {{ escopo(perfil) }}
                              @if (prazo(perfil); as ate) {
                                · até {{ ate }}
                              }
                            </li>
                          }
                        </ul>
                      } @else {
                        <span data-testid="auth-profile-perfis-vazio">Nenhum perfil de acesso</span>
                      }
                    }
                    @case ('carregando') {
                      <span>Carregando…</span>
                    }
                    @default {
                      <span role="alert" data-testid="auth-profile-perfis-erro">
                        Não foi possível carregar os perfis de acesso
                      </span>
                    }
                  }
                </dd>
              </div>
            </dl>
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
    .auth-profile__cpf,
    .auth-profile__acao {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
    }
    .auth-profile__perfis {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .auth-profile__list dd {
      margin: 0;
      color: var(--text-primary);
      overflow-wrap: anywhere;
    }
  `,
})
export class UserProfileDialogComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  protected readonly perfis = inject(PerfisDeAcessoService);
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly closed = output<void>();

  private destruido = false;

  /** O CPF abre mascarado (LGPD); o olho revela, e o modal recém-aberto volta a ocultar. */
  protected readonly cpfVisivel = signal(false);
  protected readonly estado = signal<Estado>({ tipo: 'carregando' });

  constructor() {
    this.destroyRef.onDestroy(() => (this.destruido = true));
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
    // Abrir Meu perfil é o momento de ver uma concessão recém-revogada ou concedida: a mesma
    // consulta traz os dados do modal e atualiza os perfis.
    void this.carregar();
  }

  protected perfil(): RespostaDoPerfil | null {
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

  /**
   * O nome social é dado da conta: quem o cadastra ou altera é o provedor de identidade, que devolve
   * o titular a esta página já com o token novo.
   */
  protected atualizarPerfil(): void {
    void this.auth.atualizarPerfil();
  }

  protected cpfValido(cpf: string | null): boolean {
    return cpfRevelavel(cpf).revelado !== null;
  }

  /** O CPF na ordem de exibição, na máscara única; os trechos ocultos recebem o ajuste do asterisco. */
  protected cpfSegmentos(cpf: string | null, visivel: boolean): readonly TrechoMascarado[] {
    if (!cpf) return [{ texto: '—', oculto: false }];
    const dado = cpfRevelavel(cpf);
    return visivel && dado.revelado ? [{ texto: dado.revelado, oculto: false }] : dado.mascarado;
  }

  protected readonly escopo = escopoDoPerfil;
  protected readonly prazo = prazoDoPerfil;

  private async carregar(): Promise<void> {
    const resposta = await this.perfis.recarregar();
    if (this.destruido) return;
    this.estado.set(resposta === null ? { tipo: 'erro' } : { tipo: 'pronto', perfil: resposta });
  }
}
