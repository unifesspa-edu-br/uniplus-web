import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { REVIEW_NAMES } from '../../processo-seletivo.data';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { StepValidation } from '../../processo-seletivo.models';
import { AnexoEditalComponent } from '../../shared/anexo-edital/anexo-edital.component';

@Component({
  selector: 'sel-step-13-revisao',
  standalone: true,
  imports: [AnexoEditalComponent],
  templateUrl: './step-13-revisao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step13RevisaoComponent {
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

  /**
   * O edital é exigido aqui porque é aqui que ele é gravado — e porque
   * publicar não acontece sem ele: `documentoEditalId` é obrigatório no comando
   * de publicação. Cobrá-lo antes, na identificação, fazia o rascunho depender
   * de um documento que só o ato normativo justifica.
   */
  validate(): StepValidation {
    const anexo = this.store.draft().identificacao.uploads[0];

    if (anexo === undefined) {
      return { valid: false, messages: ['Anexe o edital em PDF para publicar o processo.'] };
    }
    if (anexo.fase !== 'confirmado') {
      return { valid: false, messages: ['Aguarde a conclusão do envio do edital.'] };
    }
    return { valid: true };
  }
}
