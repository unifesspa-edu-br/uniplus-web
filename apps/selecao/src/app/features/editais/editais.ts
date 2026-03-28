import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'sel-editais',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <h2 class="mb-4 text-2xl font-bold text-gray-800">Editais</h2>
      <p class="text-gray-600">Gestão de editais de processos seletivos.</p>
      <router-outlet />
    </div>
  `,
})
export class EditaisComponent {}
