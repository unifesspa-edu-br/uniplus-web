import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { QuadroDeVagasService } from '../servicos/quadro-de-vagas.service';
import { SimulacaoDoQuadroService } from '../servicos/simulacao-do-quadro.service';

/** As ofertas em que a reserva final passou do percentual declarado, e por quê. */
@Component({
  selector: 'div[selEstouroDaReserva]',
  templateUrl: './estouro-da-reserva.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstouroDaReservaComponent {
  protected readonly quadro = inject(QuadroDeVagasService);
  protected readonly simulacao = inject(SimulacaoDoQuadroService);
}
