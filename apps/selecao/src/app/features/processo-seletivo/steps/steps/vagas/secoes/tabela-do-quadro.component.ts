import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ValorLegivelDirective } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CatalogosDeDistribuicaoService } from '../catalogos-de-distribuicao.service';
import { quantidadeInvalida } from '../conferencia-das-vagas';
import { comQuantidade, comVoBase } from '../edicao-do-quadro';
import { ConferenciaDoQuadro } from '../servicos/conferencia-do-quadro.service';
import { EstadoDoPassoDeVagas } from '../servicos/estado-do-passo-de-vagas';
import { SimulacaoDoQuadro } from '../servicos/simulacao-do-quadro.service';
import { quantidadeDoQuadro } from '../totais-do-quadro';

/** O quadro de vagas: uma linha por oferta, uma coluna por modalidade e os totais no rodapé. */
@Component({
  selector: 'sel-tabela-do-quadro',
  imports: [ValorLegivelDirective, FormsModule],
  templateUrl: './tabela-do-quadro.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class TabelaDoQuadroComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly catalogos = inject(CatalogosDeDistribuicaoService);
  protected readonly estado = inject(EstadoDoPassoDeVagas);
  protected readonly conferencia = inject(ConferenciaDoQuadro);
  protected readonly simulacao = inject(SimulacaoDoQuadro);
  protected readonly quantidade = quantidadeDoQuadro;
  protected readonly quantidadeInvalida = quantidadeInvalida;

  protected alterarVoBase(ofertaCursoId: string, voBase: string): void {
    this.estado.substituir(comVoBase(this.estado.distribuicoes(), ofertaCursoId, voBase));
  }

  protected alterarQuantidade(ofertaCursoId: string, modalidadeId: string, valor: string): void {
    this.estado.substituir(
      comQuantidade(this.estado.distribuicoes(), { ofertaCursoId, modalidadeId }, valor),
    );
  }

  protected pedirRemocao(ofertaCursoId: string): void {
    if (!this.store.aceitaEdicao()) return;
    this.estado.remocaoPendente.set(ofertaCursoId);
  }
}
