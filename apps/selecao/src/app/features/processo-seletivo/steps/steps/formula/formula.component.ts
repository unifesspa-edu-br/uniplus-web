import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { StepValidation } from '../../processo-seletivo.models';
import { provePassoDoWizard } from '../../passo-do-wizard';

@Component({
  selector: 'sel-step-formula',
  standalone: true,
  templateUrl: './formula.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provePassoDoWizard(FormulaStepComponent)],
})
export class FormulaStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  /** Campos inválidos detectados na última validação (chave → `.is-invalid`). */
  readonly invalidFields = signal<ReadonlySet<string>>(new Set());
  readonly preview = computed(() => {
    switch (this.store.draft().formula.agregacao) {
      case 'SOMA_PONDERADA_COM_FATOR':
        return 'NOTA_FINAL = Σ(NOTA_ETAPA × PESO) / FATOR';
      case 'MEDIA_SIMPLES':
        return 'NOTA_FINAL = Σ NOTAS / N ETAPAS';
      case 'MEDIA_PONDERADA_ENEM':
        return 'NOTA_FINAL = Σ(NOTA_ÁREA_ENEM × PESO_DO_CURSO) / Σ PESOS';
      default:
        return 'NOTA_FINAL = ((N1×1) + (N2×1) + (N3×1) + (N4×1) + (N5×1)) / 5';
    }
  });

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    const formula = this.store.draft().formula;
    const messages: string[] = [];
    const invalid = new Set<string>();

    if (!formula.agregacao) {
      messages.push('Selecione a fórmula de agregação.');
      invalid.add('agregacao');
    }
    if (!formula.precisao) {
      messages.push('Selecione a regra de precisão.');
      invalid.add('precisao');
    }

    this.invalidFields.set(invalid);
    return messages.length ? { valid: false, messages } : { valid: true };
  }
}
