import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { isApiOk, ProblemI18nService } from '@uniplus/shared-core/http';
import { ConfiguracaoDistribuicaoVagasDto, VagasDoProcessoApi } from '@uniplus/shared-data/selecao';
import { Subscription } from 'rxjs';

import { DistribuicaoDeVagas } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { frase } from '../conferencia-das-vagas';
import { comoComando } from '../distribuicao-para-comando';
import { totalCalculadoDe, totalDeclaradoDe, totalDeVagasInformadas } from '../totais-do-quadro';
import { PadraoDoEditalService } from './padrao-do-edital.service';

/** O quadro como a regra o calcula, por oferta, e o que a tela conclui dele. */
@Injectable()
export class SimulacaoDoQuadroService {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly padrao = inject(PadraoDoEditalService);
  private readonly vagasApi = inject(VagasDoProcessoApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);

  /** Quadro como a regra o calcula, por oferta. Vazio até simular. */
  readonly simulacao = signal<ReadonlyMap<string, ConfiguracaoDistribuicaoVagasDto>>(new Map());

  /**
   * Requisição de simulação em curso, para poder abandoná-la.
   *
   * O indicador deriva daqui em vez de ser ligado e desligado à mão: uma resposta que já não vale
   * desligaria o indicador de outra que acabou de começar, e uma que nunca chega deixaria o botão
   * preso para sempre.
   */
  private readonly simulacaoEmVoo = signal<Subscription | null>(null);

  readonly simulando = computed(() => this.simulacaoEmVoo() !== null);
  readonly erroDaSimulacao = signal<string | null>(null);

  /** Avança a cada edição; identifica o quadro que originou uma simulação. */
  private versaoDoQuadro = 0;

  /**
   * A simulação cobre todas as ofertas do quadro. O que a regra calcula só existe depois dela, e é
   * a maior parte do que será publicado: gravar sem simular é declarar um quadro que ninguém viu.
   * Uma edição descarta o resultado, então a conferência é sempre sobre o que está em tela.
   */
  readonly simulacaoCobreOQuadro = computed(() => {
    const calculado = this.simulacao();
    return this.padrao.distribuicoes().every((item) => calculado.has(item.ofertaCursoId));
  });

  /** Soma dos totais que as ofertas informam. */
  readonly totalGeralDeVagas = computed(() => totalDeVagasInformadas(this.padrao.distribuicoes()));

  /**
   * Vagas que o processo publica somando as ofertas. Vem do cálculo do servidor, que sabe o que
   * cada ramo faz com a suplementar: sob a Lei 12.711 ela acresce ao total da oferta, e é aqui que
   * a diferença para o total informado aparece.
   */
  readonly totalGeralPublicado = computed(() =>
    this.padrao
      .distribuicoes()
      .reduce((soma, item) => soma + (this.calculado(item)?.totalPublicado ?? 0), 0),
  );

  /**
   * Ofertas em que a reserva final ficou acima do percentual declarado. O art. 10 §2º garante ao
   * menos uma vaga a cada sub-reserva que ficaria zerada, e isso eleva a reserva além de `VO × PR`.
   */
  readonly ofertasComEstouro = computed(() =>
    this.padrao
      .distribuicoes()
      .map((distribuicao) => ({ distribuicao, calculado: this.calculado(distribuicao) }))
      .filter(({ calculado }) => (calculado?.estouro ?? 0) > 0),
  );

  /** O que o resumo do alerta diz enquanto ele está retraído. */
  readonly resumoDoEstouro = computed(() => {
    const quantas = this.ofertasComEstouro().length;
    const verbo = quantas === 1 ? 'ficou' : 'ficaram';
    return `${frase(quantas)} ${verbo} com a reserva acima do percentual declarado`;
  });

  constructor() {
    // A rota é reusada entre processos e `store.reset()` não alcança signal de serviço. A
    // simulação antiga valeria como cobertura do processo seguinte, porque a checagem é por id de
    // oferta e dois processos do mesmo catálogo compartilham as ofertas.
    effect(() => {
      this.store.geracao();
      untracked(() => {
        this.descartar();
        this.erroDaSimulacao.set(null);
      });
    });
  }

  /**
   * Pede ao servidor o quadro calculado. É ele quem aplica a Lei: arredondar as sub-reservas e
   * descontar as retiradas da ampla concorrência aqui seria manter duas implementações da mesma norma.
   */
  simular(): void {
    const processoId = this.store.processoSeletivoId();
    const distribuicoes = this.padrao.distribuicoes();
    if (processoId === null || distribuicoes.length === 0) return;

    const quadroPedido = this.versaoDoQuadro;
    const geracao = this.store.geracao();
    this.abandonarEmVoo();
    this.erroDaSimulacao.set(null);

    const inscricao = this.vagasApi
      .simularDistribuicaoVagas(processoId, distribuicoes.map(comoComando))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          if (this.respostaVencida(quadroPedido, geracao)) return;
          this.simulacaoEmVoo.set(null);

          if (!isApiOk(resultado)) {
            this.erroDaSimulacao.set(this.problemI18n.resolve(resultado.problem).title);
            return;
          }
          this.simulacao.set(
            new Map(resultado.data.map((item) => [item.ofertaCursoOrigemId, item])),
          );
        },
        error: () => {
          if (this.respostaVencida(quadroPedido, geracao)) return;
          this.simulacaoEmVoo.set(null);

          this.erroDaSimulacao.set('Não foi possível simular o quadro. Tente novamente.');
        },
      });

    this.simulacaoEmVoo.set(inscricao);
  }

  /** Uma edição depois da simulação torna o resultado obsoleto. */
  descartar(): void {
    this.versaoDoQuadro += 1;
    // O quadro mudou: a resposta a caminho descreve outro. Abandoná-la libera o botão de simular
    // em vez de esperar por um resultado que será ignorado.
    this.abandonarEmVoo();
    if (this.simulacao().size > 0) this.simulacao.set(new Map());
  }

  calculado(distribuicao: DistribuicaoDeVagas): ConfiguracaoDistribuicaoVagasDto | undefined {
    return this.simulacao().get(distribuicao.ofertaCursoId);
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
    return totalDeclaradoDe(this.padrao.distribuicoes(), modalidadeId);
  }

  /** Soma da coluna de uma modalidade que a regra calcula. */
  totalCalculadoDe(modalidadeId: string): number {
    return totalCalculadoDe(this.padrao.distribuicoes(), modalidadeId, (distribuicao, id) =>
      this.quantidadeCalculada(distribuicao, id),
    );
  }

  private abandonarEmVoo(): void {
    this.simulacaoEmVoo()?.unsubscribe();
    this.simulacaoEmVoo.set(null);
  }

  /**
   * A resposta descreve um quadro que já não está em tela: o operador editou enquanto ela vinha,
   * ou passou a outro processo. Instalá-la seria pior do que perdê-la, porque a conferência olha
   * só se cada oferta tem resultado, e o cálculo antigo passaria por atual.
   */
  private respostaVencida(quadroPedido: number, geracao: number): boolean {
    return quadroPedido !== this.versaoDoQuadro || geracao !== this.store.geracao();
  }
}
