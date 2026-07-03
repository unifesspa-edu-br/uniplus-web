import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type OfertaCursoDto = components['schemas']['OfertaCursoDto'];
export type CriarOfertaCursoCommand = components['schemas']['CriarOfertaCursoCommand'];
export type AtualizarOfertaCursoCommand = components['schemas']['AtualizarOfertaCursoCommand'];
export type UnidadeOfertanteDto = components['schemas']['UnidadeOfertanteDto'];

/**
 * Rosters dos três domínios fechados de Oferta de Curso — tokens UPPER_SNAKE
 * persistidos e aceitos pelo contrato (ver `ProgramasDeOferta`/`FormatosPedagogicos`/
 * `TurnosOferta` em `Unifesspa.UniPlus.Configuracao.Domain.Enums`, uniplus-api).
 * Não são enums gerados pelo `openapi-typescript` — os campos chegam como `string`
 * no `schema.ts`; os tokens abaixo são copiados 1:1 do código-fonte do backend.
 */
export interface ProgramaDeOfertaOption {
  readonly value: string;
  readonly label: string;
}

export const PROGRAMAS_DE_OFERTA: readonly ProgramaDeOfertaOption[] = [
  { value: 'REGULAR', label: 'Regular' },
  { value: 'FORMA_PARA', label: 'Forma Pará' },
  { value: 'PARFOR', label: 'PARFOR' },
  { value: 'PRONERA', label: 'PRONERA' },
  { value: 'PEPETI', label: 'PEPETI' },
  { value: 'CONVENIO_OUTRO', label: 'Convênio (outro)' },
  { value: 'OUTRO', label: 'Outro' },
] as const;

/** Token do programa regular — único valor que dispensa Base legal (ADR-0066). */
export const PROGRAMA_DE_OFERTA_REGULAR = 'REGULAR';

export interface FormatoPedagogicoOption {
  readonly value: string;
  readonly label: string;
}

export const FORMATOS_PEDAGOGICOS: readonly FormatoPedagogicoOption[] = [
  { value: 'PRESENCIAL', label: 'Presencial' },
  { value: 'SEMIPRESENCIAL', label: 'Semipresencial' },
  { value: 'EAD', label: 'EAD' },
] as const;

export interface TurnoOfertaOption {
  readonly value: string;
  readonly label: string;
}

export const TURNOS_OFERTA: readonly TurnoOfertaOption[] = [
  { value: 'MATUTINO', label: 'Matutino' },
  { value: 'VESPERTINO', label: 'Vespertino' },
  { value: 'NOTURNO', label: 'Noturno' },
  { value: 'INTEGRAL', label: 'Integral' },
] as const;

/**
 * Filtro de listagem de Ofertas de Curso (cursor pagination, ADR-0026).
 * `cursoId` (opcional, api#755) restringe às ofertas vivas de um curso; viaja
 * como query param e combina com o cursor — reanexado a cada página.
 */
export interface OfertasCursoQuery {
  readonly cursor?: string;
  readonly direction?: 'next' | 'prev';
  readonly limit?: number;
  readonly cursoId?: string;
}

/**
 * Cliente Angular standalone do recurso Oferta de Curso (módulo Configuração).
 * Liga Curso × Local de Oferta × Unidade ofertante — os três são imutáveis
 * pós-criação (ADR-0066); `Atualizar` não os recebe. A Unidade ofertante é
 * snapshot-copy (ADR-0061): o comando de criação envia `unidadeOfertanteOrigemId`
 * (o `id` da Unidade viva a congelar), e a leitura devolve o objeto congelado em
 * `unidadeOfertante` (sigla/nome/tipo).
 *
 * API thin (ADR-0013): tipos do `schema.ts` gerado; resposta envelopada em
 * `ApiResult<T>` (ADR-0011); versionamento por vendor MIME `oferta-curso v1`
 * (ADR-0016/0028). Espelha `LocaisOfertaApi`/`CursosApi`.
 */
@Injectable({ providedIn: 'root' })
export class OfertasCursoApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/configuracao/ofertas-curso` — lista paginada por cursor (ADR-0026). */
  listar(query: OfertasCursoQuery = {}): Observable<ApiResult<readonly OfertaCursoDto[]>> {
    let params = new HttpParams();
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor).set('direction', query.direction ?? 'next');
    } else {
      params = params.set('limit', String(query.limit ?? 100));
    }
    if (query.cursoId !== undefined) {
      params = params.set('cursoId', query.cursoId);
    }
    return this.http.get<ApiResult<readonly OfertaCursoDto[]>>(
      `${this.basePath}/api/configuracao/ofertas-curso`,
      { params, context: withVendorMime('oferta-curso', 1) },
    );
  }

  /** GET `/api/configuracao/ofertas-curso/{id}` — detalhe de uma Oferta de Curso. */
  obter(id: string): Observable<ApiResult<OfertaCursoDto>> {
    return this.http.get<ApiResult<OfertaCursoDto>>(
      `${this.basePath}/api/configuracao/ofertas-curso/${encodeURIComponent(id)}`,
      { context: withVendorMime('oferta-curso', 1) },
    );
  }

  /** POST `/api/configuracao/admin/ofertas-curso` — cria. Idempotency-Key obrigatório (ADR-0027). */
  criar(command: CriarOfertaCursoCommand, context: HttpContext): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(
      `${this.basePath}/api/configuracao/admin/ofertas-curso`,
      command,
      { context, headers: new HttpHeaders({ Accept: 'application/json' }) },
    );
  }

  /** PUT `/api/configuracao/admin/ofertas-curso/{id}` — atualiza os atributos regulatórios editáveis. */
  atualizar(
    id: string,
    command: AtualizarOfertaCursoCommand,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/ofertas-curso/${encodeURIComponent(id)}`,
      command,
      { context },
    );
  }

  /** DELETE `/api/configuracao/admin/ofertas-curso/{id}` — remoção lógica; nunca bloqueada (snapshots são desacoplados, ADR-0061). */
  remover(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      `${this.basePath}/api/configuracao/admin/ofertas-curso/${encodeURIComponent(id)}`,
    );
  }
}
