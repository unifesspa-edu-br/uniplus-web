import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { EmptyStateComponent, PageHeaderComponent } from '@uniplus/shared-ui';

@Component({
  selector: 'ptl-perfil',
  standalone: true,
  imports: [RouterOutlet, EmptyStateComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-page-header heading="Meu Perfil" description="Dados pessoais e informações de contato." />
    <ui-empty-state heading="Perfil em preparação" description="Os dados da conta autenticada serão exibidos nesta área." />
    <router-outlet />
  `,
})
export class PerfilComponent {}
