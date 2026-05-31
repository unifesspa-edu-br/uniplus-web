import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EmptyStateComponent, PageHeaderComponent } from '@uniplus/shared-ui/components';

@Component({
  selector: 'ing-dashboard',
  standalone: true,
  imports: [RouterOutlet, EmptyStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-page-header heading="Dashboard" description="Painel administrativo do módulo Ingresso." />
    <ui-empty-state
      heading="Painel em preparação"
      description="Indicadores de ingresso e matrícula serão exibidos aqui."
    />
    <router-outlet />
  `,
})
export class DashboardComponent {}
