import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MODALIDADES_CANONICAS } from '../../processo-seletivo.data';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { StepValidation } from '../../processo-seletivo.models';

@Component({
  selector: 'sel-step-07-bonus',
  standalone: true,
  templateUrl: './step-07-bonus.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step07BonusComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly modalidades = MODALIDADES_CANONICAS;

  toggleModalidade(code: string, checked: boolean): void {
    const current = this.store.draft().bonus.modalidades;
    this.store.patchObjectSection('bonus', {
      modalidades: checked ? [...current, code] : current.filter((item) => item !== code),
    });
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    const bonus = this.store.draft().bonus;
    if (!bonus.ativo) return { valid: true };
    if (!bonus.tipo) return { valid: false, message: 'Selecione o tipo de bônus.' };
    if (bonus.valor === null || bonus.valor <= 0) {
      return { valid: false, message: 'Informe o valor do bônus.' };
    }
    if (!bonus.criterio) return { valid: false, message: 'Selecione o critério do bônus.' };
    if (!bonus.modalidades.length) {
      return { valid: false, message: 'Selecione ao menos uma modalidade do bônus.' };
    }
    return { valid: true };
  }
}
