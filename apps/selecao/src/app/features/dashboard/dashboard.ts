import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'sel-dashboard',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <h2 class="mb-4 text-2xl font-bold text-gray-800">Dashboard</h2>
      <p class="text-gray-600">Painel administrativo do módulo Seleção.</p>
      <router-outlet />
    </div>
  `,
})
export class DashboardComponent {}
