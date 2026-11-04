import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { EstadoDoPassoDeVagas } from '../servicos/estado-do-passo-de-vagas';

/** O aviso das ofertas gravadas com padrão diferente do que está em tela, e a saída para igualá-las. */
@Component({
  selector: 'sel-ofertas-fora-do-padrao',
  templateUrl: './ofertas-fora-do-padrao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfertasForaDoPadraoComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly estado = inject(EstadoDoPassoDeVagas);

  /** Reescreve todas as ofertas com o padrão em tela. */
  protected aplicarPadraoATodas(): void {
    this.estado.alterarPadrao({});
  }
}
