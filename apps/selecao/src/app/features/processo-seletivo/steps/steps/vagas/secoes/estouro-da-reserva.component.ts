import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { CatalogosDeDistribuicao } from '../catalogos-de-distribuicao.service';
import { SimulacaoDoQuadro } from '../servicos/simulacao-do-quadro.service';

/** As ofertas em que a reserva final passou do percentual declarado, e por quê. */
@Component({
  selector: 'sel-estouro-da-reserva',
  templateUrl: './estouro-da-reserva.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstouroDaReservaComponent {
  protected readonly catalogos = inject(CatalogosDeDistribuicao);
  protected readonly simulacao = inject(SimulacaoDoQuadro);
}
