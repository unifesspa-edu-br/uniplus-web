import { FormArray, FormGroup } from '@angular/forms';

import type { FaseForm } from '../cronograma-form';

export class SequenciaDasFases {
  constructor(private readonly fases: FormArray<FormGroup<FaseForm>>) {}

  /**
   * Troca a fase de lugar.
   *
   * A troca é sempre aplicada. Trocar duas fases adjacentes forma o ciclo de
   * ordem que o servidor não persiste numa chamada só — mas recusar aqui
   * deixaria a linha do tempo impossível de reordenar, porque toda troca entre
   * vizinhas tem essa forma. A edição aceita; quem arbitra é a gravação, e é lá
   * que a orientação aparece, com o cronograma que a provocou à vista.
   */
  mover(indice: number, direcao: -1 | 1): void {
    const destino = indice + direcao;
    const atual = this.fases.at(indice);
    const vizinha = this.fases.at(destino);
    if (atual === undefined || vizinha === undefined) return;

    this.fases.removeAt(indice, { emitEvent: false });
    this.fases.insert(destino, atual, { emitEvent: false });
    this.reposicionar();
  }

  /** Tira a fase da sequência e deixa as que ficam numeradas de 1 a N, emitindo uma só vez. */
  retirar(indice: number): void {
    if (this.fases.at(indice) === undefined) return;

    this.fases.removeAt(indice, { emitEvent: false });
    this.reposicionar();
  }

  private reposicionar(): void {
    for (const [posicao, grupo] of this.fases.controls.entries()) {
      grupo.controls.ordem.setValue(posicao + 1, { emitEvent: false });
    }
    this.fases.updateValueAndValidity();
  }
}
