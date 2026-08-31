import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { coletarPaginas, isApiOk } from '@uniplus/shared-core/http';
import {
  FaseCanonicaDto,
  FasesCanonicasApi,
  PrecedenciaFaseDto,
  PrecedenciasFaseApi,
  TipoBancaDto,
  TipoEtapaDto,
  TiposBancaApi,
  TiposEtapaApi,
} from '@uniplus/shared-data/configuracao';
import { TipoAtoPublicadoDto, TiposAtoApi } from '@uniplus/shared-data/publicacoes';
import { RegraCatalogoDto, RegrasCatalogoApi } from '@uniplus/shared-data/selecao';

/** Tipo do `rol_de_regras` que a convenção de contagem referencia. */
const TIPO_REGRA_CONTAGEM = 'algoritmo_contagem_prazo';

/** Tipo do `rol_de_regras` que a regra de recurso de uma fase referencia. */
const TIPO_REGRA_RECURSO = 'regra_prazo_recurso';

/**
 * Catálogos que o cronograma referencia, todos de fora do módulo Seleção: fases
 * canônicas, precedências, tipos de banca e tipos de etapa são cadastro de
 * Configuração, o tipo de ato é de Publicações, e as regras vêm do
 * `rol_de_regras` versionado.
 *
 * Carrega todos por cursor até o fim, porque uma escolha só sabe o que oferecer
 * quando conhece todas as opções — diferente de uma listagem, em que a página é
 * o que o operador navega.
 */
@Injectable()
export class CatalogosDoCronogramaService {
  private readonly fasesApi = inject(FasesCanonicasApi);
  private readonly precedenciasApi = inject(PrecedenciasFaseApi);
  private readonly bancasApi = inject(TiposBancaApi);
  private readonly tiposEtapaApi = inject(TiposEtapaApi);
  private readonly atosApi = inject(TiposAtoApi);
  private readonly regrasApi = inject(RegrasCatalogoApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly fases = signal<readonly FaseCanonicaDto[]>([]);
  readonly precedencias = signal<readonly PrecedenciaFaseDto[]>([]);
  readonly bancas = signal<readonly TipoBancaDto[]>([]);
  readonly tiposEtapa = signal<readonly TipoEtapaDto[]>([]);
  readonly atos = signal<readonly TipoAtoPublicadoDto[]>([]);
  readonly regrasRecurso = signal<readonly RegraCatalogoDto[]>([]);
  readonly regrasContagem = signal<readonly RegraCatalogoDto[]>([]);

  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);

  /** Fase canônica por id — o que a linha do tempo lê para saber o que exigir. */
  readonly fasePorId = computed<ReadonlyMap<string, FaseCanonicaDto>>(
    () => new Map(this.fases().map((fase) => [fase.id, fase])),
  );

  /**
   * Tipos de etapa escolhíveis. O catálogo devolve ativos e inativos juntos, e
   * um inativo não volta a ser opção nova — mas continua exibível quando já
   * referenciado, o que `rotuloDoTipoEtapa` resolve.
   */
  readonly tiposEtapaAtivos = computed(() => this.tiposEtapa().filter((tipo) => tipo.ativo));

  /** Rótulo de um tipo de etapa, ativo ou não — um vínculo gravado precisa de nome. */
  readonly rotuloDoTipoEtapa = computed<ReadonlyMap<string, string>>(
    () => new Map(this.tiposEtapa().map((tipo) => [tipo.id, tipo.nome])),
  );

  /**
   * Fases em ordem cronológica sugerida, derivada das precedências cadastradas.
   *
   * As arestas não formam uma ordem total — há fases que nenhuma aresta alcança
   * —, então a ordenação é topológica sobre o que existe, com o resto mantendo
   * a ordem do catálogo. Serve para sugerir; quem arbitra a ordem declarada é o
   * servidor, que recusa o que viola a precedência.
   */
  readonly fasesEmOrdemSugerida = computed<readonly FaseCanonicaDto[]>(() => {
    const fases = this.fases();
    const posicao = new Map(fases.map((fase, indice) => [fase.codigo, indice]));

    for (const aresta of this.precedencias()) {
      const antes = posicao.get(aresta.antecessoraCodigo);
      const depois = posicao.get(aresta.sucessoraCodigo);
      if (antes === undefined || depois === undefined || antes < depois) continue;
      posicao.set(aresta.sucessoraCodigo, antes + 0.5);
    }

    return [...fases].sort(
      (a, b) => (posicao.get(a.codigo) ?? 0) - (posicao.get(b.codigo) ?? 0),
    );
  });

  carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);

    forkJoin({
      fases: coletarPaginas((cursor) => this.fasesApi.listar({ cursor })),
      precedencias: coletarPaginas((cursor) => this.precedenciasApi.listar({ cursor })),
      bancas: coletarPaginas((cursor) => this.bancasApi.listar({ cursor })),
      tiposEtapa: coletarPaginas((cursor) => this.tiposEtapaApi.listar({ cursor })),
      atos: coletarPaginas((cursor) => this.atosApi.listar({ cursor })),
      recurso: coletarPaginas((cursor) =>
        this.regrasApi.listar({ tipo: TIPO_REGRA_RECURSO, cursor }),
      ),
      contagem: coletarPaginas((cursor) =>
        this.regrasApi.listar({ tipo: TIPO_REGRA_CONTAGEM, cursor }),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultados) => {
          const { fases, precedencias, bancas, tiposEtapa, atos, recurso, contagem } = resultados;

          // Um catálogo faltando deixa a tela oferecendo menos do que existe, e
          // o operador não teria como saber. Ou vêm todos, ou nenhum.
          if (
            !isApiOk(fases) ||
            !isApiOk(precedencias) ||
            !isApiOk(bancas) ||
            !isApiOk(tiposEtapa) ||
            !isApiOk(atos) ||
            !isApiOk(recurso) ||
            !isApiOk(contagem)
          ) {
            this.anunciarErro();
            return;
          }

          this.fases.set(fases.data);
          this.precedencias.set(precedencias.data);
          this.bancas.set(bancas.data);
          this.tiposEtapa.set(tiposEtapa.data);
          this.atos.set(atos.data);
          this.regrasRecurso.set(recurso.data);
          this.regrasContagem.set(contagem.data);
          this.carregando.set(false);
        },
        error: () => this.anunciarErro(),
      });
  }

  private anunciarErro(): void {
    this.erro.set(
      'Não foi possível carregar os catálogos de fases, bancas, atos e regras. Tente novamente.',
    );
    this.carregando.set(false);
  }
}
