import { HttpParams } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  API_MAX_PAGE_SIZE,
  CursorPagina,
  ProblemI18nService,
  STATUS_HTTP,
  cursorToString,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  FatoCandidatoView,
  ModalidadeDto,
} from '@uniplus/shared-data/configuracao';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { navegacaoPorCursor, recuperarDeCursorObsoleto } from '../../shared/navegacao-por-cursor';

@Injectable()
export class ModalidadeFormStore {
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  private readonly pagina = signal<CursorPagina | undefined>(undefined);
  private readonly detalhe = useApiResource<ModalidadeDto>(() =>
    this.id === null
      ? undefined
      : {
          url: `${this.basePath}/api/configuracao/modalidades/${this.id}`,
          context: withVendorMime('modalidade', 1),
        },
  );
  readonly catalogo = useApiResource<readonly FatoCandidatoView[]>(() => ({
    url: `${this.basePath}/api/configuracao/fatos-candidato`,
    context: withVendorMime('fato-candidato', 1),
  }));
  private readonly lista = useApiResource<readonly ModalidadeDto[]>(() => ({
    url: `${this.basePath}/api/configuracao/modalidades`,
    params: this.montarParams(),
    context: withVendorMime('modalidade', 1),
  }));
  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);
  private acumuladas: readonly ModalidadeDto[] = [];
  readonly opcoes = signal<readonly ModalidadeDto[]>([]);
  readonly opcoesComErro = computed(
    () => this.lista.problem() !== null || this.lista.error() !== undefined,
  );
  readonly carregandoOpcoes = this.lista.isLoading;
  readonly modalidade = this.detalhe.data;
  readonly carregando = this.detalhe.isLoading;
  readonly erroCarregar = computed(() => {
    const problem = this.detalhe.problem();
    return problem
      ? this.problemI18n.resolve(problem).title
      : this.detalhe.error()
        ? 'Erro inesperado ao carregar a modalidade.'
        : null;
  });
  /** A leitura disse que a modalidade não existe mais: não há o que repetir, só voltar à lista. */
  readonly inexistente = computed(() => {
    const status = this.detalhe.problem()?.status;
    return status === STATUS_HTTP.NAO_ENCONTRADO || status === STATUS_HTTP.REMOVIDO_EM_DEFINITIVO;
  });
  /** A falha que a nova tentativa pode resolver: a inexistência tem o próprio desfecho. */
  readonly falhaAoCarregar = computed(() => (this.inexistente() ? null : this.erroCarregar()));
  readonly catalogoComErro = computed(
    () => this.catalogo.problem() !== null || this.catalogo.error() !== undefined,
  );

  constructor() {
    recuperarDeCursorObsoleto({
      problem: this.lista.problem,
      pagina: this.pagina,
      notificacoes: this.notifications,
    });
    effect(() => {
      const resultado = this.lista.value();
      if (!resultado?.ok) return;
      const proximo = this.navegacao.proximo();
      untracked(() => {
        // A primeira página recomeça o laço (cursor recusado): somá-la às já lidas duplicaria as opções.
        const anteriores = this.pagina() === undefined ? [] : this.acumuladas;
        this.acumuladas = [...anteriores, ...resultado.data];
        if (proximo !== null) this.navegacao.irParaProxima();
        else this.opcoes.set(this.acumuladas);
      });
    });
  }

  recarregarOpcoes(): void {
    if (!this.carregandoOpcoes()) this.lista.reload();
  }

  tentarNovamente(): void {
    if (!this.carregando()) this.detalhe.reload();
  }

  private montarParams(): HttpParams {
    const pagina = this.pagina();
    return pagina === undefined
      ? new HttpParams().set('limit', String(API_MAX_PAGE_SIZE))
      : new HttpParams()
          .set('cursor', cursorToString(pagina.cursor))
          .set('direction', pagina.direction)
          .set('limit', String(API_MAX_PAGE_SIZE));
  }
}
