import { Observable, concatMap, of } from 'rxjs';

import { ApiResult, apiOk } from './api-result';
import { Cursor, extractNextCursor } from './pagination';

/**
 * Segue o cursor até o fim e entrega a coleção inteira numa emissão.
 *
 * Serve às telas que precisam do catálogo completo para montar uma escolha —
 * um `select` só sabe o que oferecer quando conhece todas as opções. Não
 * substitui a paginação visível de listagens, onde a página é o que o operador
 * navega.
 *
 * A primeira recusa encerra a busca e é entregue como está: uma coleção
 * montada pela metade descreveria um catálogo que não existe, e a tela
 * ofereceria menos opções do que há sem que ninguém notasse.
 *
 * @param pagina Consulta de uma página. Recebe `undefined` na primeira.
 */
export function coletarPaginas<T>(
  pagina: (cursor?: Cursor) => Observable<ApiResult<readonly T[]>>,
): Observable<ApiResult<readonly T[]>> {
  const seguir = (
    cursor: Cursor | undefined,
    acumulado: readonly T[],
  ): Observable<ApiResult<readonly T[]>> =>
    pagina(cursor).pipe(
      concatMap((resultado) => {
        if (!resultado.ok) return of(resultado);

        const coletado = [...acumulado, ...resultado.data];
        const proximo = extractNextCursor(resultado.headers.get('Link'));

        return proximo === null
          ? of(apiOk<readonly T[]>(coletado, resultado.status, resultado.headers))
          : seguir(proximo, coletado);
      }),
    );

  return seguir(undefined, []);
}
