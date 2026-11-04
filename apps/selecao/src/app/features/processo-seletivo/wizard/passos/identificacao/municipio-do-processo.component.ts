import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { ComboboxComponent, ValorLegivelDirective } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { BuscaDeMunicipio } from './servicos/busca-de-municipio.service';

/** O município cujo calendário rege os prazos do processo. */
@Component({
  selector: 'sel-municipio-do-processo',
  imports: [ValorLegivelDirective, ComboboxComponent],
  templateUrl: './municipio-do-processo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class MunicipioDoProcessoComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly busca = inject(BuscaDeMunicipio);

  readonly invalido = input.required<boolean>();

  /** O combobox do município: o rótulo do campo aponta para o id que ele gera. */
  protected readonly campoDoMunicipio = viewChild(ComboboxComponent);

  protected readonly bloqueado = computed(() => this.store.cadastroInicialCongelado());
}
