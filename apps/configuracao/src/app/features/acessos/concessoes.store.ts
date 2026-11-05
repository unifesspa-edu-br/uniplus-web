import { HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, linkedSignal, signal } from '@angular/core';
import {
  CursorPagina,
  ProblemI18nService,
  cursorToString,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core/http';
import {
  AUTORIZACAO_BASE_PATH,
  type ConcessaoDto,
  type EventoDaTrilhaDto,
  type SituacaoDaConcessao,
} from '@uniplus/shared-data/autorizacao';
import { navegacaoPorCursor } from '../../shared/navegacao-por-cursor';
import { textoDaRecusa } from './mensagens-de-acesso';

@Injectable()
export class ConcessoesStore {
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly problemas = inject(ProblemI18nService);
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
  readonly erroDaTrilha = computed(() => {
    const problema = this.consultaDaTrilha.problem();
    return problema
      ? textoDaRecusa(this.problemas.resolve(problema))
      : this.consultaDaTrilha.error()
        ? 'Não foi possível concluir a operação. Verifique a conexão e tente de novo.'
        : null;
  });
  carregarTrilha(id: string): void {
    if (this.concessaoDaTrilha() === id) this.consultaDaTrilha.reload();
    else this.concessaoDaTrilha.set(id);
  }
  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);

  readonly itens = this.navegacao.itens;
  readonly anterior = this.navegacao.anterior;
  readonly proximo = this.navegacao.proximo;
  readonly carregando = this.lista.isLoading;
  readonly mensagemDeErro = computed(() => {
    const problema = this.lista.problem();
    return problema
      ? textoDaRecusa(this.problemas.resolve(problema))
      : this.lista.error()
        ? 'Não foi possível carregar a lista. Tente novamente.'
        : null;
  });
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
