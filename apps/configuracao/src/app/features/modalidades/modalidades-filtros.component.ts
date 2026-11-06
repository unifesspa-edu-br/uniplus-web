import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import {
  FilterBarComponent,
  FilterChipsComponent,
  type UiFiltroAtivo,
  type UiFilterChipOption,
} from '@uniplus/shared-ui/components';

/** A busca por código ou descrição e o filtro por natureza legal. */
@Component({
  selector: 'cfg-modalidades-filtros',
  standalone: true,
  imports: [FilterBarComponent, FilterChipsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modalidades-filtros.component.html',
  styles: [':host { display: block; }'],
})
export class ModalidadesFiltrosComponent {
  readonly busca = model.required<string>();
  readonly naturezaSelecionada = model.required<string | null>();
  readonly filtrosAtivos = input.required<readonly UiFiltroAtivo[]>();
  readonly chipsNatureza = input.required<readonly UiFilterChipOption[]>();
  readonly removendo = input.required<boolean>();
  readonly limpar = output<void>();
}
