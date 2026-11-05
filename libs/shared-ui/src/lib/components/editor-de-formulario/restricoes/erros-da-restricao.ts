import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** O problema que impede a restrição de ser gravada e as recusas da API que a apontam. */
@Component({
  selector: 'ui-erros-da-restricao',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../anfitriao.css',
  template: `
    @if (problema(); as texto) {
      <p class="field__error" [id]="idBase() + '-erro'">{{ texto }}</p>
    }
    @if (recusas().length > 0) {
      <ul class="editor-formulario__erros u-list" [id]="idBase() + '-recusas'">
        @for (recusa of recusas(); track $index) {
          <li class="field__error">{{ recusa }}</li>
        }
      </ul>
    }
  `,
})
export class ErrosDaRestricaoComponent {
  readonly problema = input<string | null>(null);
  readonly recusas = input<readonly string[]>([]);
  readonly idBase = input.required<string>();
}
