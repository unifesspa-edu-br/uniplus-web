import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { MatrizDaOrdemDeRemanejamento } from '../../documento/edicoes/ordem-de-remanejamento.edicao';
import { rotuloDaModalidade, type RotulosPorCodigo } from './modalidades-da-distribuicao';

@Component({
  selector: 'table[selMatrizDaCascata]',
  templateUrl: './matriz-da-cascata.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatrizDaCascataComponent {
  readonly matriz = input.required<MatrizDaOrdemDeRemanejamento>();
  /** O texto "código — nome" de cada modalidade; o que o catálogo não conhece aparece pelo código. */
  readonly rotulos = input<RotulosPorCodigo>(new Map());

  protected rotulo(codigo: string): string {
    return rotuloDaModalidade(this.rotulos(), codigo);
  }

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
   * O destino de uma origem numa posição de preferência, separado em código e complemento (o
   * nome), ou nulo quando aquela origem tem menos destinos que a mais larga da matriz. A checagem
   * é por comprimento, e não por coalescência: o índice de um `readonly string[]` é tipado como
   * `string`, então `??` seria código morto. O código vai à parte para a tela não o partir.
   */
  destinoNaPosicao(
    destinos: readonly string[],
    posicao: number,
  ): { readonly codigo: string; readonly complemento: string } | null {
    if (posicao >= destinos.length) return null;
    const codigo = destinos[posicao];
    return { codigo, complemento: this.rotulo(codigo).slice(codigo.length) };
  }
}
