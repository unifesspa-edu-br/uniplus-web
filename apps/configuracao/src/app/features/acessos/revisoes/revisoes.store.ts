import { HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
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
import { revisoesNaSituacao } from './regras-da-revisao';
import type { FiltroDaRevisao } from './rotulos-da-revisao';

/** As revisões de acesso, abertas e encerradas, por página de cursor. */
@Injectable()
export class RevisoesStore {
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private readonly pagina = signal<CursorPagina | undefined>(undefined);
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

  readonly filtro = signal<FiltroDaRevisao>('todas');
  readonly itens = computed(() => revisoesNaSituacao(this.navegacao.itens(), this.filtro()));
  readonly anterior = this.navegacao.anterior;
  readonly proximo = this.navegacao.proximo;
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
    const pagina = this.pagina();
    return pagina
      ? new HttpParams()
          .set('cursor', cursorToString(pagina.cursor))
          .set('direction', pagina.direction)
      : new HttpParams();
  }
}
