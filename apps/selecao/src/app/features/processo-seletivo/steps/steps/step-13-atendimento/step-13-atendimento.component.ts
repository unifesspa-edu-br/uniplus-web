import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  ATENDIMENTO_CONDICOES,
  ATENDIMENTO_RECURSOS,
  PCD_TIPOS,
} from '../../processo-seletivo.data';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { StepValidation } from '../../processo-seletivo.models';

@Component({
  selector: 'sel-step-13-atendimento',
  standalone: true,
  templateUrl: './step-13-atendimento.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step13AtendimentoComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly conditions = ATENDIMENTO_CONDICOES;
  readonly resources = ATENDIMENTO_RECURSOS;
  readonly pcdTypes = PCD_TIPOS;

  toggle(field: 'condicoes' | 'tiposPcd' | 'recursos', id: string, checked: boolean): void {
    const current = this.store.draft().atendimento[field];
    const next = checked ? [...current, id] : current.filter((item) => item !== id);
    const patch = { [field]: next };
    if (field === 'condicoes' && id === 'pcd' && !checked) Object.assign(patch, { tiposPcd: [] });
    this.store.patchObjectSection('atendimento', patch);
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    const atendimento = this.store.draft().atendimento;
    if (atendimento.condicoes.includes('pcd') && !atendimento.tiposPcd.length) {
      return { valid: false, message: 'Informe o tipo de deficiência para a condição PcD.' };
    }
    return { valid: true };
  }
}
