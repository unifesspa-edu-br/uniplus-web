import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ValorLegivelDirective } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { quantidadeInvalida } from '../conferencia-das-vagas';
import { PadraoDoEditalService } from '../servicos/padrao-do-edital.service';
import { QuadroDeVagasService } from '../servicos/quadro-de-vagas.service';
import { SimulacaoDoQuadroService } from '../servicos/simulacao-do-quadro.service';
import { quantidadeDoQuadro } from '../totais-do-quadro';

/** O quadro de vagas: uma linha por oferta, uma coluna por modalidade e os totais no rodapé. */
@Component({
  selector: 'div[selTabelaDoQuadro]',
  imports: [ValorLegivelDirective, FormsModule],
  templateUrl: './tabela-do-quadro.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabelaDoQuadroComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly padraoDoEdital = inject(PadraoDoEditalService);
  protected readonly quadro = inject(QuadroDeVagasService);
  protected readonly simulacao = inject(SimulacaoDoQuadroService);
  protected readonly quantidade = quantidadeDoQuadro;
  protected readonly quantidadeInvalida = quantidadeInvalida;
}
