import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EmptyStateComponent, PageHeaderComponent } from '@uniplus/shared-ui/components';

@Component({
  selector: 'ing-matriculas',
  standalone: true,
  imports: [RouterOutlet, EmptyStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-page-header heading="Matrículas" description="Efetivação de matrículas." />
    <ui-empty-state
      heading="Nenhuma matrícula pendente"
      description="As etapas de efetivação aparecerão nesta área."
    />
    <router-outlet />
  `,
})
export class MatriculasComponent {}
