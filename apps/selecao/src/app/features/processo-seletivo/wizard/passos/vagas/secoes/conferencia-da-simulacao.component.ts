import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { CatalogosDeDistribuicao } from '../catalogos-de-distribuicao.service';
import { frase } from '../conferencia-das-vagas';
import { SimulacaoDoQuadro } from '../servicos/simulacao-do-quadro.service';

/**
 * O que a simulação informa do quadro além das quantidades: a reserva legal acima do percentual
 * declarado, as vagas cortadas por escassez e o que o ajuste retirou do quadro fixado no edital.
 * Cada bloco aparece só quando o servidor o trouxe.
 */
@Component({
  selector: 'sel-conferencia-da-simulacao',
  templateUrl: './conferencia-da-simulacao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConferenciaDaSimulacaoComponent {
  protected readonly catalogos = inject(CatalogosDeDistribuicao);
  protected readonly simulacao = inject(SimulacaoDoQuadro);

  protected resumoDaReserva(ofertas: number): string {
    return `${quantasOfertas(ofertas)} com a reserva legal acima do percentual declarado`;
  }

  protected resumoDaEscassez(ofertas: number): string {
    return `${quantasOfertas(ofertas)} com vagas cortadas por escassez`;
  }

  protected resumoDoAjuste(ofertas: number): string {
    return `${quantasOfertas(ofertas)} com vagas retiradas pelo ajuste do quadro`;
  }

  protected vagasCortadas(quantidade: number): string {
    return `${quantidade} ${quantidade === 1 ? 'vaga cortada' : 'vagas cortadas'} por escassez`;
  }

  protected vagasRetiradas(quantidade: number): string {
    return `${quantidade} ${quantidade === 1 ? 'vaga retirada' : 'vagas retiradas'}`;
  }

  protected retiradasPorModalidade(
    retiradas: readonly { readonly modalidadeCodigo: string; readonly quantidade: number }[],
  ): string {
    return retiradas.map((item) => `${item.modalidadeCodigo}: ${item.quantidade}`).join('; ');
  }
}

function quantasOfertas(quantas: number): string {
  return `${frase(quantas)} ${quantas === 1 ? 'ficou' : 'ficaram'}`;
}
