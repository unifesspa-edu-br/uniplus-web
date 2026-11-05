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
  CursorPagina,
  ProblemI18nService,
  cursorToString,
  ehCursorDePaginacaoExpirado,
  useApiResource,
  useCursorObsoletoRecovery,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  CONFIGURACAO_BASE_PATH,
  ModeloFormularioView,
  TipoProcessoDto,
} from '@uniplus/shared-data/configuracao';
import { navegacaoPorCursor } from '../../shared/navegacao-por-cursor';

@Injectable()
export class ModelosFormularioStore {
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);

  readonly termoBusca = signal('');
  readonly filtroFinalidade = signal('');
  readonly filtroSituacao = signal('');
  readonly filtroTipo = signal('');
  private readonly pagina = linkedSignal<string, CursorPagina | undefined>({
    source: () =>
      JSON.stringify([this.filtroFinalidade(), this.filtroSituacao(), this.filtroTipo()]),
    computation: () => undefined,
  });
  private readonly lista = useApiResource<readonly ModeloFormularioView[]>(() => ({
    url: `${this.basePath}/api/configuracao/admin/modelos-formulario`,
    params: this.montarParams(),
    context: withVendorMime('modelo-formulario', 1),
  }));
  private readonly tipos = useApiResource<readonly TipoProcessoDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/tipos-processo`,
    params: new HttpParams().set('limit', '100'),
    context: withVendorMime('tipo-processo', 1),
  }));
  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);
  private readonly recuperando = useCursorObsoletoRecovery({
    problem: this.lista.problem,
    pagina: this.pagina,
    reiniciarPagina: () => this.pagina.set(undefined),
    aoRecuperar: (problem) =>
      this.notifications.info(
        problem && ehCursorDePaginacaoExpirado(problem)
          ? 'A listagem ficou aberta tempo demais e a consulta expirou.'
          : 'A paginação foi reiniciada porque a consulta mudou.',
        'Recarregamos a listagem do começo.',
      ),
  });

  readonly carregando = this.lista.isLoading;
  readonly tiposDeProcesso = computed(() => this.tipos.data() ?? []);
  readonly anterior = this.navegacao.anterior;
  readonly proximo = this.navegacao.proximo;
  readonly modelosBuscados = computed(() => {
    const termo = this.termoBusca().trim().toLocaleLowerCase('pt-BR');
    return this.navegacao
      .itens()
      .filter(
        (modelo) =>
          modelo.codigo.toLocaleLowerCase('pt-BR').includes(termo) ||
          modelo.nome.toLocaleLowerCase('pt-BR').includes(termo),
      );
  });
  readonly mensagemDeErro = computed<string | null>(() => {
    const problem = this.lista.problem();
    if (problem && this.recuperando()) return null;
    if (problem) return this.problemI18n.resolve(problem).title;
    return this.lista.error() ? 'Erro inesperado ao carregar os modelos.' : null;
  });

  constructor() {
    effect(() => {
      const problem = this.lista.problem();
      if (problem && problem.status >= 500) {
        const title = this.problemI18n.resolve(problem).title;
        untracked(() => this.notifications.errorFromProblem(problem, { title }));
      }
    });
  }

  tentarNovamente(): void {
    if (!this.carregando()) this.lista.reload();
  }

  recarregar(): void {
    this.lista.reload();
  }

  proximaPagina(): void {
    this.navegacao.irParaProxima();
  }

  paginaAnterior(): void {
    this.navegacao.irParaAnterior();
  }

  private montarParams(): HttpParams {
    let params = new HttpParams();
    if (this.filtroFinalidade() !== '') params = params.set('finalidade', this.filtroFinalidade());
    if (this.filtroSituacao() !== '') params = params.set('ativo', this.filtroSituacao());
    if (this.filtroTipo() !== '') params = params.set('tipoProcesso', this.filtroTipo());
    const pagina = this.pagina();
    return pagina === undefined
      ? params.set('limit', '50')
      : params.set('cursor', cursorToString(pagina.cursor)).set('direction', pagina.direction);
  }
}
