import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, switchMap } from 'rxjs';

import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import {
  STATUS_HTTP,
  extractNextCursor,
  extractPrevCursor,
  ehCursorDePaginacaoObsoleto,
  ehCursorDePaginacaoExpirado,
  type ApiFailure,
  type ApiOk,
  type ApiResult,
  type Cursor,
  type CursorPagina,
} from '@uniplus/shared-core/http';
import {
  ProcessosSeletivosApi,
  type ProcessoSeletivoResumoDto,
} from '@uniplus/shared-data/selecao';

import {
  TAMANHO_INICIAL_DO_PAINEL,
  type FalhaDoPainel,
  type ProcessoDoPainel,
  type RestricaoDoPainel,
} from './painel-de-processos.component';

/** A primeira página define a janela; nas demais, o cursor já carrega o limite. */
type PedidoDePagina = { readonly limit: number } | CursorPagina;

interface PaginaDoPainel {
  readonly itens: readonly ProcessoDoPainel[];
  readonly anterior: Cursor | null;
  readonly proxima: Cursor | null;
}

function paginaRecebida(resposta: ApiOk<readonly ProcessoSeletivoResumoDto[]>): PaginaDoPainel {
  const link = resposta.headers.get('Link');
  return {
    itens: resposta.data.map(({ id, nome }) => ({ id, nome })),
    anterior: extractPrevCursor(link),
    proxima: extractNextCursor(link),
  };
}

/**
 * Consulta do painel de processos seletivos: lê a coleção por `ProcessosSeletivosApi.listar` e
 * entrega à apresentação itens, cursores e estados. Mantém a ordem recebida, não filtra nem
 * reordena e não calcula total global.
 *
 * - uma consulta por vez: pedidos durante o carregamento são ignorados;
 * - a resposta de uma consulta substituída (reinício ou troca de sessão) é descartada;
 * - a troca de usuário limpa itens, cursores e falhas antes de consultar de novo. A renovação do
 *   token do mesmo usuário não reinicia a lista.
 *
 * Fornecida pelo componente que a usa, para que a consulta morra com a tela.
 */
@Injectable()
export class ConsultaDoPainel {
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly usuario = inject(UserContextService);

  /** `null` cancela a consulta em curso sem pedir outra. */
  private readonly pedidos = new Subject<PedidoDePagina | null>();

  private readonly paginaExibida = signal<PaginaDoPainel | null>(null);
  private readonly _carregando = signal(false);
  private readonly _falha = signal<FalhaDoPainel | null>(null);
  private readonly _restricao = signal<RestricaoDoPainel | null>(null);
  private readonly _limite = signal(TAMANHO_INICIAL_DO_PAINEL);

  /** Última consulta pedida: é a que "tentar novamente" repete quando ela falha. */
  private ultimoPedido: PedidoDePagina = { limit: TAMANHO_INICIAL_DO_PAINEL };

  readonly itens = computed(() => this.paginaExibida()?.itens ?? []);
  readonly carregando = this._carregando.asReadonly();
  readonly falha = this._falha.asReadonly();
  readonly restricao = this._restricao.asReadonly();
  readonly limite = this._limite.asReadonly();
  readonly temAnterior = computed(() => this.paginaExibida()?.anterior != null);
  readonly temProxima = computed(() => this.paginaExibida()?.proxima != null);

  /** Identidade do usuário; a renovação do token não a altera. */
  private readonly idDoUsuario = computed(() => {
    return this.usuario.isAuthenticated() ? (this.usuario.user()?.id ?? null) : null;
  });

  constructor() {
    this.pedidos
      .pipe(
        switchMap((pedido) => (pedido === null ? EMPTY : this.api.listar(pedido))),
        takeUntilDestroyed(),
      )
      .subscribe((resultado) => this.aplicar(resultado));

    effect(() => {
      const id = this.idDoUsuario();
      untracked(() => this.recomecarParaUsuario(id));
    });
  }

  proximaPagina(): void {
    const cursor = this.paginaExibida()?.proxima;
    if (cursor) this.consultar({ cursor, direction: 'next' });
  }

  paginaAnterior(): void {
    const cursor = this.paginaExibida()?.anterior;
    if (cursor) this.consultar({ cursor, direction: 'prev' });
  }

  /** O cursor carrega a janela antiga: trocar o tamanho recomeça sem cursor. */
  trocarTamanho(limite: number): void {
    if (this._carregando() || limite === this._limite()) return;
    this._limite.set(limite);
    this.consultar({ limit: limite });
  }

  /** A nova tentativa repete tanto a janela inicial quanto a navegação que falhou. */
  tentarNovamente(): void {
    this.consultar(this.ultimoPedido);
  }

  /** Reinicia sem reutilizar o cursor vencido. */
  atualizarLista(): void {
    this.consultar({ limit: this._limite() });
  }

  private consultar(pedido: PedidoDePagina): void {
    if (this._carregando() || this.idDoUsuario() === null) return;
    this.iniciar(pedido);
  }

  private iniciar(pedido: PedidoDePagina): void {
    this.ultimoPedido = pedido;
    this._carregando.set(true);
    // Uma falha de navegação some ao repetir; a inicial também, para a espera não coexistir com ela.
    this._falha.set(null);
    this.pedidos.next(pedido);
  }

  private recomecarParaUsuario(id: string | null): void {
    // Descarta o que era do usuário anterior; `switchMap` ignora a resposta que ainda voltar.
    this.paginaExibida.set(null);
    this._falha.set(null);
    this._restricao.set(null);
    this._limite.set(TAMANHO_INICIAL_DO_PAINEL);
    if (id === null) {
      // Sem sessão não há consulta: só se cancela a que estava em curso.
      this._carregando.set(false);
      this.pedidos.next(null);
      return;
    }
    this.iniciar({ limit: TAMANHO_INICIAL_DO_PAINEL });
  }

  private aplicar(resultado: ApiResult<readonly ProcessoSeletivoResumoDto[]>): void {
    this._carregando.set(false);
    this._restricao.set(null);
    if (resultado.ok) {
      this.paginaExibida.set(paginaRecebida(resultado));
    } else {
      this.tratarFalha(resultado);
    }
  }

  private tratarFalha(resultado: ApiFailure): void {
    const navegando = 'cursor' in this.ultimoPedido;
    if (resultado.status === STATUS_HTTP.SEM_PERMISSAO) {
      this.paginaExibida.set(null);
      this._restricao.set('acesso-negado');
    } else if (navegando && ehCursorDePaginacaoObsoleto(resultado.problem)) {
      this.paginaExibida.set(null);
      this._restricao.set(
        ehCursorDePaginacaoExpirado(resultado.problem) ? 'cursor-expirado' : 'cursor-invalido',
      );
    } else {
      if (!navegando) this.paginaExibida.set(null);
      this._falha.set(navegando ? 'navegacao' : 'inicial');
    }
  }
}
