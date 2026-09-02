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
 * Rosters dos quatro domínios fechados de Oferta de Curso — tokens UPPER_SNAKE
 * persistidos e aceitos pelo contrato (ver `ProgramasDeOferta`/`FormatosPedagogicos`/
 * `TurnosOferta`/`RegimesDeTurno` em `Unifesspa.UniPlus.Configuracao.Domain.Enums`,
 * uniplus-api).
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

/**
 * Períodos do dia em que a oferta funciona, na ordem canônica que a API devolve
 * (UNI-REQ-0137). `INTEGRAL` não está aqui: deixou de ser turno e virou regime
 * — ver `REGIMES_DE_TURNO`.
 */
export const TURNOS_OFERTA: readonly TurnoOfertaOption[] = [
  { value: 'MATUTINO', label: 'Matutino' },
  { value: 'VESPERTINO', label: 'Vespertino' },
  { value: 'NOTURNO', label: 'Noturno' },
] as const;

export interface RegimeDeTurnoOption {
  readonly value: string;
  readonly label: string;
  /** Quantidade exata de turnos distintos que o regime exige. */
  readonly turnosExigidos: number;
  readonly descricao: string;
}

/**
 * Regime de turno da oferta (UNI-REQ-0137): declara se o curso funciona num
 * único turno ou em dois distintos. É declarado pelo operador, nunca inferido
 * da quantidade marcada — a API recusa a incoerência em vez de promover a
 * oferta a `INTEGRAL` por conta própria.
 */
export const REGIMES_DE_TURNO: readonly RegimeDeTurnoOption[] = [
  {
    value: 'REGULAR',
    label: 'Regular',
    turnosExigidos: 1,
    descricao: 'Funciona em um único turno.',
  },
  {
    value: 'INTEGRAL',
    label: 'Integral',
    turnosExigidos: 2,
    descricao: 'Funciona em dois turnos distintos.',
  },
] as const;

/** Regime de turno padrão de uma oferta nova — um turno só. */
export const REGIME_DE_TURNO_REGULAR = 'REGULAR';


export interface RegimeDeFuncionamentoOption {
  value: string;
  label: string;
}

export const REGIMES_DE_FUNCIONAMENTO: readonly RegimeDeFuncionamentoOption[] = [
  {
    value: 'INTENSIVO',
    label: 'Intensivo',
  },
  {
    value: 'EXTENSIVO',
    label: 'Extensivo',
  },
] as const;

/**
 * Regime de funcionamento padrão de uma oferta nova. `INTENSIVO` não serve como
 * inicial porque exige regime de turno `INTEGRAL`, e o formulário abre em
 * `REGULAR` (UNI-REQ-0138).
 */
export const REGIME_DE_FUNCIONAMENTO_EXTENSIVO = 'EXTENSIVO';

/**
 * Quantos turnos distintos o regime exige, ou `null` quando o token não é um
 * regime conhecido (a API é a árbitra final nesse caso).
 */
export function turnosExigidosPorRegime(regime: string): number | null {
  return REGIMES_DE_TURNO.find((r) => r.value === regime)?.turnosExigidos ?? null;
}

/**
 * Ordena turnos na ordem canônica do dia — matutino, vespertino, noturno —
 * a mesma que a API devolve, para a exibição não oscilar com a ordem de marcação.
 */
export function ordenarTurnosCanonicamente(turnos: readonly string[]): readonly string[] {
  const ordem = new Map(TURNOS_OFERTA.map((t, indice) => [t.value, indice]));
  return [...turnos].sort((a, b) => (ordem.get(a) ?? Number.MAX_SAFE_INTEGER) - (ordem.get(b) ?? Number.MAX_SAFE_INTEGER));
}

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
