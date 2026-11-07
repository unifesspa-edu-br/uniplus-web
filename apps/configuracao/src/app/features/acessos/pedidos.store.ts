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
  type FilaDePedidos,
  type PedidoResumoDto,
} from '@uniplus/shared-data/autorizacao';
import { navegacaoPorCursor, recuperarDeCursorObsoleto } from '../../shared/navegacao-por-cursor';
import { desfechoDaLeitura } from './desfecho-da-leitura';
import { notificarFalhasDeLeitura } from './falha-de-servidor';

@Injectable()
export class PedidosStore {
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  readonly fila = signal<FilaDePedidos | undefined>(undefined);
  readonly situacao = signal('');
  private readonly pagina = linkedSignal<string, CursorPagina | undefined>({
    source: () => JSON.stringify([this.fila(), this.situacao()]),
    computation: () => undefined,
  });
  private readonly lista = useApiResource<readonly PedidoResumoDto[]>(() =>
    this.fila() === undefined
      ? undefined
      : {
          url: `${this.basePath}/api/autorizacao/pedidos-de-concessao`,
          params: this.montarParams(),
          context: withVendorMime('pedido-de-concessao', 1),
        },
  );
  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);

  readonly itens = this.navegacao.itens;
  readonly anterior = this.navegacao.anterior;
  readonly proximo = this.navegacao.proximo;
  /** Cursor recusado: a paginação recomeça sem cursor, e a nova tentativa não repete o cursor morto. */
  private readonly recuperandoDeCursorObsoleto = recuperarDeCursorObsoleto({
    problem: this.lista.problem,
    pagina: this.pagina,
    notificacoes: this.notificacoes,
  });
  /** Inclui o intervalo entre a resposta de cursor recusado e a nova leitura sem cursor. */
  readonly carregando = computed(
    () => this.lista.isLoading() || this.recuperandoDeCursorObsoleto(),
  );
  private readonly desfecho = desfechoDaLeitura([this.lista], this.problemas);
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
  filtrarPor(situacao: string): void {
    if (this.situacao() === situacao) {
      this.recarregar();
      return;
    }
    this.situacao.set(situacao);
  }
  recarregar(): void {
    if (this.pagina() === undefined) this.lista.reload();
    else this.pagina.set(undefined);
  }
  /** Repete a leitura da página que falhou; devolve `false` se nenhuma leitura começou. */
  tentarNovamente(): boolean {
    return this.lista.reload();
  }
  private montarParams(): HttpParams {
    let params = new HttpParams().set('fila', this.fila() ?? 'meus');
    if (this.situacao()) params = params.set('situacao', this.situacao());
    const pagina = this.pagina();
    if (pagina)
      params = params
        .set('cursor', cursorToString(pagina.cursor))
        .set('direction', pagina.direction);
    return params;
  }
}
