import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ValorLegivelDirective } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { QuadroDeVagasService } from '../servicos/quadro-de-vagas.service';

/** A escolha das ofertas de curso que entram no quadro, com filtro e marcação em bloco. */
@Component({
  selector: 'details[selOfertaParaAdicionar]',
  imports: [ValorLegivelDirective, FormsModule],
  templateUrl: './oferta-para-adicionar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfertaParaAdicionarComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly quadro = inject(QuadroDeVagasService);
}
