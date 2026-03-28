import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'sel-inscricoes',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <h2 class="mb-4 text-2xl font-bold text-gray-800">Inscrições</h2>
      <p class="text-gray-600">Gestão de inscrições de candidatos.</p>
      <router-outlet />
    </div>
  `,
})
export class InscricoesComponent {}
