import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EmptyStateComponent, PageHeaderComponent } from '@uniplus/shared-ui/components';

@Component({
  selector: 'ing-convocacoes',
  standalone: true,
  imports: [RouterOutlet, EmptyStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-page-header heading="Convocações" description="Convocação de candidatos aprovados." />
    <ui-empty-state
      heading="Nenhuma convocação emitida"
      description="As convocações publicadas serão exibidas nesta tela."
    />
    <router-outlet />
  `,
})
export class ConvocacoesComponent {}
