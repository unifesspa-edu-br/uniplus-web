import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import type { ReferenciaDeAtendimento } from '../../processo-seletivo.models';

/**
 * As referências da oferta que o cadastro ativo já não tem, cada uma com a situação e o botão que
 * a retira da oferta. Botão, não caixa de seleção: a retirada é definitiva, pois o item saiu do
 * cadastro e não há como marcá-lo de novo por esta tela. Os itens entram na grade de escolhas da
 * seção, por isso o elemento não gera caixa própria.
 */
@Component({
  selector: 'sel-referencias-removidas',
  templateUrl: './referencias-removidas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: contents; }',
})
export class ReferenciasRemovidasComponent {
  readonly itens = input.required<readonly ReferenciaDeAtendimento[]>();
  /** Prefixo do id de cada botão; é por ele que o foco volta à lista depois da retirada. */
  readonly prefixoDoId = input.required<string>();
  readonly situacao = input.required<string>();
  readonly desabilitado = input.required<boolean>();

  readonly retirar = output<string>();
}
