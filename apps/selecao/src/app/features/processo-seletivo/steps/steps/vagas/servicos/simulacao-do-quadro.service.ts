import { computed, DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type ApiResult, isApiOk, ProblemI18nService } from '@uniplus/shared-core/http';
import { ConfiguracaoDistribuicaoVagasDto, VagasDoProcessoApi } from '@uniplus/shared-data/selecao';

import { DistribuicaoDeVagas } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { frase } from '../conferencia-das-vagas';
import { comoComando } from '../distribuicao-para-comando';
import { totalCalculadoDe, totalDeclaradoDe, totalDeVagasInformadas } from '../totais-do-quadro';
import { EstadoDoPassoDeVagas } from './estado-do-passo-de-vagas';

/**
 * A simulação do quadro no servidor e o que a tela conclui dela. É o servidor quem aplica a Lei:
 * arredondar as sub-reservas e descontar as retiradas da ampla concorrência aqui seria manter duas
 * implementações da mesma norma.
 */
@Injectable()
export class SimulacaoDoQuadroService {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly estado = inject(EstadoDoPassoDeVagas);
  private readonly vagasApi = inject(VagasDoProcessoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);

  /** O indicador deriva da requisição em curso: uma resposta que já não vale não o desliga por engano. */
  readonly simulando = computed(() => this.estado.simulacaoEmVoo() !== null);

  /** Soma dos totais que as ofertas informam. */
  readonly totalGeralDeVagas = computed(() => totalDeVagasInformadas(this.estado.distribuicoes()));

  /**
   * Vagas que o processo publica somando as ofertas. Vem do cálculo do servidor, que sabe o que
   * cada ramo faz com a suplementar: sob a Lei 12.711 ela acresce ao total da oferta.
   */
  readonly totalGeralPublicado = computed(() =>
    this.estado
      .distribuicoes()
      .reduce((soma, item) => soma + (this.calculado(item)?.totalPublicado ?? 0), 0),
  );

  /**
   * Ofertas em que a reserva final ficou acima do percentual declarado: o art. 10 §2º garante ao
   * menos uma vaga a cada sub-reserva que ficaria zerada, e isso eleva a reserva além de `VO × PR`.
   */
  readonly ofertasComEstouro = computed(() =>
    this.estado
      .distribuicoes()
      .map((distribuicao) => ({ distribuicao, calculado: this.calculado(distribuicao) }))
      .filter(({ calculado }) => (calculado?.estouro ?? 0) > 0),
  );

  readonly resumoDoEstouro = computed(() => {
    const quantas = this.ofertasComEstouro().length;
    const verbo = quantas === 1 ? 'ficou' : 'ficaram';
    return `${frase(quantas)} ${verbo} com a reserva acima do percentual declarado`;
  });

  simular(): void {
    const processoId = this.store.processoSeletivoId();
    const distribuicoes = this.estado.distribuicoes();
    if (processoId === null || distribuicoes.length === 0) return;

    const pedido = { quadro: this.estado.versaoDoQuadro(), geracao: this.store.geracao() };
    this.estado.abandonarSimulacaoEmVoo();
    this.estado.erroDaSimulacao.set(null);

    const inscricao = this.vagasApi
      .simularDistribuicaoVagas(processoId, distribuicoes.map(comoComando))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => this.receber(pedido, resultado),
        error: () => this.falhar(pedido),
      });

    this.estado.simulacaoEmVoo.set(inscricao);
  }

  calculado(distribuicao: DistribuicaoDeVagas): ConfiguracaoDistribuicaoVagasDto | undefined {
    return this.estado.simulacao().get(distribuicao.ofertaCursoId);
  }

  /** Quantidade que a regra atribuiu a uma modalidade nesta oferta. */
  quantidadeCalculada(distribuicao: DistribuicaoDeVagas, modalidadeId: string): string {
    const vaga = this.calculado(distribuicao)?.quadro.find(
      (item) => item.modalidadeOrigemId === modalidadeId,
    );
    return vaga === undefined ? '—' : String(vaga.quantidade);
  }

  /** Soma da coluna de uma modalidade que o edital declara. */
  totalDeclaradoDe(modalidadeId: string): number {
    return totalDeclaradoDe(this.estado.distribuicoes(), modalidadeId);
  }

  /** Soma da coluna de uma modalidade que a regra calcula. */
  totalCalculadoDe(modalidadeId: string): number {
    return totalCalculadoDe(this.estado.distribuicoes(), modalidadeId, (distribuicao, id) =>
      this.quantidadeCalculada(distribuicao, id),
    );
  }

  private receber(
    pedido: PedidoDeSimulacao,
    resultado: ApiResult<readonly ConfiguracaoDistribuicaoVagasDto[]>,
  ): void {
    if (this.respostaVencida(pedido)) return;
    this.estado.simulacaoEmVoo.set(null);

    if (!isApiOk(resultado)) {
      this.estado.erroDaSimulacao.set(this.problemI18n.resolve(resultado.problem).title);
      return;
    }
    this.estado.simulacao.set(
      new Map(resultado.data.map((item) => [item.ofertaCursoOrigemId, item])),
    );
  }

  private falhar(pedido: PedidoDeSimulacao): void {
    if (this.respostaVencida(pedido)) return;
    this.estado.simulacaoEmVoo.set(null);
    this.estado.erroDaSimulacao.set('Não foi possível simular o quadro. Tente novamente.');
  }

  /**
   * A resposta descreve um quadro que já não está em tela: o operador editou enquanto ela vinha,
   * ou passou a outro processo. Instalá-la seria pior do que perdê-la, porque a conferência olha
   * só se cada oferta tem resultado, e o cálculo antigo passaria por atual.
   */
  private respostaVencida(pedido: PedidoDeSimulacao): boolean {
    return (
      pedido.quadro !== this.estado.versaoDoQuadro() || pedido.geracao !== this.store.geracao()
    );
  }
}

interface PedidoDeSimulacao {
  readonly quadro: number;
  readonly geracao: number;
}
