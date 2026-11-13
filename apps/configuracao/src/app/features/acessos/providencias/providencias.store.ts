import { HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, linkedSignal, signal } from '@angular/core';
import {
  CursorPagina,
  ProblemI18nService,
  cursorToString,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  type FiltroDaSituacaoDaProvidencia,
  type ProvidenciaResumoDto,
} from '@uniplus/shared-data/autorizacao';
import {
  navegacaoPorCursor,
  recuperarDeCursorObsoleto,
} from '../../../shared/navegacao-por-cursor';
import { desfechoDaLeitura } from '../desfecho-da-leitura';
import { notificarFalhasDeLeitura } from '../falha-de-servidor';

/**
 * A fila das providências: as abertas por padrão, a mais antiga primeiro, como a API ordena; as
 * páginas seguem os links do header `Link`.
 */
@Injectable()
export class ProvidenciasStore {
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  readonly situacao = signal<FiltroDaSituacaoDaProvidencia>('aberta');
  private readonly pagina = linkedSignal<string, CursorPagina | undefined>({
    source: () => this.situacao(),
    computation: () => undefined,
  });
  private readonly lista = useApiResource<readonly ProvidenciaResumoDto[]>(() => ({
    url: `${this.basePath}/api/autorizacao/providencias`,
    params: this.montarParams(),
    context: withVendorMime('providencia', 1),
  }));
  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);
  /**
   * Com a leitura recusada ou falha, nenhuma página fica à vista, nem a anterior: a leitura que o
   * registro de acesso não gravou (503) não mostra dado.
   */
  private readonly semDado = computed(() => this.lista.problem() !== null || !!this.lista.error());
  readonly itens = computed(() => (this.semDado() ? [] : this.navegacao.itens()));
  readonly anterior = computed(() => (this.semDado() ? null : this.navegacao.anterior()));
  readonly proximo = computed(() => (this.semDado() ? null : this.navegacao.proximo()));
  private readonly recuperandoDeCursorObsoleto = recuperarDeCursorObsoleto({
    problem: this.lista.problem,
    pagina: this.pagina,
    notificacoes: this.notificacoes,
  });
  readonly carregando = computed(
    () => this.lista.isLoading() || this.recuperandoDeCursorObsoleto(),
  );
  private readonly desfecho = desfechoDaLeitura([this.lista], this.problemas);
  /** Sem dado na falha: a leitura registrada que não grava (503) não mostra a fila. */
  readonly falha = computed(() =>
    this.recuperandoDeCursorObsoleto() ? null : this.desfecho.falha(),
  );
  readonly recusa = this.desfecho.recusa;
  readonly mensagemDeErro = computed(() =>
    this.recuperandoDeCursorObsoleto() ? null : this.desfecho.mensagem(),
  );

  constructor() {
    notificarFalhasDeLeitura(this.problemas, this.notificacoes, [this.lista.problem]);
  }

  proximaPagina(): void {
    this.navegacao.irParaProxima();
  }

  paginaAnterior(): void {
    this.navegacao.irParaAnterior();
  }

  filtrarPor(situacao: FiltroDaSituacaoDaProvidencia): void {
    if (this.situacao() === situacao) this.lista.reload();
    else this.situacao.set(situacao);
  }

  /** Repete a leitura da página que falhou; devolve `false` se nenhuma leitura começou. */
  tentarNovamente(): boolean {
    return this.lista.reload();
  }

  private montarParams(): HttpParams {
    let params = new HttpParams().set('situacao', this.situacao());
    const pagina = this.pagina();
    if (pagina)
      params = params
        .set('cursor', cursorToString(pagina.cursor))
        .set('direction', pagina.direction);
    return params;
  }
}
