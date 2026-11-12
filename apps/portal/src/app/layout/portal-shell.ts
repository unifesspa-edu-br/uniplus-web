import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { UserHeaderInfoComponent } from '@uniplus/shared-auth/components';
import {
  A11yMenuComponent,
  BackToTopComponent,
  InstitutionalBarComponent,
  MarcaInstitucionalComponent,
  SkipLinkComponent,
  VlibrasLoaderComponent,
} from '@uniplus/shared-ui/components';
import { mediaQuerySignal } from '@uniplus/shared-core/dom';

interface PortalNavItem {
  readonly label: string;
  readonly icon: string;
  readonly routerLink?: string;
  readonly requiresAuth?: boolean;
}

interface PortalFooterLink {
  readonly label: string;
  readonly routerLink?: string;
  readonly requiresAuth?: boolean;
}

interface PortalFooterGroup {
  readonly label: string;
  readonly links: readonly PortalFooterLink[];
}

/**
 * Shell público do Portal do Candidato — layout próprio (ADR-0023 §2),
 * distinto do `ui-app-shell` administrativo por não ter menu lateral. A
 * altura trava no viewport (mesmo contrato do `ui-app-shell`) e só
 * `.portal-scroll` (main + rodapé) rola — a faixa institucional, o topo e a
 * navegação por abas ficam sempre visíveis, sem acompanhar o scroll. Na
 * impressão o shell volta ao fluxo normal e só o conteúdo vai para o papel.
 *
 * Exceção: em janela baixa (`max-height: 500px`, p.ex. zoom alto) o cabeçalho
 * deixa de ser fixo e a página rola inteira — ver `portal-shell.css` e
 * `docs/modelo-de-rolagem-dos-shells.md`.
 */
@Component({
  selector: 'ptl-portal-shell',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    UserHeaderInfoComponent,
    A11yMenuComponent,
    BackToTopComponent,
    InstitutionalBarComponent,
    MarcaInstitucionalComponent,
    SkipLinkComponent,
    VlibrasLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './portal-shell.css',
  template: `
    <ui-skip-link targetId="portal-main" />
    <ui-institutional-bar>
      <ui-a11y-menu />
      <auth-user-header-info />
    </ui-institutional-bar>

    <header class="topbar portal-topbar u-no-print" role="banner">
      <div class="topbar__brand">
        <a
          class="topbar__link-marca"
          href="https://www.unifesspa.edu.br"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Unifesspa (abre em nova aba)"
        >
          <ui-marca-institucional class="topbar__marca" [rotulada]="false" fundo="tema" />
        </a>
        <a class="topbar__titles" routerLink="/processos">
          <span class="topbar__title">Uni+</span>
          <span class="topbar__subtitle">Portal do Candidato</span>
        </a>
      </div>
    </header>

    <nav class="portal-nav u-no-print" aria-label="Navegação principal">
      @for (item of navItems(); track item.label) {
        @if (item.routerLink) {
          <a
            class="portal-nav__link"
            [routerLink]="item.routerLink"
            routerLinkActive="is-active"
            ariaCurrentWhenActive="page"
          >
            <i class="pi {{ item.icon }}" aria-hidden="true"></i>
            {{ item.label }}
          </a>
        } @else {
          <span class="portal-nav__link is-disabled" aria-disabled="true">
            <i class="pi {{ item.icon }}" aria-hidden="true"></i>
            {{ item.label }}
          </span>
        }
      }
    </nav>

    <div class="portal-scroll" tabindex="-1" #portalScroll>
      <main id="portal-main" class="portal-main" tabindex="-1">
        <router-outlet />
      </main>

      <footer class="portal-footer u-no-print">
        <div class="portal-footer__top">
          <div class="portal-footer__brand">
            <span class="portal-footer__brand-mark" aria-hidden="true">U+</span>
            <p>Sistema Unificado de Seleção e Ingresso da UNIFESSPA.</p>
          </div>
          @for (group of footerGroups(); track group.label) {
            <div class="portal-footer__group">
              <p class="portal-footer__group-title">{{ group.label }}</p>
              <ul>
                @for (link of group.links; track link.label) {
                  <li>
                    @if (link.routerLink) {
                      <a [routerLink]="link.routerLink">{{ link.label }}</a>
                    } @else {
                      <span class="is-disabled" aria-disabled="true">{{ link.label }}</span>
                    }
                  </li>
                }
              </ul>
            </div>
          }
        </div>
        <div class="portal-footer__bottom">
          <span>© 2026 Unifesspa — Sistema Uni+ · CTIC</span>
          <span class="portal-footer__badges">WCAG 2.1 AA · e-MAG 3.1 · Gov.br DS</span>
        </div>
      </footer>
    </div>

    <ui-back-to-top
      [defaultContainer]="rolaPelaPagina() ? paginaRaiz : portalScroll"
      [focoAoTopo]="portalScroll"
    />
    <ui-vlibras-loader />
  `,
})
export class PortalShellComponent {
  private readonly userContext = inject(UserContextService);
  private readonly document = inject(DOCUMENT);

  /** Mesmo limiar do `@media (max-height)` em portal-shell.css. */
  private static readonly ALTURA_JANELA_BAIXA = '(max-height: 500px)';

  protected readonly paginaRaiz = this.document.documentElement;
  protected readonly rolaPelaPagina = mediaQuerySignal(PortalShellComponent.ALTURA_JANELA_BAIXA);

  // "Meu perfil" vive no menu do avatar (auth-user-header-info), não aqui.
  // "Documentos" fica de fora enquanto for placeholder vazio — pô-lo no menu
  // principal cria uma expectativa que a tela não entrega; a rota continua
  // acessível por URL direta e ganha link aqui quando houver conteúdo por trás.
  private readonly allNavItems: readonly PortalNavItem[] = [
    { label: 'Editais', icon: 'pi-calendar', routerLink: '/processos' },
    {
      label: 'Minhas inscrições',
      icon: 'pi-check-square',
      routerLink: '/inscricao',
      requiresAuth: true,
    },
    { label: 'Ajuda', icon: 'pi-question-circle' },
  ];

  private readonly allFooterGroups: readonly PortalFooterGroup[] = [
    {
      label: 'Candidato',
      links: [
        { label: 'Editais', routerLink: '/processos' },
        { label: 'Minhas inscrições', routerLink: '/inscricao', requiresAuth: true },
      ],
    },
    {
      label: 'Institucional',
      links: [{ label: 'CEPS' }, { label: 'CRCA' }, { label: 'Calendário acadêmico' }],
    },
    {
      label: 'Acessibilidade',
      links: [
        { label: 'Mapa do site' },
        { label: 'Política de privacidade' },
        { label: 'Acessibilidade' },
      ],
    },
  ];

  protected readonly navItems = computed(() =>
    this.allNavItems.filter((item) => !item.requiresAuth || this.userContext.isAuthenticated()),
  );

  protected readonly footerGroups = computed(() =>
    this.allFooterGroups.map((group) => ({
      ...group,
      links: group.links.filter(
        (link) => !link.requiresAuth || this.userContext.isAuthenticated(),
      ),
    })),
  );
}
