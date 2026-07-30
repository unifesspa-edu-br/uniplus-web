import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MODALIDADES } from '../../processo-seletivo.data';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';

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
    this.store.patchObjectSection('modalidades', {
      selected: checked ? this.modalidades.map((item) => item.id) : [],
    });
  }

  toggle(id: string, checked: boolean): void {
    const selected = this.store.draft().modalidades.selected;
    this.store.patchObjectSection('modalidades', {
      selected: checked ? [...selected, id] : selected.filter((item) => item !== id),
    });
  }
}
