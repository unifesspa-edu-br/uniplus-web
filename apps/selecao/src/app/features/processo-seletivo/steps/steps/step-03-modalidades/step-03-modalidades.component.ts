import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MODALIDADES } from '../../processo-seletivo.data';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { StepValidation } from '../../processo-seletivo.models';
import { ModalidadeConcorrencia } from '@uniplus/shared-data/selecao';

@Component({
  selector: 'sel-step-03-modalidades',
  standalone: true,
  templateUrl: './step-03-modalidades.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step03ModalidadesComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly modalidades = MODALIDADES;
  readonly allSelected = computed(
    () => this.store.draft().modalidades.selected.length === this.modalidades.length,
  );
  readonly indeterminate = computed(() => {
    const length = this.store.draft().modalidades.selected.length;
    return length > 0 && length < this.modalidades.length;
  });

  toggleAll(checked: boolean): void {
    const selected = checked ? this.modalidades.map((item) => item.code) : [];
    this.store.patchObjectSection('modalidades', { selected });
    this.descartarOrfas(selected);
  }

  toggle(code: ModalidadeConcorrencia, checked: boolean): void {
    const atual = this.store.draft().modalidades.selected;
    const selected = checked ? [...atual, code] : atual.filter((item) => item !== code);
    this.store.patchObjectSection('modalidades', { selected });
    this.descartarOrfas(selected);
  }

  /**
   * Desmarcar uma modalidade aqui precisa removê-la também do bônus e dos
   * documentos: só esconder a opção deixaria o rascunho com bônus ou exigência
   * para uma modalidade que o processo não aceita.
   */
  private descartarOrfas(selected: readonly ModalidadeConcorrencia[]): void {
    const aceitas = new Set(selected);
    const draft = this.store.draft();

    this.store.patchObjectSection('bonus', {
      modalidades: draft.bonus.modalidades.filter((code) => aceitas.has(code)),
    });

    const documentos = Object.fromEntries(
      Object.entries(draft.documentos).map(([id, config]) => [
        id,
        { ...config, modalidades: config.modalidades.filter((code) => aceitas.has(code)) },
      ]),
    );
    this.store.patchSection('documentos', documentos);
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    return this.store.draft().modalidades.selected.length > 0
      ? { valid: true }
      : { valid: false, message: 'Selecione ao menos uma modalidade de concorrência.' };
  }
}
