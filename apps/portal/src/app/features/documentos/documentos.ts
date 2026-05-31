import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EmptyStateComponent, PageHeaderComponent } from '@uniplus/shared-ui';

@Component({
  selector: 'ptl-documentos',
  standalone: true,
  imports: [RouterOutlet, EmptyStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-page-header heading="Documentos" description="Upload e gestão de documentos comprobatórios." />
    <ui-empty-state heading="Nenhum documento solicitado" description="As pendências documentais serão listadas nesta tela." />
    <router-outlet />
  `,
})
export class DocumentosComponent {}
