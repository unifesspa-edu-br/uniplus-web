import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EmptyStateComponent, PageHeaderComponent } from '@uniplus/shared-ui/components';

@Component({
  selector: 'ptl-recursos',
  standalone: true,
  imports: [RouterOutlet, EmptyStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-page-header heading="Recursos" description="Interposição de recursos administrativos." />
    <ui-empty-state
      heading="Nenhum recurso disponível"
      description="Prazos e solicitações de recurso aparecerão nesta tela."
    />
    <router-outlet />
  `,
})
export class RecursosComponent {}
