import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AreaPesoAreaEnemDto } from '@uniplus/shared-data/configuracao';

/** O cabeçalho da grade: o grupo de curso e uma coluna por área, na ordem da API. */
@Component({
  selector: 'div[cfgPesosEnemColunas]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="num-cell">Grupo de curso</div>
    @for (area of areas(); track area.codigo) {
      <div class="num-cell num-cell--head">{{ area.rotulo }}</div>
    }
  `,
  host: { class: 'num-grid__header', 'aria-hidden': 'true' },
})
export class PesosEnemColunasComponent {
  readonly areas = input.required<readonly AreaPesoAreaEnemDto[]>();
}
