import { DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Observable, Subscription } from 'rxjs';
import { isApiOk, type ApiResult } from '@uniplus/shared-core/http';

/** O conteúdo de uma resposta da API, ou `null` quando ela falhou. */
export function dadosOuNulo<T>(resultado: ApiResult<T>): T | null {
  return isApiOk(resultado) ? resultado.data : null;
}

interface OrigemDoCatalogo<T> {
  readonly buscar: () => Observable<T | null>;
  readonly aplicar: (dados: T) => void;
  readonly mensagemDeErro: string;
}

/**
 * A busca de um catálogo de referência: estado de carregamento, mensagem de falha e a guarda que
 * impede a mesma rodada de requisições de sair duas vezes quando dois passos pedem o catálogo ao
 * nascer. Uma falha libera a guarda, para a tela oferecer nova tentativa sem recarregar a página.
 *
 * Deve ser criada em contexto de injeção, porque o cancelamento acompanha o ciclo de vida do dono.
 */
export class LeituraDeCatalogo<T> {
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);

  private readonly destroyRef = inject(DestroyRef);
  private iniciada = false;
  private busca?: Subscription;

  constructor(private readonly origem: OrigemDoCatalogo<T>) {}

  /** Busca uma única vez, até que uma falha reabra o caminho. */
  carregar(): void {
    if (this.iniciada) return;
    this.recarregar();
  }

  /** Busca de novo, descartando a resposta de uma busca anterior que ainda esteja em voo. */
  recarregar(): void {
    this.iniciada = true;
    this.carregando.set(true);
    this.erro.set(null);
    this.busca?.unsubscribe();
    this.busca = this.origem
      .buscar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dados) => (dados === null ? this.falhar() : this.concluir(dados)),
        error: () => this.falhar(),
      });
  }

  private concluir(dados: T): void {
    this.origem.aplicar(dados);
    this.carregando.set(false);
  }

  private falhar(): void {
    this.iniciada = false;
    this.erro.set(this.origem.mensagemDeErro);
    this.carregando.set(false);
  }
}
