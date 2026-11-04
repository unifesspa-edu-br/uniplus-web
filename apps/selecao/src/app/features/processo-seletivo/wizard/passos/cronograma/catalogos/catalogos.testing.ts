import { HttpHeaders } from '@angular/common/http';
import { of } from 'rxjs';
import { apiFailure, apiOk } from '@uniplus/shared-core/http';

/** Página única: sem header `Link`, `coletarPaginas` para na primeira. */
export function pagina<T>(dados: readonly T[]) {
  return of(apiOk(dados, 200, new HttpHeaders()));
}

/** Resposta de falha do servidor, no formato que a API devolve. */
export function falhaDoServidor() {
  return of(
    apiFailure(
      { type: 'about:blank', title: 'x', status: 500, code: 'uniplus.erro', traceId: '' },
      500,
      new HttpHeaders(),
    ),
  );
}
