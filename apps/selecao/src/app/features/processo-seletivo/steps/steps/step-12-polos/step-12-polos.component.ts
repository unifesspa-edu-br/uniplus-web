import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { POLOS } from '../../processo-seletivo.data';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { StepValidation } from '../../processo-seletivo.models';

@Component({
  selector: 'sel-step-12-polos',
  standalone: true,
  templateUrl: './step-12-polos.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step12PolosComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly polos = POLOS;
  selected(city: string): boolean {
    return this.store.draft().polos[city]?.selected ?? false;
  }
  capacidade(city: string): number | null {
    return this.store.draft().polos[city]?.capacidade ?? null;
  }
  patch(city: string, selected: boolean, capacidade = this.capacidade(city)): void {
    this.store.patchSection('polos', {
      ...this.store.draft().polos,
      [city]: { selected, capacidade },
    });
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    const selected = Object.entries(this.store.draft().polos).filter(
      ([, config]) => config.selected,
    );
    if (!selected.length) return { valid: true };
    const semCapacidade = selected.some(
      ([, config]) => !config.capacidade || config.capacidade <= 0,
    );
    if (semCapacidade) {
      return { valid: false, message: 'Informe a capacidade dos polos selecionados.' };
    }
    return { valid: true };
  }
}
