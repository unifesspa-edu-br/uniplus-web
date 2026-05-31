import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EmptyStateComponent, PageHeaderComponent } from '@uniplus/shared-ui/components';

@Component({
  selector: 'sel-homologacao',
  standalone: true,
  imports: [RouterOutlet, EmptyStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-page-header heading="Homologação" description="Análise e homologação de documentos." />
    <ui-empty-state
      heading="Fila de homologação vazia"
      description="As solicitações pendentes aparecerão nesta tela."
    />
    <router-outlet />
  `,
})
export class HomologacaoComponent {}
