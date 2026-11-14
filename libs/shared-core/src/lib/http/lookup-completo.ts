import { DestroyRef, Signal, signal } from '@angular/core';
import { Observable, Observer, Subscription } from 'rxjs';

import { ApiResult } from './api-result';
import { coletarPaginas } from './coletar-paginas';
import { Cursor } from './pagination';

/**
 * Catálogo completo exposto a um `select` de chave estrangeira: as opções, o
 * sinal de recusa que a tela mostra ao operador e o gatilho de nova tentativa.
 */
export interface LookupCompleto<T> {
  /** Coleção inteira, ou vazia enquanto a busca não terminou ou foi recusada. */
  readonly opcoes: Signal<readonly T[]>;
  /** `true` quando a última tentativa não completou o catálogo. */
  readonly comErro: Signal<boolean>;
  /**
   * `true` enquanto o catálogo não chegou: antes da primeira busca e durante
   * cada tentativa. Distingue "ainda vem" de "chegou e não tem o item" — sem
   * isso, um lookup lazy exibiria "não encontrado" antes de sequer buscar.
   */
  readonly pendente: Signal<boolean>;
  /** Busca de novo, descartando o que estiver em andamento. */
  recarregar(): void;
}

class CatalogoCarregado<T> implements LookupCompleto<T> {
  private readonly _opcoes = signal<readonly T[]>([]);
  private readonly _comErro = signal(false);
  private readonly _pendente = signal(true);
  private emAndamento: Subscription | undefined;

  readonly opcoes = this._opcoes.asReadonly();
  readonly comErro = this._comErro.asReadonly();
  readonly pendente = this._pendente.asReadonly();

  constructor(
    private readonly pagina: (cursor?: Cursor) => Observable<ApiResult<readonly T[]>>,
    destroyRef: DestroyRef,
  ) {
    // O teardown é registrado uma vez, na construção: `takeUntilDestroyed` por
    // chamada precisaria de um `DestroyRef` ainda vivo a cada nova tentativa.
    destroyRef.onDestroy(() => this.emAndamento?.unsubscribe());
  }

  private readonly aoColetar: Observer<ApiResult<readonly T[]>> = {
    next: (resultado) => {
      if (resultado.ok) this._opcoes.set(resultado.data);
      else this._comErro.set(true);
    },
    error: () => {
      this._comErro.set(true);
      this._pendente.set(false);
    },
    complete: () => this._pendente.set(false),
  };

  readonly recarregar = (): void => {
    this.emAndamento?.unsubscribe();
    this._comErro.set(false);
    this._pendente.set(true);
    this.emAndamento = coletarPaginas(this.pagina).subscribe(this.aoColetar);
  };
}

/**
 * Carrega o catálogo inteiro de um `select` de chave estrangeira e mantém o
 * estado que a tela precisa exibir.
 *
 * Cada tentativa cancela a anterior: o botão "Tentar novamente" pode ser
 * clicado à vontade sem que uma resposta atrasada chegue por último e
 * substitua o catálogo por uma versão mais velha. A recusa é sinalizada tanto
 * pelo envelope (`ApiResult` não `ok`) quanto por erro que escape da cadeia,
 * para que o alerta apareça em vez de o erro subir sem tratamento.
 *
 * @param pagina Consulta de uma página. Recebe `undefined` na primeira.
 * @param destroyRef Ciclo de vida do componente que hospeda o lookup.
 */
export function lookupCompleto<T>(
  pagina: (cursor?: Cursor) => Observable<ApiResult<readonly T[]>>,
  destroyRef: DestroyRef,
): LookupCompleto<T> {
  return new CatalogoCarregado(pagina, destroyRef);
}
