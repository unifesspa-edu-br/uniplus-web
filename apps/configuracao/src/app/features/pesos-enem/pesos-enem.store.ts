import {
  DestroyRef,
  ErrorHandler,
  Injectable,
  Signal,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, expand } from 'rxjs';
import {
  ApiResult,
  ProblemDetails,
  ProblemI18nService,
  cursorToString,
  extractNextCursor,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AreaPesoAreaEnemDto,
  PesoAreaEnemDto,
  PesosEnemApi,
  type GrupoAreaEnemDto,
} from '@uniplus/shared-data/configuracao';
import {
  comCodigoAparado,
  comRotuloExibivel,
  temCodigoUtilizavel,
} from '../../shared/codigo-e-rotulo';
import { nullIfBlank } from '../../shared/formulario';
import { CatalogoGruposAreaEnem } from '../../shared/grupos-area-enem';
import { listaDeReferencia, motivoDaFalha } from '../../shared/lista-de-referencia';
import { agruparPorResolucao, resolucoesDaMaisRecente } from './pesos-enem-agrupamento';
import type { ValoresDoGrupoDeEdicao } from './pesos-enem-form';
import { rotuloDaArea } from './pesos-enem-rotulos';

const LISTAGEM_NAO_CARREGADA = 'A lista de pesos do ENEM não foi carregada.';
/** Tamanho de página ao esgotar o cursor (ADR-0015/0026) — ver `carregar()`. */
const PAGE_SIZE = 100;
/** Teto defensivo de páginas seguidas via `Link: rel="next"`: evita loop infinito caso o
 *  backend devolva um cursor que nunca esgota. */
const MAX_PAGINAS = 50;

/**
 * Leitura da tela de pesos do ENEM: as resoluções (todas as páginas, até esgotar o cursor),
 * as áreas e os grupos de área que montam as colunas, as linhas e o cadastro.
 */
@Injectable()
export class PesosEnemStore {
  private readonly api = inject(PesosEnemApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly destroyRef = inject(DestroyRef);
  readonly catalogoGrupos = inject(CatalogoGruposAreaEnem);

  /** As áreas do cadastro, na ordem canônica, vindas da API: a fonte das colunas da tabela e
   *  dos campos dos formulários. Nenhuma lista de áreas é escrita no cliente. */
  readonly listaAreas = listaDeReferencia<AreaPesoAreaEnemDto>(
    () => this.api.listarAreas(),
    this.destroyRef,
    temCodigoUtilizavel,
    comCodigoAparado,
  );
  readonly areas: Signal<readonly AreaPesoAreaEnemDto[]> = computed(() =>
    this.listaAreas.opcoes().map(comRotuloExibivel),
  );
  private readonly motivoFalhaAreas = motivoDaFalha(this.listaAreas);
  readonly mensagemFalhaAreas = computed(
    () => nullIfBlank(this.motivoFalhaAreas()) ?? 'A lista de áreas do ENEM não foi carregada.',
  );
  /** Os grupos de área do ENEM, na ordem da API: a fonte dos grupos do cadastro e da ordem das
   *  linhas de cada resolução. */
  readonly grupos: Signal<readonly GrupoAreaEnemDto[]> = this.catalogoGrupos.opcoes;
  private readonly motivoFalhaGrupos = motivoDaFalha(this.catalogoGrupos);
  readonly mensagemFalhaGrupos = computed(
    () =>
      nullIfBlank(this.motivoFalhaGrupos()) ??
      'A lista de grupos de área do ENEM não foi carregada.',
  );
  /** O cadastro de nova resolução monta um grupo por item da lista de grupos e uma área por
   *  item da lista de áreas: sem as duas, ele não abre. */
  readonly podeCadastrar = computed(() => this.areas().length > 0 && this.grupos().length > 0);

  private readonly linhas = signal<readonly PesoAreaEnemDto[]>([]);
  readonly registros = this.linhas.asReadonly();
  private readonly lendo = signal(false);
  private readonly falha = signal<string | null>(null);
  readonly carregando = this.lendo.asReadonly();
  readonly mensagemDeErro = this.falha.asReadonly();

  private readonly ordemCongelada = signal(false);
  private readonly ordemDaLista = computed<ReadonlyMap<string, number>>(
    () => new Map(this.grupos().map((grupo, indice) => [grupo.codigo, indice])),
  );
  /** Ordem dos grupos, congelada enquanto há edição em linha aberta: a lista que chega no meio
   *  da edição não reordena a leitura das outras resoluções nem deixa a edição numa ordem
   *  diferente da leitura. Ao fechar a edição, a ordem nova vale para todas. */
  private readonly ordemDosGrupos = linkedSignal<
    { readonly ordem: ReadonlyMap<string, number>; readonly congelada: boolean },
    ReadonlyMap<string, number>
  >({
    source: () => ({ ordem: this.ordemDaLista(), congelada: this.ordemCongelada() }),
    computation: (estado, anterior) =>
      estado.congelada && anterior !== undefined ? anterior.value : estado.ordem,
  });

  /** Linhas de cada resolução, na ordem dos grupos da API: a mesma na leitura e na edição. */
  readonly porResolucao = computed(() =>
    agruparPorResolucao(
      this.linhas().map((linha) => ({
        ...linha,
        grupoCurso: this.catalogoGrupos.exibivel(linha.grupoCurso),
      })),
      this.ordemDosGrupos(),
    ),
  );
  readonly resolucoes = computed(() => resolucoesDaMaisRecente(this.porResolucao()));

  /** Sem as áreas não há colunas: a tabela espera por elas. A lista de grupos só ordena as
   *  linhas, que já trazem o rótulo do grupo: a tabela espera por ela na primeira carga, para
   *  não reordenar as linhas na tela, mas não quando falha. Resolvida uma vez nesta tela, a
   *  espera acaba: uma recarga dos grupos depois disso não esconde a tabela, o que desmontaria
   *  a edição em linha aberta com o que o operador já digitou. */
  private readonly gruposResolvidos = signal(false);
  readonly resolucoesExibiveis = computed(() =>
    this.areas().length > 0 && this.gruposResolvidos() ? this.resolucoes() : [],
  );
  /** O que a área da tabela mostra quando não há resolução a exibir. */
  readonly estadoDaTabela = computed<'pronta' | 'carregando' | 'erro' | 'vazia'>(() => {
    if (this.resolucoesExibiveis().length > 0) {
      return 'pronta';
    }
    // A falha da listagem já decide a tela: esperar as referências só manteria o skeleton ao
    // lado do alerta.
    if (this.falha()) {
      return 'erro';
    }
    if (this.lendo() || this.listaAreas.pendente() || this.catalogoGrupos.pendente()) {
      return 'carregando';
    }
    return this.listaAreas.falhou() || this.catalogoGrupos.falhou() ? 'erro' : 'vazia';
  });

  constructor() {
    this.catalogoGrupos.garantirCarregado();
    this.listaAreas.garantirCarregado();
    this.recarregar();
    effect(() => {
      if (this.grupos().length > 0 || !this.catalogoGrupos.pendente()) {
        untracked(() => this.gruposResolvidos.set(true));
      }
    });
  }

  rotuloDaArea(codigo: string): string {
    return rotuloDaArea(this.areas(), codigo);
  }

  tentarCarregarAreas(): void {
    this.listaAreas.tentarDeNovo();
  }

  tentarCarregarGrupos(): void {
    this.catalogoGrupos.tentarDeNovo();
  }

  congelarOrdemDosGrupos(congelar: boolean): void {
    this.ordemCongelada.set(congelar);
  }

  /** Mostra na leitura os valores que a edição em linha já gravou no servidor. */
  aplicarEdicao(gravadas: readonly ValoresDoGrupoDeEdicao[]): void {
    const porId = new Map(gravadas.map((valores) => [valores.id, valores]));
    this.linhas.update((atual) =>
      atual.map((linha) => {
        const nova = porId.get(linha.id);
        return nova === undefined
          ? linha
          : {
              ...linha,
              areas: nova.areas.map((area) => ({
                codigo: area.codigo,
                rotulo: this.rotuloDaArea(area.codigo),
                peso: area.peso,
                corte: area.corte,
              })),
              baseLegal: nova.baseLegal,
            };
      }),
    );
  }

  /**
   * Exaustão de cursor (ADR-0015/0026). Na tentativa do operador, o alerta da falha anterior
   * fica na tela até ela terminar, para não sair levando o botão com o foco; na recarga
   * automática ele sai logo, porque a falha é de outro momento.
   */
  recarregar(pedidaPeloOperador = false): void {
    if (this.lendo()) {
      return;
    }
    const falhaRepetida = pedidaPeloOperador && this.falha() !== null;
    this.lendo.set(true);
    if (!falhaRepetida) {
      this.falha.set(null);
    }
    const coleta = { acumulado: [] as PesoAreaEnemDto[], falhou: null as ProblemDetails | null };
    this.listarTodasAsPaginas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (result.ok) {
            coleta.acumulado = [...coleta.acumulado, ...result.data];
          } else {
            coleta.falhou ??= result.problem;
          }
        },
        // Erro fora do envelope ApiResult (ex.: de outro interceptor): também é falha, com
        // alerta e nova tentativa, em vez de deixar a tela carregando.
        error: (erro: unknown) => {
          try {
            this.errorHandler.handleError(erro);
          } finally {
            this.concluir(null, true, []);
          }
        },
        complete: () => this.concluir(coleta.falhou, false, coleta.acumulado),
      });
  }

  private listarTodasAsPaginas() {
    let paginas = 0;
    return this.api.listar({ limit: PAGE_SIZE }).pipe(
      expand((result: ApiResult<readonly PesoAreaEnemDto[]>) => {
        paginas += 1;
        if (!result.ok || paginas >= MAX_PAGINAS) {
          return EMPTY;
        }
        const proximo = extractNextCursor(result.headers.get('Link'));
        return proximo === null
          ? EMPTY
          : this.api.listar({ cursor: cursorToString(proximo), direction: 'next' });
      }),
    );
  }

  private concluir(
    falhou: ProblemDetails | null,
    semResposta: boolean,
    acumulado: readonly PesoAreaEnemDto[],
  ): void {
    this.lendo.set(false);
    if (falhou === null && !semResposta) {
      this.falha.set(null);
      this.linhas.set(acumulado);
      return;
    }
    this.falha.set(
      nullIfBlank(falhou === null ? null : this.problemI18n.resolve(falhou).title) ??
        LISTAGEM_NAO_CARREGADA,
    );
    if (falhou !== null && falhou.status >= 500) {
      this.notifications.errorFromProblem(falhou);
    }
  }
}
