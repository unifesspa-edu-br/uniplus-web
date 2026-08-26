import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { REVIEW_NAMES } from '../../processo-seletivo.data';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { StepValidation } from '../../processo-seletivo.models';

@Component({
  selector: 'sel-step-14-revisao',
  standalone: true,
  templateUrl: './step-14-revisao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step14RevisaoComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly names = REVIEW_NAMES;
  readonly completed = computed(
    () => this.names.filter((_, index) => this.store.completedSteps().has(index)).length,
  );
  readonly percent = computed(() => Math.round((this.completed() / this.names.length) * 100));
  readonly pending = computed(() => this.names.length - this.completed());
  stepNumber(index: number): string {
    return String(index + 1).padStart(2, '0');
  }

  /** Último passo — sempre válido (a publicação valida o rascunho completo). */
  validate(): StepValidation {
    return { valid: true };
  }
}
