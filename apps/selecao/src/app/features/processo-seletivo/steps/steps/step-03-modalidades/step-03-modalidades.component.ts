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
    this.sincronizarModalidades(selected);
  }

  toggle(code: ModalidadeConcorrencia, checked: boolean): void {
    const atual = this.store.draft().modalidades.selected;
    const selected = checked ? [...atual, code] : atual.filter((item) => item !== code);
    this.store.patchObjectSection('modalidades', { selected });
    this.sincronizarModalidades(selected);
  }

  /**
   * Mudar a seleção aqui repercute no bônus e nos documentos, que só podem
   * citar modalidades que o processo aceita.
   *
   * O bônus é escolha explícita do operador no passo 7: dele apenas removemos
   * o que deixou de ser aceito.
   *
   * Nos documentos há dois casos, distinguidos por `modalidadesRecortadas`.
   * Quem ainda acompanha o processo recebe a nova seleção, senão ficaria preso
   * à primeira modalidade escolhida.
   *
   * Quem foi recortado no passo 10 guarda a escolha do operador **intacta**:
   * o que vale na prática é a interseção com as aceitas, calculada na leitura.
   * Podar aqui destruiria a intenção — desmarcar e remarcar a mesma modalidade
   * no passo 3 esvaziaria o recorte para sempre.
   */
  private sincronizarModalidades(selected: readonly ModalidadeConcorrencia[]): void {
    const draft = this.store.draft();
    const aceitas = new Set(selected);

    this.store.patchObjectSection('bonus', {
      modalidades: draft.bonus.modalidades.filter((code) => aceitas.has(code)),
    });

    const documentos = Object.fromEntries(
      Object.entries(draft.documentos).map(([id, config]) => [
        id,
        {
          ...config,
          modalidades: config.modalidadesRecortadas ? config.modalidades : [...selected],
        },
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

