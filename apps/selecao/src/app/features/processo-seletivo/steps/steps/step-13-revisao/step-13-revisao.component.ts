import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { REVIEW_NAMES } from '../../processo-seletivo.data';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { StepValidation } from '../../processo-seletivo.models';
import { AnexoEditalComponent } from '../../shared/anexo-edital/anexo-edital.component';
import { provePassoDoWizard } from '../../passo-do-wizard';

@Component({
  selector: 'sel-step-13-revisao',
  standalone: true,
  imports: [AnexoEditalComponent],
  templateUrl: './step-13-revisao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provePassoDoWizard(Step13RevisaoComponent)],
})
export class Step13RevisaoComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly names = REVIEW_NAMES;
  readonly passosConcluidos = computed(
    () => this.names.filter((_, index) => this.store.completedSteps().has(index)).length,
  );

  /** O edital selado — o mesmo estado que `validate()` cobra para publicar. */
  readonly editalConfirmado = computed(
    () => this.store.draft().identificacao.uploads[0]?.fase === 'confirmado',
  );

  /**
   * O edital conta como requisito ao lado dos passos, e não à parte. Contar só
   * os passos anunciava "tudo pronto para publicar" numa tela que, no clique
   * seguinte, recusava a publicação por falta do PDF.
   */
  readonly totalRequisitos = this.names.length + 1;
  readonly atendidos = computed(() => this.passosConcluidos() + (this.editalConfirmado() ? 1 : 0));
  readonly percent = computed(() => Math.round((this.atendidos() / this.totalRequisitos) * 100));
  readonly pending = computed(() => this.totalRequisitos - this.atendidos());
  readonly pronto = computed(() => this.pending() === 0);

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
