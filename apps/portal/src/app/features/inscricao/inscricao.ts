import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'ptl-inscricao',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <h2 class="mb-4 text-2xl font-bold text-gray-800">Inscrição</h2>
      <p class="text-gray-600">Formulário de inscrição do candidato.</p>
      <router-outlet />
    </div>
  `,
})
export class InscricaoComponent {}
