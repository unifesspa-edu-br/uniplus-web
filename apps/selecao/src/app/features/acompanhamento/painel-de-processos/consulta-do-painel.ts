import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, switchMap } from 'rxjs';

import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import {
  STATUS_HTTP,
  extractNextCursor,
  extractPrevCursor,
  ehCursorDePaginacaoObsoleto,
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

/** Consulta pedida à API: `undefined` em `pagina` é a primeira página, sem cursor. */
interface Consulta {
  readonly pagina: CursorPagina | undefined;
  readonly limite: number;
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
  private readonly pedidos = new Subject<Consulta | null>();

  private readonly _itens = signal<readonly ProcessoDoPainel[]>([]);
  private readonly _cursores = signal<{
    readonly prev: Cursor | null;
    readonly next: Cursor | null;
  }>({ prev: null, next: null });
  private readonly _carregando = signal(false);
  private readonly _falha = signal<FalhaDoPainel | null>(null);
  private readonly _restricao = signal<RestricaoDoPainel | null>(null);
  private readonly _limite = signal(TAMANHO_INICIAL_DO_PAINEL);

  /** Última consulta pedida: é a que "tentar novamente" repete quando ela falha. */
  private ultima: Consulta = { pagina: undefined, limite: TAMANHO_INICIAL_DO_PAINEL };

  readonly itens = this._itens.asReadonly();
  readonly carregando = this._carregando.asReadonly();
  readonly falha = this._falha.asReadonly();
  readonly restricao = this._restricao.asReadonly();
  readonly limite = this._limite.asReadonly();
  readonly temAnterior = computed(() => this._cursores().prev !== null);
  readonly temProxima = computed(() => this._cursores().next !== null);

  /** Identidade do usuário; a renovação do token não a altera. */
  private readonly idDoUsuario = computed(() => {
    return this.usuario.isAuthenticated() ? (this.usuario.user()?.id ?? null) : null;
  });

  constructor() {
    this.pedidos
      .pipe(
        switchMap((consulta) =>
          consulta === null
            ? EMPTY
            : this.api.listar({
                cursor: consulta.pagina?.cursor,
                direction: consulta.pagina?.direction,
                limit: consulta.pagina === undefined ? consulta.limite : undefined,
              }),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((resultado) => this.aplicar(resultado));

    effect(() => {
      const id = this.idDoUsuario();
      untracked(() => this.recomecarParaUsuario(id));
    });
  }

  proximaPagina(): void {
    const cursor = untracked(this._cursores).next;
    if (cursor !== null) {
      this.consultar({ pagina: { cursor, direction: 'next' }, limite: untracked(this._limite) });
    }
  }

  paginaAnterior(): void {
    const cursor = untracked(this._cursores).prev;
    if (cursor !== null) {
      this.consultar({ pagina: { cursor, direction: 'prev' }, limite: untracked(this._limite) });
    }
  }

  /** O cursor carrega a janela antiga: trocar o tamanho recomeça sem cursor. */
  trocarTamanho(limite: number): void {
    if (untracked(this._carregando) || limite === untracked(this._limite)) return;
    this._limite.set(limite);
    this.consultar({ pagina: undefined, limite });
  }

  /** Repete a consulta que falhou; sem falha de navegação, recomeça do início. */
  tentarNovamente(): void {
    this.consultar(
      untracked(this._falha) === 'navegacao'
        ? this.ultima
        : { pagina: undefined, limite: untracked(this._limite) },
    );
  }

  /** Reinicia sem reutilizar o cursor vencido. */
  atualizarLista(): void {
    this.consultar({ pagina: undefined, limite: untracked(this._limite) });
  }

  private consultar(consulta: Consulta): void {
    if (untracked(this._carregando) || this.idDoUsuario() === null) return;
    this.iniciar(consulta);
  }

  private iniciar(consulta: Consulta): void {
    this.ultima = consulta;
    this._carregando.set(true);
    this._restricao.set(null);
    // Uma falha de navegação some ao repetir; a inicial também, para a espera não coexistir com ela.
    this._falha.set(null);
    this.pedidos.next(consulta);
  }

  private recomecarParaUsuario(id: string | null): void {
    // Descarta o que era do usuário anterior; `switchMap` ignora a resposta que ainda voltar.
    this.limparDados();
    this._falha.set(null);
    this._restricao.set(null);
    this._limite.set(TAMANHO_INICIAL_DO_PAINEL);
    if (id === null) {
      // Sem sessão não há consulta: só se cancela a que estava em curso.
      this._carregando.set(false);
      this.pedidos.next(null);
      return;
    }
    this.iniciar({ pagina: undefined, limite: TAMANHO_INICIAL_DO_PAINEL });
  }

  private aplicar(resultado: ApiResult<readonly ProcessoSeletivoResumoDto[]>): void {
    this._carregando.set(false);

    if (resultado.ok) {
      this._itens.set(resultado.data.map(({ id, nome }) => ({ id, nome })));
      const link = resultado.headers?.get('Link') ?? null;
      this._cursores.set({ prev: extractPrevCursor(link), next: extractNextCursor(link) });
      return;
    }

    const primeira = this.ultima.pagina === undefined;

    if (resultado.status === STATUS_HTTP.SEM_PERMISSAO) {
      this.limparDados();
      this._restricao.set('acesso-negado');
    } else if (!primeira && ehCursorDePaginacaoObsoleto(resultado.problem)) {
      this._cursores.set({ prev: null, next: null });
      this._restricao.set('cursor-expirado');
    } else if (primeira) {
      this.limparDados();
      this._falha.set('inicial');
    } else {
      // Falha de navegação: a última página válida e seus cursores continuam.
      this._falha.set('navegacao');
    }
  }

  private limparDados(): void {
    this._itens.set([]);
    this._cursores.set({ prev: null, next: null });
  }
}
