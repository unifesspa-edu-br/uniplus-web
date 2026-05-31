import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EmptyStateComponent, PageHeaderComponent } from '@uniplus/shared-ui';

@Component({
  selector: 'sel-classificacao',
  standalone: true,
  imports: [RouterOutlet, EmptyStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-page-header heading="Classificação" description="Classificação e resultados." />
    <ui-empty-state heading="Classificação em preparação" description="A publicação dos resultados aparecerá nesta área." />
    <router-outlet />
  `,
})
export class ClassificacaoComponent {}
