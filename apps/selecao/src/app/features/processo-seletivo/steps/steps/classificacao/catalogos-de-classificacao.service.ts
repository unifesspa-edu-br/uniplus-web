import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, catchError, finalize, forkJoin, of } from 'rxjs';
import { coletarPaginas, isApiOk } from '@uniplus/shared-core/http';
import {
  AreaPesoAreaEnemDto,
  PesoAreaEnemDto,
  PesosEnemApi,
} from '@uniplus/shared-data/configuracao';
import { RegraCatalogoDto, RegrasCatalogoApi } from '@uniplus/shared-data/selecao';

const TIPO_REGRA_CALCULO = 'regra_calculo';
const TIPO_REGRA_ARREDONDAMENTO = 'regra_arredondamento';
const TIPO_REGRA_ORDEM_ALOCACAO = 'regra_ordem_alocacao';
const TIPO_REGRA_ELIMINACAO = 'regra_eliminacao';
const TIPO_REGRA_BONUS = 'regra_bonus';
const TIPO_CRITERIO_DESEMPATE = 'criterio_desempate';

const COMPARADOR_DE_RESOLUCAO = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

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
 *
 * Também guarda o cadastro de Peso por Área, de onde a Fórmula tira a resolução do ENEM e a
 * Eliminação confere, antes de gravar, se a resolução escolhida ainda existe. Esse cadastro só é
 * baixado quando a classificação passa a exigir a resolução, e cada leitura leva a `marca` de
 * quem a pediu — a versão da classificação lida do processo. Quem julga pelo cadastro compara a
 * marca com a versão atual; as linhas de uma marca anterior só servem de prévia. A lista canônica
 * das áreas é estática: lida uma vez, quando dá certo.
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

  /** As linhas vivas do cadastro de Peso por Área — uma por resolução e grupo de área. */
  readonly pesosAreaEnem = signal<readonly PesoAreaEnemDto[]>([]);
  /** As áreas do ENEM na ordem canônica do cadastro — a ordem das colunas de qualquer quadro. */
  readonly areasEnem = signal<readonly AreaPesoAreaEnemDto[]>([]);
  readonly pesosCarregando = signal(false);
  /** A marca da última leitura que deu certo, ou `-1` sem leitura para o processo atual. */
  readonly pesosLidosNaMarca = signal(-1);
  /**
   * Cada leitura é numerada quando é pedida: uma leitura é posterior a um fato quando foi pedida
   * depois dele, e não quando a resposta chega depois. `pesosLeituraPedida` é o número da última
   * pedida; `pesosLidosNaLeitura`, o da última que deu certo.
   */
  readonly pesosLeituraPedida = signal(0);
  readonly pesosLidosNaLeitura = signal(0);
  private readonly pesosFalhas = signal(0);

  /**
   * O aviso da falha. A partir da segunda falha seguida o texto muda a cada tentativa: um alerta
   * que volta idêntico não é anunciado de novo pelo leitor de tela, e quem acionou "Tentar
   * novamente" ficaria sem saber que falhou outra vez.
   */
  readonly pesosErro = computed(() => {
    const falhas = this.pesosFalhas();
    if (falhas === 0) return null;
    const tentativa = falhas > 1 ? ` (${falhas}ª tentativa)` : '';
    return `Não foi possível carregar o cadastro de Peso por Área${tentativa}. Tente novamente.`;
  });

  /**
   * As resoluções do cadastro, cada uma uma vez — o que o processo escolhe é a resolução inteira.
   */
  readonly resolucoesPesoAreaEnem = computed(() => {
    const unicas = new Set(this.pesosAreaEnem().map((linha) => linha.resolucao));
    return [...unicas].sort((a, b) => COMPARADOR_DE_RESOLUCAO.compare(a, b));
  });

  private readonly pesosApi = inject(PesosEnemApi);
  private marcaPedida = -1;
  private leituraDosPesos: Subscription | null = null;
  private readonly aoLerPendentes: (() => void)[] = [];
  private areasLidas = false;
  private areasBuscando = false;

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

  /** Lê o cadastro para a `marca` informada, se nenhuma leitura dela, ou posterior, já foi pedida. */
  garantirPesosAreaEnem(marca: number): void {
    if (this.marcaPedida >= marca) return;
    this.buscarPesosAreaEnem(marca);
  }

  /**
   * O editor passou a tratar de outro processo: a lista, as falhas, a leitura em curso e as marcas
   * eram do anterior e não servem de prova nem de aviso para este.
   */
  esquecerPesosAreaEnem(): void {
    this.leituraDosPesos?.unsubscribe();
    this.leituraDosPesos = null;
    this.marcaPedida = -1;
    this.aoLerPendentes.length = 0;
    this.pesosAreaEnem.set([]);
    this.pesosLidosNaMarca.set(-1);
    this.pesosFalhas.set(0);
    this.pesosCarregando.set(false);
  }

  /**
   * Lê o cadastro de novo — depois de uma falha, ou porque o operador mudou o cadastro em outra
   * aba. Não reinicia uma leitura que ainda corre. `aoLer` só roda quando a leitura dá certo.
   */
  recarregarPesosAreaEnem(marca: number, aoLer?: () => void): void {
    if (this.pesosCarregando()) return;
    this.buscarPesosAreaEnem(marca, aoLer);
  }

  /**
   * Só a lista canônica das áreas — para quem mostra a cópia congelada sem precisar do cadastro.
   */
  garantirAreasEnem(): void {
    if (this.areasLidas || this.areasBuscando) return;
    this.areasBuscando = true;
    this.pesosApi
      .listarAreas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (areas) => {
          this.areasBuscando = false;
          if (isApiOk(areas)) this.guardarAreas(areas.data);
        },
        error: () => (this.areasBuscando = false),
      });
  }

  /**
   * Uma leitura nova substitui a que estiver em curso: a resposta da substituída não chega. Quem
   * esperava a substituída (`aoLer`) passa a esperar a nova, que também relê o cadastro.
   *
   * A lista canônica das áreas só ordena as colunas: se ela falhar, a leitura do cadastro vale do
   * mesmo jeito, as colunas ficam na ordem de chegada, e a lista é pedida de novo na próxima.
   */
  private buscarPesosAreaEnem(marca: number, aoLer?: () => void): void {
    this.marcaPedida = Math.max(this.marcaPedida, marca);
    const numero = this.pesosLeituraPedida() + 1;
    this.pesosLeituraPedida.set(numero);
    this.pesosCarregando.set(true);
    if (aoLer) this.aoLerPendentes.push(aoLer);

    this.leituraDosPesos?.unsubscribe();
    const pedeAreas = !this.areasLidas && !this.areasBuscando;
    let leuAsLinhas = false;
    if (pedeAreas) this.areasBuscando = true;
    this.leituraDosPesos = forkJoin({
      linhas: coletarPaginas((cursor) => this.pesosApi.listar({ cursor, direction: 'next' })),
      areas: pedeAreas ? this.pesosApi.listarAreas().pipe(catchError(() => of(null))) : of(null),
    })
      .pipe(
        // Também quando uma leitura nova substitui esta: a lista pedida aqui não chega mais.
        finalize(() => {
          if (pedeAreas) this.areasBuscando = false;
          // A lista que a leitura não trouxe — pedida por ela e recusada, ou pedida à parte e
          // recusada enquanto ela corria — é pedida de novo, com a guarda já liberada.
          if (leuAsLinhas && !this.areasLidas) this.garantirAreasEnem();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ linhas, areas }) => {
          // A lista das áreas vale por si: a falha das linhas não a descarta.
          if (areas !== null && isApiOk(areas)) this.guardarAreas(areas.data);
          if (!isApiOk(linhas)) {
            this.anunciarFalhaDosPesos();
            return;
          }
          this.pesosAreaEnem.set(linhas.data);
          this.pesosLidosNaMarca.set(marca);
          this.pesosLidosNaLeitura.set(numero);
          this.pesosFalhas.set(0);
          this.pesosCarregando.set(false);
          leuAsLinhas = true;
          const pendentes = this.aoLerPendentes.splice(0);
          pendentes.forEach((depoisDeLer) => depoisDeLer());
        },
        // O erro que escapa do envelope `ApiResult` também encerra a leitura; sem isto o seletor
        // ficaria desabilitado para sempre.
        error: () => this.anunciarFalhaDosPesos(),
      });
  }

  private guardarAreas(areas: readonly AreaPesoAreaEnemDto[]): void {
    this.areasEnem.set(areas);
    this.areasLidas = true;
  }

  private anunciarFalhaDosPesos(): void {
    this.aoLerPendentes.length = 0;
    this.pesosFalhas.update((falhas) => falhas + 1);
    this.pesosCarregando.set(false);
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
