import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { PUBLICACOES_BASE_PATH } from './tokens';

export type TipoAtoPublicadoDto = components['schemas']['TipoAtoPublicadoDto'];
export type CriarTipoAtoPublicadoCommand = components['schemas']['CriarTipoAtoPublicadoCommand'];
export type AtualizarTipoAtoPublicadoCommand =
  components['schemas']['AtualizarTipoAtoPublicadoCommand'];

/** Filtro da listagem do catálogo de tipos de ato (cursor opaco, ADR-0026). */
export interface TiposAtoQuery {
  /**
   * Restringe às versões vigentes hoje. **O servidor assume `true`**: omitir o
   * parâmetro devolve apenas as vigentes, não o catálogo inteiro. Para alcançar
   * a série histórica é preciso declarar `false` explicitamente.
   *
   * A distinção decide o que a tela consegue exibir. As opções que o operador
   * pode escolher são as vigentes; mas um processo já configurado pode
   * referenciar um código cuja versão encerrou, e resolvê-lo pelo padrão
   * devolveria lista sem ele — rótulo vazio, sem erro nenhum.
   */
  readonly vigentes?: boolean;
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
}

/**
 * Cliente do catálogo de tipos de ato publicado.
 *
 * O catálogo importa fora do momento de publicar: uma fase do cronograma que
 * produz resultado declara **qual ato produz**, e a API resolve esse código
 * contra este catálogo já na gravação do cronograma — não na publicação do
 * edital. Sem ele, nenhuma fase que produz resultado é configurável.
 *
 * Os **quatro** sinalizadores de `TipoAtoPublicadoDto` são dados lidos, nunca
 * ramos de comportamento (ADR-0103 da API): `congelaConfiguracao` diz se o ato
 * produz nova versão congelada da configuração, `unicoPorObjeto` se o objeto
 * admite um único ato vivo daquele tipo, `efeitoIrreversivel` se a publicação
 * não pode ser desfeita, e `ehResultado` se o ato determina a situação do
 * candidato — é este que habilita o ciclo recursal, e era o que este texto
 * esquecia. Quem consome não ramifica por código de ato.
 */
@Injectable({ providedIn: 'root' })
export class TiposAtoApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(PUBLICACOES_BASE_PATH);

  /**
   * GET `/api/publicacoes/tipos-ato` — catálogo paginado por cursor opaco.
   *
   * Sem `vigentes`, o parâmetro não viaja e vale o padrão do servidor, que é
   * devolver só as versões vigentes. O cliente repassa a escolha em vez de
   * impor uma, como os demais desta camada.
   */
  listar(query: TiposAtoQuery = {}): Observable<ApiResult<readonly TipoAtoPublicadoDto[]>> {
    let params = new HttpParams();
    if (query.vigentes !== undefined) {
      params = params.set('vigentes', String(query.vigentes));
    }

    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }

    return this.http.get<ApiResult<readonly TipoAtoPublicadoDto[]>>(
      `${this.basePath}/api/publicacoes/tipos-ato`,
      { params, context: withVendorMime('tipo-ato', 1) },
    );
  }

  /**
   * GET `/api/publicacoes/tipos-ato/{codigo}/vigente` — a versão que vale numa
   * data.
   *
   * A vigência é semiaberta, e é ela que decide se um código pode ser
   * referenciado: a API recusa a gravação do cronograma quando o ato declarado
   * não tem versão vigente na data de hoje. `data` existe para conferir uma
   * data diferente; omitida, o servidor usa a de hoje.
   */
  /** GET `/api/publicacoes/tipos-ato/{id}` — uma versão pelo identificador dela. */
  obter(id: string): Observable<ApiResult<TipoAtoPublicadoDto>> {
    return this.http.get<ApiResult<TipoAtoPublicadoDto>>(
      `${this.basePath}/api/publicacoes/tipos-ato/${encodeURIComponent(id)}`,
      { context: withVendorMime('tipo-ato', 1) },
    );
  }

  /**
   * POST `/api/publicacoes/admin/tipos-ato` — nova versão do catálogo.
   *
   * **Exige `Idempotency-Key`**, e por isso recebe o contexto. O `PUT` logo
   * abaixo **não** exige: a ADR-0027 dispensa `PUT` puro, cuja semântica já é
   * idempotente. A assimetria é do contrato, não descuido — mandar o header no
   * `PUT` contraria o que o servidor declara.
   */
  criar(
    command: CriarTipoAtoPublicadoCommand,
    context: HttpContext,
  ): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/publicacoes/admin/tipos-ato`,
      command,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /**
   * PUT `/api/publicacoes/admin/tipos-ato/{id}` — substitui uma versão.
   *
   * O corpo reapresenta o `id`, e o servidor recusa quando ele diverge do que
   * está na rota. O `codigo` é **imutável**: é a identidade da série de
   * vigências, e o agregado recusa qualquer divergência — o payload o
   * reapresenta igual.
   */
  atualizar(
    id: string,
    command: AtualizarTipoAtoPublicadoCommand,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/publicacoes/admin/tipos-ato/${encodeURIComponent(id)}`,
      command,
    );
  }

  /** DELETE `/api/publicacoes/admin/tipos-ato/{id}` — remove uma versão da série. */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/publicacoes/admin/tipos-ato/${encodeURIComponent(id)}`,
    );
  }

  obterVigente(codigo: string, data?: string): Observable<ApiResult<TipoAtoPublicadoDto>> {
    let params = new HttpParams();
    if (data !== undefined) {
      params = params.set('data', data);
    }

    return this.http.get<ApiResult<TipoAtoPublicadoDto>>(
      `${this.basePath}/api/publicacoes/tipos-ato/${encodeURIComponent(codigo)}/vigente`,
      { params, context: withVendorMime('tipo-ato', 1) },
    );
  }
}
