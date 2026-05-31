import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EmptyStateComponent, PageHeaderComponent } from '@uniplus/shared-ui/components';

@Component({
  selector: 'ing-chamadas',
  standalone: true,
  imports: [RouterOutlet, EmptyStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-page-header heading="Chamadas" description="Gestão de chamadas de vagas." />
    <ui-empty-state
      heading="Nenhuma chamada configurada"
      description="As listas de chamada serão apresentadas nesta área."
    />
    <router-outlet />
  `,
})
export class ChamadasComponent {}
