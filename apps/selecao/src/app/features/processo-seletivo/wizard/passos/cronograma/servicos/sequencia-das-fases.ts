import { signal } from '@angular/core';
import { FormArray, FormGroup } from '@angular/forms';

import type { FaseForm } from '../cronograma-form';

export class SequenciaDasFases {
  private readonly faseDesmarcada = signal<string | null>(null);
  readonly primeiraFaseDesmarcada = this.faseDesmarcada.asReadonly();

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
    this.faseDesmarcada.set(null);
    const destino = indice + direcao;
    const atual = this.fases.at(indice);
    const vizinha = this.fases.at(destino);
    if (atual === undefined || vizinha === undefined) return;

    const primeiraAntes = this.fases.at(0);
    this.fases.removeAt(indice, { emitEvent: false });
    this.fases.insert(destino, atual, { emitEvent: false });
    this.reposicionar(primeiraAntes);
  }

  /** Tira a fase da sequência e deixa as que ficam numeradas de 1 a N, emitindo uma só vez. */
  retirar(indice: number): void {
    this.faseDesmarcada.set(null);
    if (this.fases.at(indice) === undefined) return;

    const primeiraAntes = this.fases.at(0);
    this.fases.removeAt(indice, { emitEvent: false });
    this.reposicionar(primeiraAntes);
  }

  private reposicionar(primeiraAntes: FormGroup<FaseForm>): void {
    for (const [posicao, grupo] of this.fases.controls.entries()) {
      grupo.controls.ordem.setValue(posicao + 1, { emitEvent: false });
    }
    this.desmarcarAPrimeira(primeiraAntes);
    this.fases.updateValueAndValidity();
  }

  /** Só a fase que passou a ser a primeira perde a marca: a que já era a primeira não foi tocada. */
  private desmarcarAPrimeira(primeiraAntes: FormGroup<FaseForm>): void {
    const primeira = this.fases.at(0);
    if (primeira === primeiraAntes) return;
    if (primeira?.controls.noMesmoMomentoDaAnterior.value !== true) return;
    primeira.controls.noMesmoMomentoDaAnterior.setValue(false, { emitEvent: false });
    this.faseDesmarcada.set(primeira.controls.codigo.value);
  }
}
