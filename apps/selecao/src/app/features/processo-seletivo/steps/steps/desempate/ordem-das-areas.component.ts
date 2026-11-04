import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import type { CriterioDesempateConfigurado } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { AreasDoDesempate } from './areas-do-desempate.service';

/** Troca de posição de uma área da ordem: `delta` é -1 para subir e 1 para descer. */
export interface MovimentoDeArea {
  readonly posicao: number;
  readonly delta: number;
}

/**
 * A ordem das áreas do ENEM de um critério por área: as áreas já escolhidas, com os botões que as
 * sobem, descem e retiram, e o seletor das que ainda podem entrar. A ordem é a regra: a primeira
 * área desempata primeiro.
 *
 * Quem altera o critério é o passo: o componente só emite o que o operador pediu, e a área
 * escolhida no seletor e ainda não incluída é do passo, que a remapeia quando a lista muda.
 */
@Component({
  selector: 'sel-ordem-das-areas',
  templateUrl: './ordem-das-areas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdemDasAreasComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  private readonly areas = inject(AreasDoDesempate);

  readonly indice = input.required<number>();
  readonly criterio = input.required<CriterioDesempateConfigurado>();
  /** A área escolhida no seletor e ainda não incluída. */
  readonly escolha = input('');

  readonly escolher = output<string>();
  readonly acrescentar = output();
  readonly remover = output<number>();
  readonly mover = output<MovimentoDeArea>();

  /** O seletor só existe com o quadro lido: sem ele não há área a oferecer. */
  protected readonly lido = computed(() => this.areas.situacaoDoQuadro().tipo === 'lido');
  protected readonly areasOferecidas = this.areas.areasOferecidas;
  protected readonly dicaDaOrigem = this.areas.dicaDaOrigem;

  protected rotuloDaArea(codigo: string): string {
    return this.areas.rotuloDaArea(codigo);
  }

  protected semAreaAOferecer(criterio: CriterioDesempateConfigurado): string {
    return this.areas.semAreaAOferecer(criterio);
  }
}
