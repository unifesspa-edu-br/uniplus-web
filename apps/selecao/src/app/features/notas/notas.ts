import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EmptyStateComponent, PageHeaderComponent } from '@uniplus/shared-ui/components';

@Component({
  selector: 'sel-notas',
  standalone: true,
  imports: [RouterOutlet, EmptyStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-page-header heading="Notas" description="Lançamento de notas por etapa." />
    <ui-empty-state
      heading="Lançamento indisponível"
      description="As etapas avaliativas serão exibidas aqui quando configuradas."
    />
    <router-outlet />
  `,
})
export class NotasComponent {}
