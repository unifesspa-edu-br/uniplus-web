import { Observable, concatMap, of } from 'rxjs';

import { ApiOk, ApiResult, apiOk } from './api-result';
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
  pagina: ConsultaDePagina<T>,
): Observable<ApiResult<readonly T[]>> {
  return coletarAPartir(pagina, undefined, []);
}

type ConsultaDePagina<T> = (cursor?: Cursor) => Observable<ApiResult<readonly T[]>>;

function coletarAPartir<T>(
  pagina: ConsultaDePagina<T>,
  cursor: Cursor | undefined,
  acumulado: readonly T[],
): Observable<ApiResult<readonly T[]>> {
  return pagina(cursor).pipe(
    concatMap((resultado) =>
      resultado.ok ? seguirOuEncerrar(pagina, resultado, acumulado) : of(resultado),
    ),
  );
}

function seguirOuEncerrar<T>(
  pagina: ConsultaDePagina<T>,
  resultado: ApiOk<readonly T[]>,
  acumulado: readonly T[],
): Observable<ApiResult<readonly T[]>> {
  const coletado = [...acumulado, ...resultado.data];
  const proximo = extractNextCursor(resultado.headers.get('Link'));
  return proximo === null
    ? of(apiOk<readonly T[]>(coletado, resultado.status, resultado.headers))
    : coletarAPartir(pagina, proximo, coletado);
}
