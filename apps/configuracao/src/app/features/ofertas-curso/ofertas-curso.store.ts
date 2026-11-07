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
import {
  ApiResult,
  CursorPagina,
  ProblemI18nService,
  STATUS_HTTP,
  cursorToString,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CONFIGURACAO_BASE_PATH, OfertaCursoDto } from '@uniplus/shared-data/configuracao';
import { DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE_OPTIONS } from '@uniplus/shared-ui/components';
import { navegacaoPorCursor, recuperarDeCursorObsoleto } from '../../shared/navegacao-por-cursor';
import { montarLinhas } from './linhas-da-oferta';
import { VinculosDaOferta } from './vinculos-da-oferta';

/** Estado da listagem de ofertas: limite, paginação, total e recarga. Não conhece o formulário. */
@Injectable()
export class OfertasCursoStore {
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  private readonly vinculos = inject(VinculosDaOferta);

  /** Itens por página escolhidos no rodapé; só em memória (volta ao padrão a cada visita). */
  readonly limite = signal<number>(DEFAULT_PAGE_SIZE);
  readonly opcoesLimite = DEFAULT_PAGE_SIZE_OPTIONS;

  /** Página corrente (`undefined` = primeira). Volta à primeira quando o limite muda: o cursor carrega a janela antiga. */
  private readonly pagina = linkedSignal<number, CursorPagina | undefined>({
    source: () => this.limite(),
    computation: () => undefined,
  });

  private readonly lista = useApiResource<readonly OfertaCursoDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/ofertas-curso`,
    params: this.montarParams(),
    context: withVendorMime('oferta-curso', 1),
  }));

  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);

  readonly anterior = this.navegacao.anterior;
  readonly proximo = this.navegacao.proximo;
  readonly ofertas = this.navegacao.itens;
  readonly linhas = computed(() => montarLinhas(this.ofertas(), this.vinculos));

  /**
   * Total do cadastro (`X-Total-Count`). É pedido só na consulta sem cursor, porque o total é da
   * consulta e não da página; as páginas com cursor reaproveitam o último valor conhecido. `null` é
   * "desconhecido" (falha ou header ausente): o indicador some em vez de afirmar zero.
   */
  readonly total = linkedSignal<ApiResult<readonly OfertaCursoDto[]> | undefined, number | null>({
    source: () => this.lista.value(),
    computation: (envelope, previous) => {
      const atual = previous?.value ?? null;
      if (envelope === undefined || untracked(() => this.pagina() !== undefined)) {
        return atual;
      }
      const header = untracked(() => this.lista.headers()?.get('X-Total-Count') ?? null);
      return envelope.ok && header !== null && /^\d+$/.test(header) ? Number(header) : null;
    },
  });

  /**
   * Cursor que não continua esta consulta (400) ou que expirou (410): recomeça a paginação sem
   * cursor e avisa o operador, em vez de deixar a tela vazia ou presa numa página que não existe.
   */
  private readonly recuperandoDeCursorObsoleto = recuperarDeCursorObsoleto({
    problem: this.lista.problem,
    pagina: this.pagina,
    notificacoes: this.notifications,
  });

  /** Inclui o intervalo entre a resposta de cursor recusado e a nova leitura sem cursor. */
  readonly carregando = computed(
    () => this.lista.isLoading() || this.recuperandoDeCursorObsoleto(),
  );

  readonly mensagemDeErro = computed<string | null>(() => {
    if (this.recuperandoDeCursorObsoleto()) {
      return null;
    }
    const problem = this.lista.problem();
    if (problem) {
      const { title, detail } = this.problemI18n.resolve(problem);
      // 422 de `q`/`sort`: a API nomeia o campo recusado e lista os aceitos no `detail`.
      return problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO && detail ? detail : title;
    }
    return this.lista.error() ? 'Erro inesperado ao carregar ofertas de curso.' : null;
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

  /** Troca o limite; a página é derivada dele, então a mudança já volta à primeira e refaz o GET. */
  aoTrocarLimite(valor: number | null): void {
    if (valor !== null && valor !== this.limite()) {
      this.limite.set(valor);
    }
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
    const pagina = this.pagina();
    if (pagina === undefined) {
      return new HttpParams().set('limit', String(this.limite())).set('include_total', true);
    }
    return new HttpParams()
      .set('cursor', cursorToString(pagina.cursor))
      .set('direction', pagina.direction);
  }
}
