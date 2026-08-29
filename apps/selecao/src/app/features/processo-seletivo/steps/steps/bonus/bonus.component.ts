import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { StepValidation } from '../../processo-seletivo.models';
import { provePassoDoWizard } from '../../passo-do-wizard';

@Component({
  selector: 'sel-step-bonus',
  standalone: true,
  templateUrl: './bonus.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provePassoDoWizard(BonusStepComponent)],
})
export class BonusStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  /** Só as modalidades que as ofertas de vagas selecionam podem receber bônus. */
  readonly modalidades = computed(() => this.store.modalidadesDoProcesso());

  /**
   * O que vale de fato: a escolha do operador cruzada com as aceitas. A escolha
   * é guardada intacta, então voltar a aceitar uma modalidade no passo 3 a traz
   * de volta ao bônus.
   */
  readonly modalidadesEfetivas = computed(() => {
    const aceitas = new Set(this.modalidades());
    return this.store.draft().bonus.modalidades.filter((code) => aceitas.has(code));
  });

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
    if (!this.modalidadesEfetivas().length) {
      return {
        valid: false,
        message: 'Selecione ao menos uma modalidade aceita para o bônus.',
      };
    }
    return { valid: true };
  }
}
