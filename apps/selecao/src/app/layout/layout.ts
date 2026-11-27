import { MENU_LATERAL } from './menu-lateral';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { PermissoesService, UserContextService } from '@uniplus/shared-auth/bootstrap';
import { PerfisDaBarraComponent, UserHeaderInfoComponent } from '@uniplus/shared-auth/components';
import { PERMISSOES_DAS_TELAS } from '../acesso/permissoes-das-telas';
import { TrilhaContextual } from '../trilha-contextual';
import {
  AppShellComponent,
  UiShellBreadcrumbItem,
  UiShellNavGroup,
} from '@uniplus/shared-ui/shell';

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

  private readonly trilhaContextual = inject(TrilhaContextual);

  private readonly breadcrumbDaRota = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.breadcrumbDaRotaAtiva()),
    ),
    { initialValue: this.breadcrumbDaRotaAtiva() },
  );

  protected readonly breadcrumb = computed(
    () => this.trilhaContextual.itens() ?? this.breadcrumbDaRota(),
  );

  protected readonly sidebarUserInitials = computed(() => initials(this.userContext.displayName()));

  /**
   * Menu único do acompanhamento; Notas, Homologação e Classificação não têm entrada.
   * Mostra entradas protegidas apenas após carregar as permissões efetivas. Na primeira carga ou
   * quando a API recusa a consulta, só o painel permanece visível; a recarga de quem já tinha as
   * permissões carregadas não esconde o menu. Grupos vazios não aparecem.
   */
  protected readonly navGroups = computed<readonly UiShellNavGroup[]>(() =>
    MENU_LATERAL.map((grupo) => ({
      ...grupo,
      items: grupo.items.filter(
        (item) =>
          item.tela === undefined ||
          (this.permissoes.estado() === 'carregada' &&
            this.permissoes.temAlguma(...PERMISSOES_DAS_TELAS[item.tela])),
      ),
    })).filter((grupo) => grupo.items.length > 0),
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
