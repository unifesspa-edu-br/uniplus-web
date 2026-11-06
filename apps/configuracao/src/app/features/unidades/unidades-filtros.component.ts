import { ChangeDetectionStrategy, Component, computed, model } from '@angular/core';
import {
  FilterBarComponent,
  FilterChipsComponent,
  type UiFiltroAtivo,
} from '@uniplus/shared-ui/components';
import { TAMANHO_MAXIMO_DA_BUSCA, limparBusca } from './busca-de-unidades';
import { CHIPS_DE_TIPO } from './tipos-de-unidade';

/** A barra de busca por sigla ou nome e o filtro por tipo. */
@Component({
  selector: 'cfg-unidades-filtros',
  imports: [FilterBarComponent, FilterChipsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unidades-filtros.component.html',
})
export class UnidadesFiltrosComponent {
  readonly termoBusca = model.required<string>();
  /** O ordinal do tipo em texto; vazio é "Todas". */
  readonly tipoFiltro = model.required<string>();

  protected readonly chips = CHIPS_DE_TIPO;
  protected readonly tamanhoMaximoDaBusca = TAMANHO_MAXIMO_DA_BUSCA;
  protected readonly filtrosAtivos = computed<readonly UiFiltroAtivo[]>(() => {
    const tipo = this.tipoFiltro();
    if (tipo === '') {
      return [];
    }
    const rotulo = this.chips.find((chip) => chip.value === tipo)?.label ?? tipo;
    return [{ nome: 'Tipo', valor: rotulo }];
  });

  protected limpar(): void {
    limparBusca(this.termoBusca, this.tipoFiltro);
  }
}
