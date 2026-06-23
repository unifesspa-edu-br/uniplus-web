import { HttpParams } from '@angular/common/http';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { GEO_BASE_PATH } from './tokens';

/** Endereço resolvido pelo DNE dos Correios a partir de um CEP (módulo Geo). */
export type CepResolvidoDto = components['schemas']['CepResolvidoDto'];
/** Logradouro alternativo devolvido quando o CEP resolve a uma faixa. */
export type LogradouroAlternativoDto = components['schemas']['LogradouroAlternativoDto'];
/** Cidade no formato resumido do seletor (`GET /api/cidades`). */
export type CidadeResumoDto = components['schemas']['CidadeResumoDto'];

/**
 * Nível até onde o DNE resolveu o CEP — governa, no formulário de endereço,
 * quais campos vêm como âncora (read-only) e quais ficam editáveis (entrada
 * manual). Cascata: `logradouro` (mais específico) → `bairro` → `distrito` →
 * `cidade` (faixa/CEP único de município). O contrato expõe `nivelResolucao`
 * como `string`; este union é o roster conhecido para o front decidir o
 * comportamento, tolerando valores fora dele como o nível mais raso.
 */
export type NivelResolucao = 'logradouro' | 'bairro' | 'distrito' | 'cidade';

/** Roster ordenado do mais específico ao mais raso (cascata do DNE). */
export const NIVEIS_RESOLUCAO: readonly NivelResolucao[] = [
  'logradouro',
  'bairro',
  'distrito',
  'cidade',
] as const;

/** Filtro do seletor de cidade do fluxo "sem CEP" (`GET /api/cidades`). */
export interface CidadesFiltro {
  /** Sigla da UF (2 letras) — restringe a busca a um estado. */
  readonly uf?: string;
  /** Termo de busca textual por nome da cidade. */
  readonly q?: string;
  /** Tamanho da janela (cursor pagination, ADR-0026). */
  readonly limit?: number;
}

/**
 * Cliente Angular standalone do módulo Geo. Expõe a resolução de endereço por
 * CEP (autofill) e o seletor de cidades (fluxo manual, sem CEP) consumidos pelo
 * componente de endereço estruturado (`ui-endereco-form`).
 *
 * API thin (ADR-0013): tipos vêm do `schema.ts` gerado, a resposta é envelopada
 * em `ApiResult<T>` pelo `apiResultInterceptor` (ADR-0011) — não lança; o caller
 * decide o fluxo lendo `result.ok`/`result.status` (ex.: 404 = CEP inexistente).
 * Versionamento por vendor MIME (ADR-0016/0028): `withVendorMime('cep', 1)` e
 * `withVendorMime('cidade', 1)` — os endpoints respondem 406 sem o Accept
 * versionado correto.
 */
@Injectable({ providedIn: 'root' })
export class GeoApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(GEO_BASE_PATH);

  /**
   * GET `/api/cep/{cep}` — resolve um CEP (8 dígitos, sem máscara) ao endereço
   * estruturado do DNE. O `apiResultInterceptor` envelopa o 404 (CEP não
   * encontrado) e o 400 (formato inválido) como `ApiFailure` — o caller trata
   * inline sem `try/catch`.
   */
  obterCep(cep: string): Observable<ApiResult<CepResolvidoDto>> {
    const normalizado = cep.replace(/\D/g, '');
    return this.http.get<ApiResult<CepResolvidoDto>>(
      `${this.basePath}/api/cep/${encodeURIComponent(normalizado)}`,
      { context: withVendorMime('cep', 1) },
    );
  }

  /**
   * GET `/api/cidades` — lista cidades para o seletor direto do fluxo "sem CEP"
   * (CA-02). Aceita `uf`, `q` (busca textual) e `limit`; devolve `CidadeResumoDto`
   * com `codigoIbge`/`nome`/`uf` — os campos que viram a `CidadeReferenciaInput`
   * dos commands.
   */
  listarCidades(filtro: CidadesFiltro = {}): Observable<ApiResult<readonly CidadeResumoDto[]>> {
    let params = new HttpParams();
    if (filtro.uf && filtro.uf.trim().length > 0) {
      params = params.set('uf', filtro.uf.trim().toUpperCase());
    }
    if (filtro.q && filtro.q.trim().length > 0) {
      params = params.set('q', filtro.q.trim());
    }
    if (filtro.limit !== undefined) {
      params = params.set('limit', String(filtro.limit));
    }
    return this.http.get<ApiResult<readonly CidadeResumoDto[]>>(`${this.basePath}/api/cidades`, {
      params,
      context: withVendorMime('cidade', 1),
    });
  }
}
