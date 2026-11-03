import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { QuadroDeVagasService } from '../servicos/quadro-de-vagas.service';

/** O aviso das ofertas gravadas com padrão diferente do que está em tela, e a saída para igualá-las. */
@Component({
  selector: 'div[selOfertasForaDoPadrao]',
  templateUrl: './ofertas-fora-do-padrao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfertasForaDoPadraoComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly quadro = inject(QuadroDeVagasService);
}
