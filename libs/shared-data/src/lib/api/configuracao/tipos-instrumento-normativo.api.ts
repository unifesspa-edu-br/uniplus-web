import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import { TipoInstrumentoNormativoCodigo, type components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type TipoInstrumentoNormativoComDescricao =
  components['schemas']['TipoInstrumentoNormativoComDescricao'];
export type TipoInstrumentoNormativo = components['schemas']['TipoInstrumentoNormativo'];
export { TipoInstrumentoNormativoCodigo };

/**
 * Cliente Angular standalone do vocabulário fechado de Tipo de Instrumento
 * Normativo (módulo Configuração) — os tipos de documento formal que uma Base
 * Legal do Fator de Atenuação das Desigualdades de Acesso pode referenciar, cada um com código, rótulo e
 * descrição. Vocabulário derivado de enum no backend, não cadastro: o front
 * não duplica a lista nem escreve rótulo.
 *
 * API thin (ADR-0013): tipos do `schema.ts` gerado; resposta envelopada em
 * `ApiResult<T>` (ADR-0011); versionamento por vendor MIME
 * `codigo-tipo-instrumento-normativo v1` (ADR-0016/0028).
 */
@Injectable({ providedIn: 'root' })
export class TiposInstrumentoNormativoApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /**
   * GET `/api/configuracao/vocabularios/tipos-instrumento-normativo` — os
   * tipos, na ordem de declaração do enum. Conjunto fechado: sem paginação.
   */
  listar(): Observable<ApiResult<readonly TipoInstrumentoNormativoComDescricao[]>> {
    return this.http.get<ApiResult<readonly TipoInstrumentoNormativoComDescricao[]>>(
      `${this.basePath}/api/configuracao/vocabularios/tipos-instrumento-normativo`,
      { context: withVendorMime('codigo-tipo-instrumento-normativo', 1) },
    );
  }
}
