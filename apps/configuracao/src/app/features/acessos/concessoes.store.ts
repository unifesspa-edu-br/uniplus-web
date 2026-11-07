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
  type ConcessaoDto,
  type EventoDaTrilhaDto,
  type SituacaoDaConcessao,
} from '@uniplus/shared-data/autorizacao';
import { navegacaoPorCursor, recuperarDeCursorObsoleto } from '../../shared/navegacao-por-cursor';
import { desfechoDaLeitura } from './desfecho-da-leitura';
import { notificarFalhasDeLeitura } from './falha-de-servidor';

@Injectable()
export class ConcessoesStore {
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  readonly situacao = signal<SituacaoDaConcessao>('ativa');
  private readonly pagina = linkedSignal<string, CursorPagina | undefined>({
    source: () => this.situacao(),
    computation: () => undefined,
  });
  private readonly lista = useApiResource<readonly ConcessaoDto[]>(() => ({
    url: `${this.basePath}/api/autorizacao/concessoes`,
    params: this.montarParams(),
    context: withVendorMime('concessao', 1),
  }));
  private readonly concessaoDaTrilha = signal<string | null>(null);
  private readonly consultaDaTrilha = useApiResource<readonly EventoDaTrilhaDto[]>(() => {
    const id = this.concessaoDaTrilha();
    return id === null
      ? undefined
      : {
          url: `${this.basePath}/api/autorizacao/concessoes/${encodeURIComponent(id)}/trilha`,
          context: withVendorMime('trilha-da-concessao', 1),
        };
  });
  readonly trilha = computed(() => {
    const resultado = this.consultaDaTrilha.value();
    return resultado?.ok ? resultado.data : [];
  });
  readonly carregandoTrilha = this.consultaDaTrilha.isLoading;
  private readonly desfechoDaTrilha = desfechoDaLeitura([this.consultaDaTrilha], this.problemas);
  readonly falhaDaTrilha = this.desfechoDaTrilha.falha;
  readonly recusaDaTrilha = this.desfechoDaTrilha.recusa;
  carregarTrilha(id: string): void {
    if (this.concessaoDaTrilha() === id) this.consultaDaTrilha.reload();
    else this.concessaoDaTrilha.set(id);
  }
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
    notificarFalhasDeLeitura(this.problemas, this.notificacoes, [
      this.lista.problem,
      this.consultaDaTrilha.problem,
    ]);
  }

  proximaPagina(): void {
    this.navegacao.irParaProxima();
  }
  paginaAnterior(): void {
    this.navegacao.irParaAnterior();
  }
  filtrarPor(situacao: SituacaoDaConcessao): void {
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
  tentarTrilhaNovamente(): boolean {
    return this.consultaDaTrilha.reload();
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
