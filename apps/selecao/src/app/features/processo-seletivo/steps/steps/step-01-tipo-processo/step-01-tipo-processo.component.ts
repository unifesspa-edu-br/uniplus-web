import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TypeCardComponent } from '../../../components/type-card/type-card.component';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { StepValidation, TipoProcessoOption } from '../../processo-seletivo.models';
import tiposProcesso from './tipos-processo.json';

@Component({
  selector: 'sel-step-01-tipo-processo',
  standalone: true,
  imports: [TypeCardComponent],
  templateUrl: './step-01-tipo-processo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step01TipoProcessoComponent {
  readonly store = inject(ProcessoSeletivoStore);
  /** Mock local até a API de tipos de edital ser integrada. */
  readonly options: TipoProcessoOption[] = tiposProcesso.tipos;
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

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    return this.store.draft().tipoProcesso.selected
      ? { valid: true }
      : { valid: false, message: 'Selecione um tipo de edital para continuar.' };
  }
}
