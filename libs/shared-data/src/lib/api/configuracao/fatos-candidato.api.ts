import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type FatoCandidatoView = components['schemas']['FatoCandidatoView'];
export type FatoValorDominioViewItem = components['schemas']['FatoValorDominioViewItem'];
export type FatoCandidatoDto = components['schemas']['FatoCandidatoDto'];
export type FatoValorDominioDto = components['schemas']['FatoValorDominioDto'];
export type RegraPadraoDto = components['schemas']['RegraPadraoDto'];
export type CriarFatoCandidatoCommand = components['schemas']['CriarFatoCandidatoCommand'];
export type CriarFatoDerivadoCommand = components['schemas']['CriarFatoDerivadoCommand'];
export type CriarFatoAgregadoCommand = components['schemas']['CriarFatoAgregadoCommand'];
export type DescritivoDoFatoInput = components['schemas']['DescritivoDoFatoInput'];
export type RegrasPadraoInput = components['schemas']['RegrasPadraoInput'];
export type ValorDominioInput = components['schemas']['ValorDominioInput'];

/**
 * Cliente do catálogo de fatos do candidato — o vocabulário que formulários, exigências
 * documentais e critérios citam para falar do candidato.
 *
 * O catálogo é administrável (ADR-0136): o administrador cadastra fatos declarados, derivados
 * por regra e agregados de grupo, mantém os valores de domínio e as regras padrão dos derivados.
 * Os fatos de sistema — os que o código resolve, como modalidade e faixa etária — só têm nome e
 * descrição editáveis.
 *
 * A leitura pública (`listar`) devolve o catálogo inteiro na forma que os editores de condição
 * precisam; a administrativa (`obter`, e a listagem paginada da página) devolve o fato completo, com proteção de
 * dados, valores e regras padrão.
 *
 * API thin (ADR-0013): tipos do `schema.ts` gerado; resposta envelopada em `ApiResult<T>`;
 * versionamento por vendor MIME; escritas com Idempotency-Key no `context` (ADR-0027).
 */
@Injectable({ providedIn: 'root' })
export class FatosCandidatoApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  /** GET `/api/configuracao/fatos-candidato` — o catálogo inteiro. Conjunto fechado, sem paginação. */
  listar(): Observable<ApiResult<readonly FatoCandidatoView[]>> {
    return this.http.get<ApiResult<readonly FatoCandidatoView[]>>(
      `${this.basePath}/api/configuracao/fatos-candidato`,
      { context: withVendorMime('fato-candidato', 1) },
    );
  }

  /** GET `/api/configuracao/admin/fatos-candidato/{id}` — o fato completo. */
  obter(id: string): Observable<ApiResult<FatoCandidatoDto>> {
    return this.http.get<ApiResult<FatoCandidatoDto>>(this.admin(id), {
      context: withVendorMime('fato-candidato', 1),
    });
  }

  /** POST `/api/configuracao/admin/fatos-candidato` — cria um fato declarado. */
  criar(command: CriarFatoCandidatoCommand, context: HttpContext): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(this.admin(), command, {
      context,
      headers: ACEITA_JSON,
    });
  }

  /** POST `/api/configuracao/admin/fatos-candidato/derivados` — cria um fato derivado por regra. */
  criarDerivado(
    command: CriarFatoDerivadoCommand,
    context: HttpContext,
  ): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(this.admin('derivados'), command, {
      context,
      headers: ACEITA_JSON,
    });
  }

  /** POST `/api/configuracao/admin/fatos-candidato/agregados` — cria um agregado sobre um campo de grupo. */
  criarAgregado(
    command: CriarFatoAgregadoCommand,
    context: HttpContext,
  ): Observable<ApiResult<string>> {
    return this.http.post<ApiResult<string>>(this.admin('agregados'), command, {
      context,
      headers: ACEITA_JSON,
    });
  }

  /** PUT `/api/configuracao/admin/fatos-candidato/{id}` — altera nome e descrição, os únicos campos editáveis. */
  atualizarDescritivo(
    id: string,
    input: DescritivoDoFatoInput,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(this.admin(id), input, { context });
  }

  /** DELETE `/api/configuracao/admin/fatos-candidato/{id}` — desativa: vínculo novo deixa de aceitar o fato. */
  desativar(id: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(this.admin(id));
  }

  /** POST `/api/configuracao/admin/fatos-candidato/{id}/ativacao` — reativa o fato. */
  ativar(id: string, context: HttpContext): Observable<ApiResult<void>> {
    return this.http.post<ApiResult<void>>(this.admin(id, 'ativacao'), null, { context });
  }

  /** PUT `/api/configuracao/admin/fatos-candidato/{id}/regras-padrao` — substitui as regras padrão do derivado. */
  definirRegrasPadrao(
    id: string,
    input: RegrasPadraoInput,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(this.admin(id, 'regras-padrao'), input, { context });
  }

  /** POST `/api/configuracao/admin/fatos-candidato/{id}/valores` — acrescenta um valor de domínio. */
  acrescentarValor(
    id: string,
    input: ValorDominioInput,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.post<ApiResult<void>>(this.admin(id, 'valores'), input, { context });
  }

  /** DELETE `/api/configuracao/admin/fatos-candidato/{id}/valores/{codigo}` — desativa um valor de domínio. */
  desativarValor(id: string, codigo: string): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(this.admin(id, 'valores', codigo));
  }

  /** POST `/api/configuracao/admin/fatos-candidato/{id}/valores/{codigo}/ativacao` — reativa um valor de domínio. */
  reativarValor(id: string, codigo: string, context: HttpContext): Observable<ApiResult<void>> {
    return this.http.post<ApiResult<void>>(this.admin(id, 'valores', codigo, 'ativacao'), null, {
      context,
    });
  }

  private admin(...segmentos: readonly string[]): string {
    return [
      `${this.basePath}/api/configuracao/admin/fatos-candidato`,
      ...segmentos.map(encodeURIComponent),
    ].join('/');
  }
}

const ACEITA_JSON = new HttpHeaders({ Accept: 'application/json' });
