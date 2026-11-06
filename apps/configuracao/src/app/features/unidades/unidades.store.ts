import { HttpParams } from '@angular/common/http';
import {
  Injectable,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import {
  CursorPagina,
  ProblemI18nService,
  cursorToString,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { ORGANIZACAO_BASE_PATH, UnidadeDto } from '@uniplus/shared-data/organizacao';
import { navegacaoPorCursor } from '../../shared/navegacao-por-cursor';
import { montarArvore } from './arvore-de-unidades';

/** Tamanho da janela de cada página (cursor pagination, ADR-0026). */
export const TAMANHO_DA_PAGINA = 100;

/** Debounce da busca textual: uma requisição por pausa na digitação, não por tecla. */
export const ATRASO_DA_BUSCA_EM_MS = 300;

/** Estado da listagem de unidades: busca e tipo no servidor, paginação e recarga. */
@Injectable()
export class UnidadesStore {
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly basePath = inject(ORGANIZACAO_BASE_PATH);

  readonly termoBusca = signal('');
  /** O ordinal do tipo em texto, como o chip do filtro o entrega; vazio é "Todas". */
  readonly tipoFiltro = signal('');

  private readonly buscaAplicada = toSignal(
    toObservable(this.termoBusca).pipe(
      map((termo) => termo.trim()),
      debounceTime(ATRASO_DA_BUSCA_EM_MS),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );

  /** Há filtro aplicado? Distingue "sem unidades" de "filtro sem resultado". */
  readonly temFiltro = computed(
    () => this.buscaAplicada().length > 0 || this.tipoFiltro().length > 0,
  );

  /** Página corrente (`undefined` é a primeira); volta à primeira quando o filtro muda. */
  private readonly pagina = linkedSignal<string, CursorPagina | undefined>({
    source: () => JSON.stringify([this.buscaAplicada(), this.tipoFiltro()]),
    computation: () => undefined,
  });

  private readonly lista = useApiResource<readonly UnidadeDto[]>(() => ({
    url: `${this.basePath}/api/organizacao/unidades`,
    params: this.montarParams(),
    context: withVendorMime('unidade', 1),
  }));

  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);

  readonly carregando = this.lista.isLoading;
  readonly unidades = this.navegacao.itens;
  readonly anterior = this.navegacao.anterior;
  readonly proximo = this.navegacao.proximo;

  /**
   * A árvore do que foi carregado. Com filtro ativo, a unidade cujo pai ficou fora do resultado
   * aparece como raiz.
   */
  readonly arvore = computed(() => montarArvore(this.unidades()));

  readonly mensagemDeErro = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem) {
      return this.problemI18n.resolve(problem).title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar unidades.' : null;
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

  proximaPagina(): void {
    this.navegacao.irParaProxima();
  }

  paginaAnterior(): void {
    this.navegacao.irParaAnterior();
  }

  tentarNovamente(): void {
    if (!this.carregando()) {
      this.lista.reload();
    }
  }

  /** Volta à primeira página, para a lista refletir o que acabou de ser gravado. */
  recarregar(): void {
    if (this.pagina() === undefined) {
      this.lista.reload();
    } else {
      this.pagina.set(undefined);
    }
  }

  private montarParams(): HttpParams {
    let params = new HttpParams();
    const busca = this.buscaAplicada();
    if (busca.length > 0) {
      params = params.set('q', busca);
    }
    const tipo = this.tipoFiltro();
    if (tipo.length > 0) {
      params = params.append('tipo', tipo);
    }
    const pagina = this.pagina();
    if (pagina === undefined) {
      return params.set('limit', String(TAMANHO_DA_PAGINA));
    }
    return params.set('cursor', cursorToString(pagina.cursor)).set('direction', pagina.direction);
  }
}
