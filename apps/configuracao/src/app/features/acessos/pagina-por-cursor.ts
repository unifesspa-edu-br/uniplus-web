import { DestroyRef, signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import {
  ApiResult,
  CLIENT_PROBLEM_CODES,
  Cursor,
  CursorPagina,
  ProblemDetails,
  extractNextCursor,
  extractPrevCursor,
} from '@uniplus/shared-core/http';

/**
 * Estado de uma lista paginada por cursor opaco: itens da página, recusa, carga em curso e os
 * cursores de ida e volta. Cada busca cancela a anterior, então uma resposta atrasada nunca
 * substitui a página mais nova.
 */
export class PaginaPorCursor<T> {
  readonly itens = signal<readonly T[]>([]);
  readonly carregando = signal(false);
  readonly problema = signal<ProblemDetails | null>(null);
  readonly anterior = signal<Cursor | null>(null);
  readonly proximo = signal<Cursor | null>(null);

  private assinatura: Subscription | undefined;

  constructor(
    private readonly buscar: (pagina?: CursorPagina) => Observable<ApiResult<readonly T[]>>,
    destroyRef: DestroyRef,
  ) {
    destroyRef.onDestroy(() => this.assinatura?.unsubscribe());
  }

  /** Abre a primeira página, ou a que o cursor indica. */
  carregar(pagina?: CursorPagina): void {
    this.assinatura?.unsubscribe();
    this.carregando.set(true);
    this.problema.set(null);
    this.assinatura = this.buscar(pagina).subscribe({
      next: (resultado) => {
        this.carregando.set(false);
        if (!resultado.ok) {
          this.recusar(resultado.problem);
          return;
        }
        const link = resultado.headers.get('Link');
        this.itens.set(resultado.data);
        this.anterior.set(extractPrevCursor(link));
        this.proximo.set(extractNextCursor(link));
      },
      error: () => {
        this.carregando.set(false);
        this.recusar({
          type: 'about:blank',
          title: 'Não foi possível carregar a lista. Tente novamente.',
          status: 0,
          code: CLIENT_PROBLEM_CODES.UNEXPECTED_RESPONSE,
          traceId: '',
        });
      },
    });
  }

  private recusar(problema: ProblemDetails): void {
    this.problema.set(problema);
    this.itens.set([]);
    this.anterior.set(null);
    this.proximo.set(null);
  }

  proxima(): void {
    const cursor = this.proximo();
    if (cursor !== null && !this.carregando()) this.carregar({ cursor, direction: 'next' });
  }

  voltar(): void {
    const cursor = this.anterior();
    if (cursor !== null && !this.carregando()) this.carregar({ cursor, direction: 'prev' });
  }
}
