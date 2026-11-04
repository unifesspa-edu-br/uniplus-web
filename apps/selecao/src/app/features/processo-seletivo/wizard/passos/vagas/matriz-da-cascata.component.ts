import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { MatrizDaRegra } from './cascata-de-remanejamento';

@Component({
  selector: 'table[selMatrizDaCascata]',
  templateUrl: './matriz-da-cascata.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatrizDaCascataComponent {
  readonly matriz = input.required<MatrizDaRegra>();

  /**
   * Os rótulos ordinais das colunas — "1ª", "2ª", … —, um por posição de preferência. Saem do
   * maior número de destinos entre as origens, e não de uma constante: a matriz é o que a regra do
   * catálogo declara, e outra versão pode declarar outra largura.
   */
  readonly ordinais = computed<readonly string[]>(() => {
    const maior = this.matriz().ordens.reduce(
      (maximo, ordem) => Math.max(maximo, ordem.destinos.length),
      0,
    );
    return Array.from({ length: maior }, (_, indice) => `${indice + 1}ª`);
  });

  /**
   * O destino de uma origem numa posição de preferência, ou o travessão quando aquela origem tem
   * menos destinos que a mais larga da matriz. A checagem é por comprimento, e não por coalescência:
   * o índice de um `readonly string[]` é tipado como `string`, então `??` seria código morto.
   */
  destinoNaPosicao(destinos: readonly string[], posicao: number): string {
    return posicao < destinos.length ? destinos[posicao] : '—';
  }
}
