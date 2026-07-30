import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MODALIDADES_CANONICAS } from '../../processo-seletivo.data';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';

@Component({ selector: 'app-step-07-bonus', standalone: true, templateUrl: './step-07-bonus.component.html', changeDetection: ChangeDetectionStrategy.OnPush })
export class Step07BonusComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly modalidades = MODALIDADES_CANONICAS;

  toggleModalidade(code: string, checked: boolean): void {
    const current = this.store.draft().bonus.modalidades;
    this.store.patchObjectSection('bonus', { modalidades: checked ? [...current, code] : current.filter((item) => item !== code) });
  }
}
