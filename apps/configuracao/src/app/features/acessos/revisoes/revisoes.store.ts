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
import { AUTORIZACAO_BASE_PATH, type RevisaoResumoDto } from '@uniplus/shared-data/autorizacao';
import {
  navegacaoPorCursor,
  recuperarDeCursorObsoleto,
} from '../../../shared/navegacao-por-cursor';
import { desfechoDaLeitura } from '../desfecho-da-leitura';
import { notificarFalhasDeLeitura } from '../falha-de-servidor';
import type { FiltroDaRevisao } from './rotulos-da-revisao';

/**
 * As revisões de acesso por página de cursor. A situação escolhida filtra no servidor, antes da
 * paginação, e a troca dela volta à primeira página.
 */
@Injectable()
export class RevisoesStore {
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  readonly filtro = signal<FiltroDaRevisao>('todas');
  private readonly pagina = linkedSignal<FiltroDaRevisao, CursorPagina | undefined>({
    source: () => this.filtro(),
    computation: () => undefined,
  });
  private readonly lista = useApiResource<readonly RevisaoResumoDto[]>(() => ({
    url: `${this.basePath}/api/autorizacao/revisoes`,
    params: this.montarParams(),
    context: withVendorMime('revisao-de-acessos', 1),
  }));
  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);
  private readonly recuperandoDeCursorObsoleto = recuperarDeCursorObsoleto({
    problem: this.lista.problem,
    pagina: this.pagina,
    notificacoes: this.notificacoes,
  });
  private readonly desfecho = desfechoDaLeitura([this.lista], this.problemas);

  /** Com falha de leitura não há dado à vista: nem a página anterior, nem os cursores dela. */
  private readonly comFalha = computed(() => this.desfecho.mensagem() !== null);
  readonly itens = computed(() => (this.comFalha() ? [] : this.navegacao.itens()));
  readonly anterior = computed(() => (this.comFalha() ? null : this.navegacao.anterior()));
  readonly proximo = computed(() => (this.comFalha() ? null : this.navegacao.proximo()));
  readonly carregando = computed(
    () => this.lista.isLoading() || this.recuperandoDeCursorObsoleto(),
  );
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

  /** A troca de situação volta à primeira página e não mostra a lista anterior enquanto lê a nova. */
  filtrarPor(filtro: FiltroDaRevisao): void {
    if (filtro === this.filtro()) return;
    this.navegacao.esvaziar();
    this.filtro.set(filtro);
  }

  proximaPagina(): void {
    this.navegacao.irParaProxima();
  }

  paginaAnterior(): void {
    this.navegacao.irParaAnterior();
  }

  /** Repete a leitura da página que falhou; devolve `false` se nenhuma leitura começou. */
  tentarNovamente(): boolean {
    return this.lista.reload();
  }

  private montarParams(): HttpParams {
    const filtro = this.filtro();
    const params = filtro === 'todas' ? new HttpParams() : new HttpParams().set('situacao', filtro);
    const pagina = this.pagina();
    return pagina
      ? params.set('cursor', cursorToString(pagina.cursor)).set('direction', pagina.direction)
      : params;
  }
}
