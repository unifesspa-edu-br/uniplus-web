import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'ptl-documentos',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <h2 class="mb-4 text-2xl font-bold text-gray-800">Documentos</h2>
      <p class="text-gray-600">Upload e gestão de documentos comprobatórios.</p>
      <router-outlet />
    </div>
  `,
})
export class DocumentosComponent {}
