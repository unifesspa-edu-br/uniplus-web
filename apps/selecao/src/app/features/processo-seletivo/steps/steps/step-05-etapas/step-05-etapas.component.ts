import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { EtapaEdital, StepValidation } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';

@Component({
  selector: 'sel-step-05-etapas',
  standalone: true,
  templateUrl: './step-05-etapas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step05EtapasComponent {
  readonly store = inject(ProcessoSeletivoStore);
  private nextId = 2;

  add(): void {
    const etapa: EtapaEdital = {
      id: `etapa-${this.nextId++}`,
      tipo: '',
      inicio: '2026-01-01',
      fim: '2026-01-30',
      nomeCustomizado: '',
      permiteRecurso: false,
      tagNumeroAtiva: false,
      administrativa: false,
    };
    this.store.patchSection('etapas', [...this.store.draft().etapas, etapa]);
  }

  update(id: string, patch: Partial<EtapaEdital>): void {
    this.store.patchSection(
      'etapas',
      this.store.draft().etapas.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  move(index: number, delta: number): void {
    const target = index + delta;
    const current = [...this.store.draft().etapas];
    if (target < 0 || target >= current.length) return;
    [current[index], current[target]] = [current[target], current[index]];
    this.store.patchSection('etapas', current);
  }

  remove(id: string): void {
    this.store.patchSection(
      'etapas',
      this.store.draft().etapas.filter((item) => item.id !== id),
    );
  }

  openPicker(input: HTMLInputElement): void {
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    if (!this.store.draft().etapas.length) {
      return { valid: false, message: 'Adicione ao menos uma etapa ao processo seletivo.' };
    }
    if (this.store.draft().etapas.some((item) => !item.tipo)) {
      return { valid: false, message: 'Selecione o tipo de todas as etapas.' };
    }
    if (this.store.draft().etapas.some((item) => !item.inicio || !item.fim)) {
      return { valid: false, message: 'Informe início e fim de todas as etapas.' };
    }
    if (this.store.draft().etapas.some((item) => item.fim.localeCompare(item.inicio) < 0)) {
      return { valid: false, message: 'A data de fim não pode ser anterior à de início.' };
    }
    return { valid: true };
  }
}
