import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { TIPO_PROCESSO_OPTIONS } from '../../processo-seletivo.data';

@Component({
  selector: 'sel-step-01-tipo-processo',
  standalone: true,
  templateUrl: './step-01-tipo-processo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step01TipoProcessoComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly options = TIPO_PROCESSO_OPTIONS;
  readonly query = signal('');
  readonly filteredOptions = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('pt-BR');
    return query
      ? this.options.filter((item) => item.name.toLocaleLowerCase('pt-BR').includes(query))
      : this.options;
  });

  select(value: string): void {
    this.store.patchObjectSection('tipoProcesso', { selected: value });
  }
}
