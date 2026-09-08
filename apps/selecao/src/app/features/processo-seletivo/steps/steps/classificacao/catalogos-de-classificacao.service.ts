import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { coletarPaginas, isApiOk } from '@uniplus/shared-core/http';
import { RegraCatalogoDto, RegrasCatalogoApi } from '@uniplus/shared-data/selecao';

const TIPO_REGRA_CALCULO = 'regra_calculo';
const TIPO_REGRA_ARREDONDAMENTO = 'regra_arredondamento';
const TIPO_REGRA_ORDEM_ALOCACAO = 'regra_ordem_alocacao';
const TIPO_REGRA_ELIMINACAO = 'regra_eliminacao';
const TIPO_REGRA_BONUS = 'regra_bonus';
const TIPO_CRITERIO_DESEMPATE = 'criterio_desempate';

/**
 * Catálogos que os passos de Fórmula, Eliminação, Bônus e Desempate
 * referenciam — as seis dimensões de regra que compõem a classificação do
 * processo (UNI-REQ-0482). Todas do mesmo `rol_de_regras` versionado que o
 * Cronograma já consulta para o algoritmo de contagem, então o formato de
 * carregamento é o mesmo: por cursor até o fim, porque um seletor só sabe o
 * que oferecer quando conhece todas as opções.
 *
 * Vive na página do wizard, não num passo: os quatro passos leem os mesmos
 * catálogos, e uma instância por passo os baixaria quatro vezes para
 * responder a mesma coisa.
 */
@Injectable()
export class CatalogosDeClassificacaoService {
  private readonly regrasApi = inject(RegrasCatalogoApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly regrasCalculo = signal<readonly RegraCatalogoDto[]>([]);
  readonly regrasArredondamento = signal<readonly RegraCatalogoDto[]>([]);
  readonly regrasOrdemAlocacao = signal<readonly RegraCatalogoDto[]>([]);
  readonly regrasEliminacao = signal<readonly RegraCatalogoDto[]>([]);
  readonly regrasBonus = signal<readonly RegraCatalogoDto[]>([]);
  readonly criteriosDesempate = signal<readonly RegraCatalogoDto[]>([]);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);

  /**
   * Já buscou, ou está buscando. Fórmula, Eliminação, Bônus e Desempate pedem
   * o carregamento ao nascer; sem a guarda, cada abertura do editor faria a
   * mesma rodada de requisições quatro vezes.
   */
  private buscaIniciada = false;

  carregar(): void {
    if (this.buscaIniciada) return;
    this.buscaIniciada = true;
    this.carregando.set(true);
    this.erro.set(null);

    forkJoin({
      calculo: coletarPaginas((cursor) =>
        this.regrasApi.listar({ tipo: TIPO_REGRA_CALCULO, cursor }),
      ),
      arredondamento: coletarPaginas((cursor) =>
        this.regrasApi.listar({ tipo: TIPO_REGRA_ARREDONDAMENTO, cursor }),
      ),
      ordemAlocacao: coletarPaginas((cursor) =>
        this.regrasApi.listar({ tipo: TIPO_REGRA_ORDEM_ALOCACAO, cursor }),
      ),
      eliminacao: coletarPaginas((cursor) =>
        this.regrasApi.listar({ tipo: TIPO_REGRA_ELIMINACAO, cursor }),
      ),
      bonus: coletarPaginas((cursor) => this.regrasApi.listar({ tipo: TIPO_REGRA_BONUS, cursor })),
      desempate: coletarPaginas((cursor) =>
        this.regrasApi.listar({ tipo: TIPO_CRITERIO_DESEMPATE, cursor }),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultados) => {
          const { calculo, arredondamento, ordemAlocacao, eliminacao, bonus, desempate } =
            resultados;

          // Um catálogo faltando deixa a tela oferecendo menos do que existe, e
          // o operador não teria como saber. Ou vêm todos, ou nenhum.
          if (
            !isApiOk(calculo) ||
            !isApiOk(arredondamento) ||
            !isApiOk(ordemAlocacao) ||
            !isApiOk(eliminacao) ||
            !isApiOk(bonus) ||
            !isApiOk(desempate)
          ) {
            this.anunciarErro();
            return;
          }

          this.regrasCalculo.set(calculo.data);
          this.regrasArredondamento.set(arredondamento.data);
          this.regrasOrdemAlocacao.set(ordemAlocacao.data);
          this.regrasEliminacao.set(eliminacao.data);
          this.regrasBonus.set(bonus.data);
          this.criteriosDesempate.set(desempate.data);
          this.carregando.set(false);
        },
        error: () => this.anunciarErro(),
      });
  }

  private anunciarErro(): void {
    // Libera a guarda: o que impediu a rodada anterior pode ter passado, e a
    // tela precisa de um caminho de volta que não seja recarregar a página.
    this.buscaIniciada = false;
    this.erro.set(
      'Não foi possível carregar os catálogos de regras de classificação, bônus e desempate. Tente novamente.',
    );
    this.carregando.set(false);
  }
}
