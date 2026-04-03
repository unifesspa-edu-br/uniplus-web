import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'ptl-acompanhamento',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <h2 class="mb-4 text-2xl font-bold text-gray-800">Acompanhamento</h2>
      <p class="text-gray-600">Acompanhe o status da sua inscrição e resultados.</p>
      <router-outlet />
    </div>
  `,
})
export class AcompanhamentoComponent {}
