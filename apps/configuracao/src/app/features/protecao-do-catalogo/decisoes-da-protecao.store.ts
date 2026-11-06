import { HttpParams } from '@angular/common/http';
import {
  Injectable,
  Injector,
  computed,
  effect,
  inject,
  linkedSignal,
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import {
  CursorPagina,
  ProblemI18nService,
  cursorToString,
  useApiResource,
  type UseApiResourceRef,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  type CadastroDoCatalogo,
  type DecisaoDaProtecaoDto,
} from '@uniplus/shared-data/configuracao';
import { DEFAULT_PAGE_SIZE } from '@uniplus/shared-ui/components';
import { LeituraDoDetalhe } from '../../shared/detalhe-do-catalogo';
import { navegacaoPorCursor } from '../../shared/navegacao-por-cursor';
import { filtrosDaUrl, periodoInvalido } from './filtros-das-decisoes';

@Injectable()
export class DecisoesDaProtecaoStore {
  private readonly route = inject(ActivatedRoute);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly injector = inject(Injector);
  readonly filtros = toSignal(this.route.queryParamMap.pipe(map(filtrosDaUrl)), {
    initialValue: filtrosDaUrl(this.route.snapshot.queryParamMap),
  });
  private readonly periodoInvalido = computed(() => periodoInvalido(this.filtros()));
  readonly limite = signal<number>(DEFAULT_PAGE_SIZE);
  private readonly pagina = linkedSignal<string, CursorPagina | undefined>({
    source: () => JSON.stringify([this.filtros(), this.limite()]),
    computation: () => undefined,
  });
  private readonly lista = signal<UseApiResourceRef<readonly DecisaoDaProtecaoDto[]> | null>(null);
  private readonly recursoDaLista = {
    value: computed(() => this.lista()?.value()),
    headers: computed(() => this.lista()?.headers()),
    isLoading: computed(() => this.lista()?.isLoading() ?? false),
    error: computed(() => this.lista()?.error()),
  };
  private readonly navegacao = navegacaoPorCursor(this.recursoDaLista, this.pagina);
  private readonly leituraDoItem = new LeituraDoDetalhe();
  readonly itens = computed(() => (periodoInvalido(this.filtros()) ? [] : this.navegacao.itens()));
  readonly carregando = this.recursoDaLista.isLoading;
  readonly anterior = this.navegacao.anterior;
  readonly proximo = this.navegacao.proximo;
  readonly mensagemDeErro = computed(() => {
    if (periodoInvalido(this.filtros())) return null;
    const problema = this.lista()?.problem();
    return problema
      ? this.problemI18n.resolve(problema).title
      : this.lista()?.error()
        ? 'Não foi possível carregar a lista. Tente novamente.'
        : null;
  });
  readonly historico = computed(() => this.leituraDoItem.detalhe()?.atos ?? null);
  readonly carregandoHistorico = this.leituraDoItem.carregando;
  readonly erroDoHistorico = this.leituraDoItem.erro;
  readonly itemInexistente = this.leituraDoItem.naoEncontrado;

  constructor() {
    effect(() => {
      const problem = this.lista()?.problem();
      if (problem && problem.status >= 500) {
        const titulo = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title: titulo }));
      }
    });
    effect((aoLimpar) => {
      if (this.periodoInvalido()) return;
      const lista = untracked(() =>
        runInInjectionContext(this.injector, () =>
          useApiResource<readonly DecisaoDaProtecaoDto[]>(() => ({
            url: `${this.basePath}/api/configuracao/admin/protecao-do-catalogo/decisoes`,
            params: this.montarParams(),
            context: withVendorMime('protecao-do-catalogo-decisao', 1),
          })),
        ),
      );
      untracked(() => this.lista.set(lista));
      aoLimpar(() => {
        lista.destroy();
        this.lista.set(null);
        this.navegacao.esvaziar();
      });
    });
  }

  carregar(): void {
    if (!periodoInvalido(this.filtros())) this.lista()?.reload();
  }

  proxima(): void {
    this.navegacao.irParaProxima();
  }
  voltar(): void {
    this.navegacao.irParaAnterior();
  }
  lerHistorico(decisao: DecisaoDaProtecaoDto): void {
    this.leituraDoItem.ler(decisao.cadastro as CadastroDoCatalogo, decisao.itemId);
  }

  /** Repete a leitura do histórico que falhou sem apagar o alerta, para o botão acionado seguir na tela. */
  recarregarHistorico(): void {
    this.leituraDoItem.recarregar();
  }

  private montarParams(): HttpParams {
    const f = this.filtros();
    let params = new HttpParams();
    for (const ato of f.ato) params = params.append('ato', ato);
    if (f.cadastro) params = params.set('cadastro', f.cadastro);
    if (f.de) params = params.set('de', f.de);
    if (f.ate) params = params.set('ate', f.ate);
    if (f.busca.trim()) params = params.set('busca', f.busca.trim());
    if (f.minhas) params = params.set('minhas', 'true');
    const pagina = this.pagina();
    return pagina
      ? params.set('cursor', cursorToString(pagina.cursor)).set('direction', pagina.direction)
      : params.set('limit', String(this.limite()));
  }
}
