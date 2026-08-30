import { DestroyRef, Signal, signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

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
  const opcoes = signal<readonly T[]>([]);
  const comErro = signal(false);
  const pendente = signal(true);
  let emAndamento: Subscription | undefined;

  // O teardown é registrado uma vez, na construção: `takeUntilDestroyed` por
  // chamada precisaria de um `DestroyRef` ainda vivo a cada nova tentativa.
  destroyRef.onDestroy(() => emAndamento?.unsubscribe());

  const recarregar = (): void => {
    emAndamento?.unsubscribe();
    comErro.set(false);
    pendente.set(true);
    emAndamento = coletarPaginas(pagina).subscribe({
      next: (resultado) => {
        if (!resultado.ok) {
          comErro.set(true);
          return;
        }
        opcoes.set(resultado.data);
      },
      error: () => {
        comErro.set(true);
        pendente.set(false);
      },
      complete: () => pendente.set(false),
    });
  };

  return {
    opcoes: opcoes.asReadonly(),
    comErro: comErro.asReadonly(),
    pendente: pendente.asReadonly(),
    recarregar,
  };
}
