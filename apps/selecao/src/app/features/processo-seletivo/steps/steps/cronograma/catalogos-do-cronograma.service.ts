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

import { hojeNoFusoInstitucional } from '../../shared/fuso-institucional';

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
   * Atos que podem ser escolhidos hoje. A vigência é semiaberta — `[início,
   * fim)` —, e é ela que o servidor confere ao resolver o ato declarado: um
   * código fora de vigência é recusado na gravação.
   *
   * "Hoje" é o dia no fuso institucional, não em UTC: à noite em Belém a data
   * UTC já é a de amanhã, e conferir por ela ofereceria um ato horas antes de
   * ele valer — para o servidor recusá-lo em seguida.
   */
  readonly atosVigentes = computed(() => {
    const hoje = hojeNoFusoInstitucional();
    return this.atos().filter(
      (ato) => ato.vigenciaInicio <= hoje && (ato.vigenciaFim === null || hoje < ato.vigenciaFim),
    );
  });

  /** Rótulo de um ato, vigente ou não — um cronograma gravado precisa de nome. */
  readonly rotuloDoAto = computed<ReadonlyMap<string, string>>(
    () => new Map(this.atos().map((ato) => [ato.codigo, ato.nome])),
  );

  /**
   * Fases em ordem cronológica sugerida, derivada das precedências cadastradas.
   *
   * Ordenação topológica de Kahn sobre as arestas que ligam fases do catálogo,
   * com a ordem do próprio catálogo como desempate — assim o resultado é
   * estável, e não depende da ordem em que as arestas chegaram. Um passe único
   * de ajuste não bastaria: com o catálogo em `B, C, A` e as arestas `B→C` e
   * `A→B`, mover `B` para depois de `A` deixaria `C` antes de `B`, violando a
   * primeira aresta e sugerindo uma ordem que o servidor recusa.
   *
   * Fases que nenhuma aresta alcança entram na ordem do catálogo, e um ciclo no
   * cadastro — que não deveria existir — degrada para essa mesma ordem em vez de
   * perder fase. Isto sugere; quem arbitra continua sendo o servidor.
   */
  readonly fasesEmOrdemSugerida = computed<readonly FaseCanonicaDto[]>(() => {
    const fases = this.fases();
    const porCodigo = new Map(fases.map((fase) => [fase.codigo, fase]));

    const sucessores = new Map<string, string[]>();
    const grauDeEntrada = new Map<string, number>(fases.map((fase) => [fase.codigo, 0]));

    for (const aresta of this.precedencias()) {
      if (!porCodigo.has(aresta.antecessoraCodigo) || !porCodigo.has(aresta.sucessoraCodigo)) {
        continue;
      }
      sucessores.set(aresta.antecessoraCodigo, [
        ...(sucessores.get(aresta.antecessoraCodigo) ?? []),
        aresta.sucessoraCodigo,
      ]);
      grauDeEntrada.set(
        aresta.sucessoraCodigo,
        (grauDeEntrada.get(aresta.sucessoraCodigo) ?? 0) + 1,
      );
    }

    // A fila mantém a ordem do catálogo entre os elegíveis, o que torna o
    // resultado determinístico para o mesmo cadastro.
    const prontos = fases.filter((fase) => grauDeEntrada.get(fase.codigo) === 0).map((f) => f.codigo);
    const ordenado: FaseCanonicaDto[] = [];

    for (let codigo = prontos.shift(); codigo !== undefined; codigo = prontos.shift()) {
      const fase = porCodigo.get(codigo);
      if (fase !== undefined) ordenado.push(fase);

      const liberados: string[] = [];
      for (const sucessor of sucessores.get(codigo) ?? []) {
        const restante = (grauDeEntrada.get(sucessor) ?? 0) - 1;
        grauDeEntrada.set(sucessor, restante);
        if (restante === 0) liberados.push(sucessor);
      }

      // Reinsere respeitando a ordem do catálogo, não a de liberação.
      prontos.push(...liberados);
      prontos.sort(
        (a, b) =>
          fases.findIndex((f) => f.codigo === a) - fases.findIndex((f) => f.codigo === b),
      );
    }

    // Ciclo no cadastro deixaria fases de fora; devolvê-las na ordem do
    // catálogo é melhor do que sumir com elas do seletor.
    const incluidos = new Set(ordenado.map((fase) => fase.codigo));
    return [...ordenado, ...fases.filter((fase) => !incluidos.has(fase.codigo))];
  });

  carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);

    forkJoin({
      fases: coletarPaginas((cursor) => this.fasesApi.listar({ cursor })),
      precedencias: coletarPaginas((cursor) => this.precedenciasApi.listar({ cursor })),
      bancas: coletarPaginas((cursor) => this.bancasApi.listar({ cursor })),
      tiposEtapa: coletarPaginas((cursor) => this.tiposEtapaApi.listar({ cursor })),
      // `vigentes` assume `true` no servidor, e a série completa é o que
      // resolve o rótulo de um ato já referenciado cuja versão encerrou. Quais
      // podem ser escolhidos é recorte da tela, em `atosVigentes`.
      atos: coletarPaginas((cursor) => this.atosApi.listar({ cursor, vigentes: false })),
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
