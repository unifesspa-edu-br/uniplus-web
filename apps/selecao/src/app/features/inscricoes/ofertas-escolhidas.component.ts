import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { OfertaExibida } from '@uniplus/shared-data/selecao';

/**
 * As ofertas que a inscrição escolheu. Com uma, só o nome; com duas ou mais, a lista numerada pela
 * ordem da escolha, que o `value` do item grava no marcador nativo.
 */
@Component({
  selector: 'sel-ofertas-escolhidas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ofertas().length === 1) {
      {{ ofertas()[0].nome }}
    } @else if (ofertas().length > 1) {
      <ol class="ofertas u-list u-list--ordered">
        @for (oferta of ofertas(); track oferta.id) {
          <li [value]="oferta.ordem">{{ oferta.nome }}</li>
        }
      </ol>
    }
  `,
  styles: `
    .ofertas {
      margin: 0;
      padding-inline-start: var(--space-6);
    }
  `,
})
export class OfertasEscolhidasComponent {
  readonly ofertas = input.required<readonly OfertaExibida[]>();
}
