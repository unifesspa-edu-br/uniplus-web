import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EmptyStateComponent, PageHeaderComponent } from '@uniplus/shared-ui';

@Component({
  selector: 'sel-inscricoes',
  standalone: true,
  imports: [RouterOutlet, EmptyStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-page-header heading="Inscrições" description="Gestão de inscrições de candidatos." />
    <ui-empty-state heading="Nenhuma inscrição selecionada" description="Use os filtros da listagem para localizar inscrições quando a integração estiver disponível." />
    <router-outlet />
  `,
})
export class InscricoesComponent {}
