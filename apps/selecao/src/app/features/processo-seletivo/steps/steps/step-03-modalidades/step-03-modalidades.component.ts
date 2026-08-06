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
    const anteriores = this.store.draft().modalidades.selected;
    const selected = checked ? this.modalidades.map((item) => item.code) : [];
    this.store.patchObjectSection('modalidades', { selected });
    this.sincronizarModalidades(anteriores, selected);
  }

  toggle(code: ModalidadeConcorrencia, checked: boolean): void {
    const anteriores = this.store.draft().modalidades.selected;
    const selected = checked ? [...anteriores, code] : anteriores.filter((item) => item !== code);
    this.store.patchObjectSection('modalidades', { selected });
    this.sincronizarModalidades(anteriores, selected);
  }

  /**
   * Mudar a seleção aqui repercute no bônus e nos documentos, que só podem
   * citar modalidades que o processo aceita.
   *
   * O bônus é escolha explícita do operador no passo 7: dele apenas removemos
   * o que deixou de ser aceito.
   *
   * Nos documentos há dois casos. Quem ainda está no padrão — exigido de todas
   * as modalidades aceitas — acompanha a nova seleção, senão ficaria preso à
   * primeira modalidade escolhida. Quem foi restringido no passo 10 mantém o
   * recorte do operador, perdendo apenas o que deixou de ser aceito.
   */
  private sincronizarModalidades(
    anteriores: readonly ModalidadeConcorrencia[],
    selected: readonly ModalidadeConcorrencia[],
  ): void {
    const aceitas = new Set(selected);
    const draft = this.store.draft();

    this.store.patchObjectSection('bonus', {
      modalidades: draft.bonus.modalidades.filter((code) => aceitas.has(code)),
    });

    const documentos = Object.fromEntries(
      Object.entries(draft.documentos).map(([id, config]) => [
        id,
        {
          ...config,
          modalidades: estaNoPadrao(config.modalidades, anteriores)
            ? [...selected]
            : config.modalidades.filter((code) => aceitas.has(code)),
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

/** O documento está no padrão quando cobre exatamente as modalidades aceitas. */
function estaNoPadrao(
  configuradas: readonly ModalidadeConcorrencia[],
  aceitas: readonly ModalidadeConcorrencia[],
): boolean {
  if (configuradas.length !== aceitas.length) return false;
  const conjunto = new Set(configuradas);
  return aceitas.every((code) => conjunto.has(code));
}
