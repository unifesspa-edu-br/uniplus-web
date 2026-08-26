import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { StepValidation } from '../../processo-seletivo.models';

@Component({
  selector: 'sel-step-10-eliminacao',
  standalone: true,
  templateUrl: './step-10-eliminacao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step10EliminacaoComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly etapas = [
    ['INSCRICAO_CANDIDATOS', 'Inscrição de candidatos'],
    ['HOMOLOGACAO_INSCRICOES', 'Homologação de inscrições'],
    ['IMPORTACAO_NOTAS_ENEM', 'Importação de notas ENEM'],
    ['DIVULGACAO_RESULTADO_FINAL', 'Divulgação do resultado final'],
  ] as const;
  readonly clausulas = [
    'Falta à prova ou entrevista',
    'Fraude ou conduta fraudulenta',
    'Uso de eletrônicos não autorizados',
    'Redação em branco ou anulada',
    'Atraso na chegada ao local da prova',
  ];

  setNota(code: string, raw: string): void {
    this.store.patchObjectSection('eliminacao', {
      notasMinimas: {
        ...this.store.draft().eliminacao.notasMinimas,
        [code]: raw === '' ? null : +raw,
      },
    });
  }
  toggleClausula(value: string, checked: boolean): void {
    const current = this.store.draft().eliminacao.clausulas;
    this.store.patchObjectSection('eliminacao', {
      clausulas: checked ? [...current, value] : current.filter((item) => item !== value),
    });
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    const notas = Object.values(this.store.draft().eliminacao.notasMinimas);
    if (notas.some((value) => value !== null && value < 0)) {
      return { valid: false, message: 'Notas mínimas não podem ser negativas.' };
    }
    return { valid: true };
  }
}
