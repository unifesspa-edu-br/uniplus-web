import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { POLOS } from '../../processo-seletivo.data';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';

@Component({ selector: 'app-step-11-polos', standalone: true, templateUrl: './step-11-polos.component.html', changeDetection: ChangeDetectionStrategy.OnPush })
export class Step11PolosComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly polos = POLOS;
  selected(city: string): boolean { return this.store.draft().polos[city]?.selected ?? false; }
  capacidade(city: string): number | null { return this.store.draft().polos[city]?.capacidade ?? null; }
  patch(city: string, selected: boolean, capacidade = this.capacidade(city)): void {
    this.store.patchSection('polos', { ...this.store.draft().polos, [city]: { selected, capacidade } });
  }
}
