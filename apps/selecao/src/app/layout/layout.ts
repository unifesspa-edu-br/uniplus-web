import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { PermissoesService, UserContextService } from '@uniplus/shared-auth/bootstrap';
import { PerfisDaBarraComponent, UserHeaderInfoComponent } from '@uniplus/shared-auth/components';
import { PERMISSOES_DAS_TELAS, type CaminhoDeTela } from '../acesso/permissoes-das-telas';
import {
  AppShellComponent,
  UiShellBreadcrumbItem,
  UiShellNavGroup,
} from '@uniplus/shared-ui/shell';

interface SelNavItem {
  readonly label: string;
  readonly icon: string;
  readonly routerLink?: string;
  readonly exact?: boolean;
  /** Tela protegida cuja permissão libera a entrada; ausente, basta a sessão. */
  readonly tela?: CaminhoDeTela;
}

interface SelNavGroup {
  readonly label: string;
  readonly items: readonly SelNavItem[];
}

@Component({
  selector: 'sel-layout',
  standalone: true,
  imports: [RouterOutlet, AppShellComponent, UserHeaderInfoComponent, PerfisDaBarraComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './layout.css',
  template: `
    <ui-app-shell
      appName="Uni+"
      subtitle="CEPS · Seleção"
      [navGroups]="navGroups()"
      [breadcrumb]="breadcrumb()"
    >
      <ng-container ngProjectAs="[uiShellActions]">
        <auth-user-header-info />
      </ng-container>
      <ng-container ngProjectAs="[uiShellUser]">
        @if (userContext.user(); as profile) {
          <div class="avatar avatar--sm sidebar__avatar" aria-hidden="true">
            {{ sidebarUserInitials() }}
          </div>
          <div class="sidebar__user-info">
            <strong>{{ userContext.displayName() }}</strong>
            <auth-perfis-da-barra [username]="profile.username" />
          </div>
        }
      </ng-container>
      <router-outlet />
    </ui-app-shell>
  `,
})
export class LayoutComponent {
  private readonly permissoes = inject(PermissoesService);
  private readonly router = inject(Router);
  protected readonly userContext = inject(UserContextService);

  protected readonly breadcrumb = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.breadcrumbDaRotaAtiva()),
    ),
    { initialValue: this.breadcrumbDaRotaAtiva() },
  );

  protected readonly sidebarUserInitials = computed(() => initials(this.userContext.displayName()));

  /** Menu único do acompanhamento; Notas, Homologação e Classificação não têm entrada. */
  private readonly navGroupsDeclarados: readonly SelNavGroup[] = [
    {
      label: 'Acompanhamento',
      items: [
        {
          label: 'Painel de processos',
          icon: 'pi-table',
          routerLink: '/dashboard',
        },
      ],
    },
    {
      label: 'Cadastro',
      items: [
        {
          label: 'Processos seletivos',
          icon: 'pi-file',
          routerLink: '/processo-seletivo',
          tela: 'processo-seletivo',
        },
      ],
    },
  ];

  /**
   * Segue as permissões efetivas: enquanto carregam ou se a consulta falha, o conjunto está vazio e
   * só sobra o painel, que depende apenas da sessão. Grupos vazios não aparecem.
   */
  protected readonly navGroups = computed<readonly UiShellNavGroup[]>(() =>
    this.navGroupsDeclarados
      .map((grupo) => ({
        ...grupo,
        items: grupo.items.filter(
          (item) =>
            item.tela === undefined ||
            this.permissoes.temAlguma(...PERMISSOES_DAS_TELAS[item.tela]),
        ),
      }))
      .filter((grupo) => grupo.items.length > 0),
  );

  private breadcrumbDaRotaAtiva(): UiShellBreadcrumbItem[] {
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let label = 'Visão Geral';
    while (route !== null) {
      const breadcrumb = route.data['breadcrumb'];
      if (typeof breadcrumb === 'string') label = breadcrumb;
      route = route.firstChild;
    }
    return [{ label: 'Início', routerLink: '/' }, { label }];
  }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
