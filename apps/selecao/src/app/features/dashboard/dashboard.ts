import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EmptyStateComponent, PageHeaderComponent } from '@uniplus/shared-ui';

@Component({
  selector: 'sel-dashboard',
  standalone: true,
  imports: [RouterOutlet, EmptyStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-page-header heading="Dashboard" description="Painel administrativo do módulo Seleção." />
    <ui-empty-state heading="Painel em preparação" description="Os indicadores operacionais serão exibidos aqui." />
    <router-outlet />
  `,
})
export class DashboardComponent {}
