import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EmptyStateComponent, PageHeaderComponent } from '@uniplus/shared-ui';

@Component({
  selector: 'ptl-processos',
  standalone: true,
  imports: [RouterOutlet, EmptyStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-page-header heading="Processos Seletivos" description="Lista de processos seletivos abertos para inscrição." />
    <ui-empty-state heading="Nenhum processo aberto" description="Os editais disponíveis para inscrição serão listados aqui." />
    <router-outlet />
  `,
})
export class ProcessosComponent {}
