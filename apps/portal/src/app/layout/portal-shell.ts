import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { UserHeaderInfoComponent } from '@uniplus/shared-auth/components';
import {
  A11yMenuComponent,
  BackToTopComponent,
  InstitutionalBarComponent,
  SkipLinkComponent,
  VlibrasLoaderComponent,
} from '@uniplus/shared-ui/components';

interface PortalNavItem {
  readonly label: string;
  readonly icon: string;
  readonly routerLink?: string;
}

interface PortalFooterLink {
  readonly label: string;
  readonly routerLink?: string;
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
 * navegação por abas ficam sempre visíveis, sem acompanhar o scroll.
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
    SkipLinkComponent,
    VlibrasLoaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './portal-shell.css',
  template: `
    <ui-skip-link targetId="portal-main" />
    <!--
      Decisão (issue #780): os links opcionais de "Mapa do site", "Acessibilidade"
      e "Privacidade" da faixa institucional ficam ocultos por ora — nenhuma
      dessas páginas existe no app ainda (o rodapé já lista os mesmos três itens
      como texto inerte, pelo mesmo motivo). O componente já esconde a seção de
      links quando as hrefs não são passadas; assim que as páginas existirem,
      basta preencher siteMapHref/accessibilityHref/privacyHref aqui.
    -->
    <ui-institutional-bar organization="UNIFESSPA · Sistema Uni+" />

    <header class="topbar portal-topbar" role="banner">
      <!-- Sem aria-label: o nome acessível vem do texto visível (título + subtítulo),
           satisfazendo WCAG 2.5.3 (Label in Name) por construção — um aria-label
           customizado que não repetisse literalmente o subtítulo seria rejeitado
           pelo axe (label-content-name-mismatch). -->
      <a class="topbar__brand" routerLink="/processos">
        <span class="topbar__mark" aria-hidden="true">U+</span>
        <span class="topbar__titles">
          <span class="topbar__title">Portal do Candidato</span>
          <span class="topbar__subtitle">Sistema Uni+ · Unifesspa</span>
        </span>
      </a>
      <div class="topbar__actions">
        <ui-a11y-menu />
        <auth-user-header-info />
      </div>
    </header>

    <nav class="portal-nav" aria-label="Navegação principal">
      @for (item of navItems; track item.label) {
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

      <footer class="portal-footer">
        <div class="portal-footer__top">
          <div class="portal-footer__brand">
            <span class="portal-footer__brand-mark" aria-hidden="true">U+</span>
            <p>Sistema Unificado de Seleção e Ingresso da UNIFESSPA.</p>
          </div>
          @for (group of footerGroups; track group.label) {
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

    <ui-back-to-top [defaultContainer]="portalScroll" />
    <ui-vlibras-loader />
  `,
})
export class PortalShellComponent {
  // "Meu perfil" completa o caminho de volta pro shell administrativo — sem
  // ele, quem chega em /processos via link direto não alcançava essa área
  // por nenhum menu (achado de revisão, issue #776). "Documentos" fica de
  // fora por ora: é placeholder vazio, sem funcionalidade real ainda; a
  // rota continua existindo e acessível por URL direta, e ganha link aqui
  // quando houver conteúdo de verdade por trás.
  protected readonly navItems: readonly PortalNavItem[] = [
    { label: 'Editais', icon: 'pi-calendar', routerLink: '/processos' },
    { label: 'Minhas inscrições', icon: 'pi-check-square', routerLink: '/inscricao' },
    { label: 'Resultados', icon: 'pi-chart-bar', routerLink: '/acompanhamento' },
    { label: 'Meu perfil', icon: 'pi-user', routerLink: '/perfil' },
    { label: 'Ajuda', icon: 'pi-question-circle' },
  ];

  protected readonly footerGroups: readonly PortalFooterGroup[] = [
    {
      label: 'Candidato',
      links: [
        { label: 'Editais', routerLink: '/processos' },
        { label: 'Minhas inscrições', routerLink: '/inscricao' },
        { label: 'Resultados', routerLink: '/acompanhamento' },
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
}
