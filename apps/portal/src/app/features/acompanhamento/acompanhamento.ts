import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EmptyStateComponent, PageHeaderComponent } from '@uniplus/shared-ui';

@Component({
  selector: 'ptl-acompanhamento',
  standalone: true,
  imports: [RouterOutlet, EmptyStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-page-header heading="Acompanhamento" description="Acompanhe o status da sua inscrição e resultados." />
    <ui-empty-state heading="Nenhum acompanhamento disponível" description="Quando houver inscrição ativa, o andamento será mostrado aqui." />
    <router-outlet />
  `,
})
export class AcompanhamentoComponent {}
