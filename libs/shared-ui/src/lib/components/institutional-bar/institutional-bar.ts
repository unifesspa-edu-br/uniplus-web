import { ChangeDetectionStrategy, Component, ElementRef, signal, viewChild } from '@angular/core';

interface LinkInstitucional {
  readonly rotulo: string;
  readonly href: string;
}

const LINKS_INSTITUCIONAIS: readonly LinkInstitucional[] = [
  { rotulo: 'Órgãos do Governo', href: 'https://www.gov.br/pt-br/orgaos-do-governo' },
  { rotulo: 'Acesso à Informação', href: 'https://www.gov.br/acessoainformacao/pt-br' },
  { rotulo: 'Legislação', href: 'https://www4.planalto.gov.br/legislacao' },
  { rotulo: 'Minha área gov.br', href: 'https://contas.acesso.gov.br/' },
];

/** Barra do Governo Federal: logotipo gov.br, menu Institucional e, projetado, o acesso à conta. */
@Component({
  selector: 'ui-institutional-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'u-no-print',
    '(document:click)': 'fecharAoClicarFora($event)',
    '(document:keydown.escape)': 'fecharMenuPeloTeclado($event)',
    '(focusout)': 'fecharAoPerderOFoco($event)',
  },
  template: `
    <div class="institutional-bar" role="region" aria-label="Barra do Governo Federal">
      <a
        class="institutional-bar__logo"
        href="https://www.gov.br/pt-br"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="gov.br (abre em nova aba)"
      >
        <img
          class="marca-govbr"
          src="assets/shared-ui/marca/govbr-colorido.png"
          width="376"
          height="136"
          alt=""
        />
      </a>
      <nav #menu class="institutional-bar__menu" aria-label="Governo Federal">
        <button
          #gatilho
          type="button"
          class="institutional-bar__gatilho"
          aria-controls="menu-institucional"
          [attr.aria-expanded]="menuAberto()"
          (click)="alternarMenu()"
        >
          Institucional
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>
        <ul id="menu-institucional" class="institutional-bar__lista" [hidden]="!menuAberto()">
          @for (link of links; track link.href) {
            <li>
              <a [href]="link.href" target="_blank" rel="noopener noreferrer">
                {{ link.rotulo }}
                <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14">
                  <path
                    d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  />
                </svg>
                <span class="sr-only">(abre em nova aba)</span>
              </a>
            </li>
          }
        </ul>
      </nav>
      <div class="institutional-bar__acoes"><ng-content /></div>
    </div>
  `,
})
export class InstitutionalBarComponent {
  private readonly menu = viewChild.required<ElementRef<HTMLElement>>('menu');
  private readonly gatilho = viewChild.required<ElementRef<HTMLButtonElement>>('gatilho');
  protected readonly links = LINKS_INSTITUCIONAIS;
  protected readonly menuAberto = signal(false);

  protected alternarMenu(): void {
    this.menuAberto.update((aberto) => !aberto);
  }

  /**
   * Esc fecha o menu. Se o foco estava dentro dele, volta ao gatilho, para quem navega por teclado
   * não perder a posição; numa ação vizinha da barra, o foco fica onde está.
   */
  protected fecharMenuPeloTeclado(evento: Event): void {
    if (!this.menuAberto()) return;
    this.menuAberto.set(false);
    if (this.menu().nativeElement.contains(evento.target as Node)) this.gatilho().nativeElement.focus();
  }

  /** Tab para fora do menu fecha a lista, sem mexer no foco. */
  protected fecharAoPerderOFoco(evento: FocusEvent): void {
    if (!this.menu().nativeElement.contains(evento.relatedTarget as Node | null)) {
      this.menuAberto.set(false);
    }
  }

  /** Clique fora do menu, inclusive nas ações ao lado na barra, fecha a lista. */
  protected fecharAoClicarFora(evento: MouseEvent): void {
    if (!this.menu().nativeElement.contains(evento.target as Node)) this.menuAberto.set(false);
  }
}
