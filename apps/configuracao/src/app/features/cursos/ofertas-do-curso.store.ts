import { HttpParams } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  CursorPagina,
  ProblemI18nService,
  cursorToString,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  CursoDto,
  OfertaCursoDto,
} from '@uniplus/shared-data/configuracao';
import { navegacaoPorCursor, recuperarDeCursorObsoleto } from '../../shared/navegacao-por-cursor';

/** Janela da lista de ofertas do curso no drawer (cursor pagination, ADR-0026). */
const PAGE_SIZE = 5;

/**
 * As ofertas vivas do curso selecionado, em inspeção sob demanda: só consulta enquanto há um
 * curso no drawer, e a cada abertura recomeça do zero com dados frescos.
 */
@Injectable()
export class OfertasDoCursoStore {
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  readonly aberto = signal(false);
  /** Motivo pelo qual a remoção do curso foi recusada, quando o drawer abre por causa dela. */
  readonly bloqueio = signal<string | null>(null);

  private readonly curso = signal<CursoDto | null>(null);
  private readonly pagina = signal<CursorPagina | undefined>(undefined);

  private readonly lista = useApiResource<readonly OfertaCursoDto[]>(() => {
    const curso = this.curso();
    if (curso === null) {
      return undefined;
    }
    return {
      url: `${this.basePath}/api/configuracao/ofertas-curso`,
      params: this.montarParams(curso.id),
      context: withVendorMime('oferta-curso', 1),
    };
  });

  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);

  readonly itens = this.navegacao.itens;
  readonly anterior = this.navegacao.anterior;
  readonly proximo = this.navegacao.proximo;

  private readonly recuperandoDeCursorObsoleto = recuperarDeCursorObsoleto({
    problem: this.lista.problem,
    pagina: this.pagina,
    notificacoes: this.notifications,
  });

  /** Inclui o intervalo entre o cursor recusado e a nova leitura. */
  readonly carregando = computed(
    () => this.lista.isLoading() || this.recuperandoDeCursorObsoleto(),
  );

  readonly mensagemDeErro = computed<string | null>(() => {
    if (this.recuperandoDeCursorObsoleto()) {
      return null;
    }
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar as ofertas do curso.' : null;
  });

  /** O curso cujas ofertas o drawer mostra; `null` com o drawer fechado. */
  readonly cursoId = computed(() => this.curso()?.id ?? null);

  readonly titulo = computed(() => {
    const curso = this.curso();
    return curso ? `Ofertas de ${curso.codigo}` : 'Ofertas do curso';
  });

  constructor() {
    effect(() => {
      const problem = this.lista.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });
  }

  /** Abre o drawer com as ofertas vivas do curso (inspeção proativa, sem contexto de bloqueio). */
  abrir(curso: CursoDto): void {
    this.bloqueio.set(null);
    this.exibir(curso);
  }

  /** Abre o drawer mostrando as ofertas que impedem a remoção do curso. */
  abrirPorBloqueio(curso: CursoDto, motivo: string): void {
    this.bloqueio.set(motivo);
    this.exibir(curso);
  }

  /**
   * Limpa o curso (a consulta deixa de existir) para que a próxima abertura refaça a busca do
   * zero, sempre com dados frescos.
   */
  aoFechar(): void {
    this.curso.set(null);
    this.bloqueio.set(null);
    this.navegacao.esvaziar();
  }

  recarregar(): void {
    if (!this.carregando()) {
      this.lista.reload();
    }
  }

  proximaPagina(): void {
    this.navegacao.irParaProxima();
  }

  paginaAnterior(): void {
    this.navegacao.irParaAnterior();
  }

  private exibir(curso: CursoDto): void {
    // Zera lista e cursores ANTES de trocar o curso: enquanto a resposta não chega os dados
    // anteriores seriam preservados e o drawer exibiria as ofertas do curso anterior sob o
    // cabeçalho do novo.
    this.navegacao.esvaziar();
    this.pagina.set(undefined);
    this.curso.set(curso);
    this.aberto.set(true);
  }

  /** `cursoId` é reanexado em toda página. */
  private montarParams(cursoId: string): HttpParams {
    const pagina = this.pagina();
    if (pagina === undefined) {
      return new HttpParams().set('limit', String(PAGE_SIZE)).set('cursoId', cursoId);
    }
    return new HttpParams()
      .set('cursor', cursorToString(pagina.cursor))
      .set('direction', pagina.direction)
      .set('cursoId', cursoId);
  }
}
