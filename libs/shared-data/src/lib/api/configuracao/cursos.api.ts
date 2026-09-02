import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type CursoDto = components['schemas']['CursoDto'];
export type CriarCursoCommand = components['schemas']['CriarCursoCommand'];
export type AtualizarCursoCommand = components['schemas']['AtualizarCursoCommand'];

/** Opção de Grupo de área do ENEM (domínio fechado, Res. INEP/ENEM 805/2024, Anexo I). */
export interface GrupoAreaEnemOption {
  readonly value: string;
  readonly label: string;
}

/** Os quatro grupos de área do ENEM — vocabulário de referência (não enum compilado no backend). */
export const GRUPOS_AREA_ENEM: readonly GrupoAreaEnemOption[] = [
  { value: 'Tecnológica', label: 'Tecnológica' },
  { value: 'Humanística I', label: 'Humanística I' },
  { value: 'Humanística II', label: 'Humanística II' },
  { value: 'Saúde e Biológicas', label: 'Saúde e Biológicas' },
] as const;

/** Colunas ordenáveis da listagem de Cursos (impl. provisória no backend). */
export type CursosOrdenarPor = 'nome' | 'codigo';

/** Filtro de listagem de Cursos (cursor pagination, ADR-0026). */
export interface CursosQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
  /**
   * Ordenação keyset por coluna; omitido = ordem padrão (por `Id`). Só vale na
   * primeira página — o cursor carrega a âncora `(chave, Id)` e a ordem
   * (espelha o `limit`, ADR-0026). Valor fora do vocabulário → 400.
   */
  readonly ordenarPor?: CursosOrdenarPor;
  /** Sentido; só tem efeito com `ordenarPor`. Padrão do backend: `asc`. */
  readonly ordem?: 'asc' | 'desc';
}

/**
 * Cliente Angular standalone do recurso Curso (módulo Configuração). Curso é a
 * matriz curricular pura — código, nome, grau, nível de ensino e grupo de área
 * do ENEM opcional; não carrega e-MEC, local nem unidade ofertante (isso é
 * `OfertaCurso`, ADR-0066).
 *
 * API thin (ADR-0013): tipos do `schema.ts` gerado; resposta envelopada em
 * `ApiResult<T>` (ADR-0011); versionamento por vendor MIME `curso v1`
 * (ADR-0016/0028). Espelha `CampiApi`/`LocaisOfertaApi`.
 */
@Injectable({ providedIn: 'root' })
export class CursosApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/configuracao/cursos` — lista paginada por cursor (ADR-0026). */
  listar(query: CursosQuery = {}): Observable<ApiResult<readonly CursoDto[]>> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
      if (query.ordenarPor !== undefined) {
        params = params.set('ordenarPor', query.ordenarPor);
        if (query.ordem !== undefined) {
          params = params.set('ordem', query.ordem);
        }
      }
    }
    return this.http.get<ApiResult<readonly CursoDto[]>>(`${this.basePath}/api/configuracao/cursos`, {
      params,
      context: withVendorMime('curso', 1),
    });
  }

  /** GET `/api/configuracao/cursos/{id}` — detalhe de um Curso. */
  obter(id: string): Observable<ApiResult<CursoDto>> {
    return this.http.get<ApiResult<CursoDto>>(
      `${this.basePath}/api/configuracao/cursos/${encodeURIComponent(id)}`,
      { context: withVendorMime('curso', 1) },
    );
  }

  /** POST `/api/configuracao/admin/cursos` — cria um Curso. Idempotency-Key obrigatório (ADR-0027). */
  criar(command: CriarCursoCommand, context: HttpContext): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(`${this.basePath}/api/configuracao/admin/cursos`, command, {
      context,
      headers: new HttpHeaders({ Accept: 'application/json' }),
    });
  }

  /** PUT `/api/configuracao/admin/cursos/{id}` — atualiza um Curso. */
  atualizar(
    id: string,
    command: AtualizarCursoCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/cursos/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  /** DELETE `/api/configuracao/admin/cursos/{id}` — remoção lógica (soft-delete); 409 se referenciado por oferta viva. */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/cursos/${encodeURIComponent(id)}`,
    );
  }
}
