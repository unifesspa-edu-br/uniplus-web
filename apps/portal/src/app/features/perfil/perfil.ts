import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'ptl-perfil',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <h2 class="mb-4 text-2xl font-bold text-gray-800">Meu Perfil</h2>
      <p class="text-gray-600">Dados pessoais e informações de contato.</p>
      <router-outlet />
    </div>
  `,
})
export class PerfilComponent {}
