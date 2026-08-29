import { HttpHeaders } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ApiResult, apiFailure, apiOk } from './api-result';
import { coletarPaginas } from './coletar-paginas';
import { Cursor, createCursor } from './pagination';

function pagina(dados: readonly string[], proximo?: string): ApiResult<readonly string[]> {
  const headers = new HttpHeaders(
    proximo === undefined ? {} : { Link: `</api/x?cursor=${proximo}>; rel="next"` },
  );
  return apiOk<readonly string[]>(dados, 200, headers);
}

describe('coletarPaginas', () => {
  it('entrega a única página quando não há próxima', async () => {
    const consulta = vi.fn(() => of(pagina(['a', 'b'])));

    const resultado = await firstValueFrom(coletarPaginas(consulta));

    expect(resultado.ok && resultado.data).toEqual(['a', 'b']);
    expect(consulta).toHaveBeenCalledTimes(1);
    expect(consulta).toHaveBeenCalledWith(undefined);
  });

  it('segue o cursor até o fim e concatena na ordem das páginas', async () => {
    const consulta = vi.fn((cursor?: Cursor) => {
      if (cursor === undefined) return of(pagina(['a'], 'p2'));
      if (cursor === createCursor('p2')) return of(pagina(['b'], 'p3'));
      return of(pagina(['c']));
    });

    const resultado = await firstValueFrom(coletarPaginas(consulta));

    expect(resultado.ok && resultado.data).toEqual(['a', 'b', 'c']);
    expect(consulta).toHaveBeenCalledTimes(3);
  });

  /**
   * Entregar o que veio até aqui descreveria um catálogo menor do que o real,
   * e a tela ofereceria menos opções sem que ninguém percebesse.
   */
  it('interrompe na primeira recusa e não entrega coleção parcial', async () => {
    const recusa = apiFailure(
      { type: 'about:blank', title: 'Indisponível', status: 503 },
      503,
      new HttpHeaders(),
    );
    const consulta = vi.fn((cursor?: Cursor) =>
      cursor === undefined ? of(pagina(['a'], 'p2')) : of(recusa),
    );

    const resultado = await firstValueFrom(coletarPaginas(consulta));

    expect(resultado.ok).toBe(false);
    expect(consulta).toHaveBeenCalledTimes(2);
  });

  it('não busca nada além da página vazia', async () => {
    const consulta = vi.fn(() => of(pagina([])));

    const resultado = await firstValueFrom(coletarPaginas(consulta));

    expect(resultado.ok && resultado.data).toEqual([]);
    expect(consulta).toHaveBeenCalledTimes(1);
  });
});
