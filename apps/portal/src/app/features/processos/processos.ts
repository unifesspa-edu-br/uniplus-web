import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'ptl-processos',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <h2 class="mb-4 text-2xl font-bold text-gray-800">Processos Seletivos</h2>
      <p class="text-gray-600">Lista de processos seletivos abertos para inscrição.</p>
      <router-outlet />
    </div>
  `,
})
export class ProcessosComponent {}
