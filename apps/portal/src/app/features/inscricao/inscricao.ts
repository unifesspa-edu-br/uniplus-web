import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EmptyStateComponent, PageHeaderComponent } from '@uniplus/shared-ui';

@Component({
  selector: 'ptl-inscricao',
  standalone: true,
  imports: [RouterOutlet, EmptyStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-page-header heading="Inscrição" description="Formulário de inscrição do candidato." />
    <ui-empty-state heading="Escolha um processo seletivo" description="A inscrição começa pela lista de processos disponíveis." />
    <router-outlet />
  `,
})
export class InscricaoComponent {}
