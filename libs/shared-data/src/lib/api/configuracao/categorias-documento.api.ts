import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type CategoriaDocumentoDto = components['schemas']['CategoriaDocumentoDto'];

/**
 * Cliente Angular standalone do catálogo de Categoria de Documento (módulo
 * Configuração). Classifica os Tipos de Documento e é referenciado por eles
 * pelo `codigo` — não por chave estrangeira —, o que mantém a remoção de uma
 * categoria livre e faz o rótulo ser resolvido por lookup na tela.
 *
 * API thin (ADR-0013): tipos do `schema.ts` gerado; resposta envelopada em
 * `ApiResult<T>` (ADR-0011); versionamento por vendor MIME
 * `categoria-documento v1` (ADR-0016/0028).
 */
@Injectable({ providedIn: 'root' })
export class CategoriasDocumentoApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /**
   * GET `/api/configuracao/categorias-documento` — catálogo inteiro, na ordem
   * de exibição decidida pelo operador.
   *
   * Conjunto de referência fechado e de baixo volume: o backend não pagina
   * este recurso, então não há cursor a seguir nem `limit` a informar.
   */
  listar(): Observable<ApiResult<readonly CategoriaDocumentoDto[]>> {
    return this.http.get<ApiResult<readonly CategoriaDocumentoDto[]>>(
      `${this.basePath}/api/configuracao/categorias-documento`,
      { context: withVendorMime('categoria-documento', 1) },
    );
  }
}
