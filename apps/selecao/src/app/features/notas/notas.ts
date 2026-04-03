import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'sel-notas',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <h2 class="mb-4 text-2xl font-bold text-gray-800">Notas</h2>
      <p class="text-gray-600">Lançamento de notas por etapa.</p>
      <router-outlet />
    </div>
  `,
})
export class NotasComponent {}
