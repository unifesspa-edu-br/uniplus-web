import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { AUTORIZACAO_BASE_PATH } from './tokens';

/*
 * TODO(uniplus-api#2367): as providências sobre concessões seguem o contrato do PR uniplus-api#2405
 * e ainda não vêm do codegen. Depois do merge, `npm run generate:api` as traz no `schema.ts`, e
 * este bloco passa a apontar para ele.
 */

type IdentidadeDto = components['schemas']['IdentidadeDto'];

/** O que a providência pede: a retirada do acesso ou a revisão dele. */
export type TipoDaProvidencia = 'retirada' | 'revisao';

/**
 * Aberta, respondida e atendida são gravadas; prejudicada é a aberta cuja concessão deixou de valer
 * por outro caminho, calculada na leitura.
 */
export type SituacaoDaProvidencia = 'aberta' | 'respondida' | 'atendida' | 'prejudicada';

/** O filtro da fila: uma situação ou todas; sem filtro, a API lista as abertas. */
export type FiltroDaSituacaoDaProvidencia = SituacaoDaProvidencia | 'todas';

/** O que encerrou a concessão da providência prejudicada: o primeiro fato, revogação ou vencimento. */
export type CausaDoEncerramento = 'revogada' | 'vencida';

export interface ConcessaoDaProvidenciaDto {
  readonly id: string;
  readonly beneficiario: IdentidadeDto;
  readonly perfil: components['schemas']['PerfilResumoDto'];
  readonly escopo: components['schemas']['EscopoDto'];
  readonly validaAte: string | null;
  readonly ativa: boolean;
}

export interface EncerramentoDaConcessaoDto {
  readonly causa: CausaDoEncerramento;
  readonly em: string;
}

/** Quem respondeu ou atendeu, e quando; o motivo só vem no detalhe. */
export interface AtoDoDesfechoDto {
  readonly em: string;
  readonly por: IdentidadeDto;
}

export interface DesfechoDaProvidenciaDto extends AtoDoDesfechoDto {
  readonly motivo: string;
}

/** A providência na fila: sem o fundamento e sem o motivo do desfecho. */
export interface ProvidenciaResumoDto {
  readonly id: string;
  readonly tipo: TipoDaProvidencia;
  readonly situacao: SituacaoDaProvidencia;
  readonly abertaEm: string;
  readonly solicitadaPor: IdentidadeDto;
  readonly concessao: ConcessaoDaProvidenciaDto;
  readonly encerramentoDaConcessao: EncerramentoDaConcessaoDto | null;
  readonly desfecho: AtoDoDesfechoDto | null;
  /** Quem lê é quem solicitou ou o beneficiário da concessão: não responde nem atende. */
  readonly impedidoDeResponder: boolean;
}

export interface ProvidenciaDto extends Omit<ProvidenciaResumoDto, 'desfecho'> {
  readonly fundamento: string;
  readonly desfecho: DesfechoDaProvidenciaDto | null;
}

export interface SolicitarProvidenciaRequest {
  readonly concessaoId: string;
  readonly tipo: TipoDaProvidencia;
  readonly fundamento: string;
}

export interface ResponderProvidenciaRequest {
  readonly motivo: string;
}

/** O atendimento revoga a concessão: pede o e-mail do beneficiário, como a revogação comum. */
export interface AtenderProvidenciaRequest {
  readonly motivo: string;
  readonly confirmacaoEmail: string;
}

/** Cliente das escritas das providências; as leituras vão pela fila e pelo detalhe, com cursor. */
@Injectable({ providedIn: 'root' })
export class ProvidenciasApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);

  /** POST `/api/autorizacao/providencias` — abre a providência sobre a concessão. */
  solicitar(
    request: SolicitarProvidenciaRequest,
    context: HttpContext,
  ): Observable<ApiResult<ProvidenciaDto>> {
    return this.http.post<ApiResult<ProvidenciaDto>>(this.url(), request, { context });
  }

  /** POST `.../providencias/{id}/resposta` — responde com motivo, sem revogar. */
  responder(
    id: string,
    request: ResponderProvidenciaRequest,
    context: HttpContext,
  ): Observable<ApiResult<ProvidenciaDto>> {
    return this.http.post<ApiResult<ProvidenciaDto>>(this.url(id, 'resposta'), request, {
      context,
    });
  }

  /** POST `.../providencias/{id}/atendimento` — atende e revoga a concessão na mesma operação. */
  atender(
    id: string,
    request: AtenderProvidenciaRequest,
    context: HttpContext,
  ): Observable<ApiResult<ProvidenciaDto>> {
    return this.http.post<ApiResult<ProvidenciaDto>>(this.url(id, 'atendimento'), request, {
      context,
    });
  }

  private url(id?: string, acao?: string): string {
    const base = `${this.basePath}/api/autorizacao/providencias`;
    if (id === undefined) return base;
    return `${base}/${encodeURIComponent(id)}/${acao}`;
  }
}
