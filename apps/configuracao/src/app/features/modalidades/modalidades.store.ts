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
  FatoCandidatoView,
  ModalidadeDto,
} from '@uniplus/shared-data/configuracao';
import { navegacaoPorCursor, recuperarDeCursorObsoleto } from '../../shared/navegacao-por-cursor';
import { recusaDe } from '../../shared/recusa-da-leitura';

const MENSAGEM_DOS_FATOS =
  'A coluna “Quem concorre” mostra “Quem atende às condições da regra” até os fatos serem lidos de novo.';

@Injectable()
export class ModalidadesStore {
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly pagina = signal<CursorPagina | undefined>(undefined);
  private readonly lista = useApiResource<readonly ModalidadeDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/modalidades`,
    params: this.montarParams(),
    context: withVendorMime('modalidade', 1),
  }));
  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);
  readonly catalogo = useApiResource<readonly FatoCandidatoView[]>(() => ({
    url: `${this.basePath}/api/configuracao/fatos-candidato`,
    context: withVendorMime('fato-candidato', 1),
  }));
  /** Os fatos recusados em definitivo: repetir a leitura não muda a resposta. */
  readonly recusaDosFatos = computed(() => {
    const problem = this.catalogo.problem();
    return recusaDe(problem, problem ? this.problemI18n.resolve(problem).title : '');
  });
  /** A falha dos fatos que uma nova tentativa pode resolver; a coluna "Quem concorre" depende deles. */
  readonly falhaDosFatos = computed(() => {
    if (this.recusaDosFatos() !== null) return null;
    return this.catalogo.problem() || this.catalogo.error() ? MENSAGEM_DOS_FATOS : null;
  });
  readonly modalidades = this.navegacao.itens;
  private readonly recuperandoDeCursorObsoleto = recuperarDeCursorObsoleto({
    problem: this.lista.problem,
    pagina: this.pagina,
    notificacoes: this.notifications,
  });
  /** Inclui o intervalo entre o cursor recusado e a nova leitura. */
  readonly carregando = computed(
    () => this.lista.isLoading() || this.recuperandoDeCursorObsoleto(),
  );
  readonly anterior = this.navegacao.anterior;
  readonly proximo = this.navegacao.proximo;
  readonly mensagemDeErro = computed(() => {
    if (this.recuperandoDeCursorObsoleto()) return null;
    const problem = this.lista.problem();
    return problem
      ? this.problemI18n.resolve(problem).title
      : this.lista.error()
        ? 'Erro inesperado ao carregar modalidades.'
        : null;
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

  proximaPagina(): void {
    this.navegacao.irParaProxima();
  }
  paginaAnterior(): void {
    this.navegacao.irParaAnterior();
  }
  tentarNovamente(): void {
    if (!this.carregando()) this.lista.reload();
  }
  recarregar(): void {
    if (this.pagina() === undefined) this.lista.reload();
    else this.pagina.set(undefined);
  }
  private montarParams(): HttpParams {
    const pagina = this.pagina();
    return pagina === undefined
      ? new HttpParams().set('limit', '100')
      : new HttpParams()
          .set('cursor', cursorToString(pagina.cursor))
          .set('direction', pagina.direction);
  }
}
