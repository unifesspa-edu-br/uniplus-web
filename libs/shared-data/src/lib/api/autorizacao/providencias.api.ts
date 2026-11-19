import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { AUTORIZACAO_BASE_PATH } from './tokens';

type Esquemas = components['schemas'];

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

export type ConcessaoDaProvidenciaDto = Esquemas['ConcessaoDaProvidenciaDto'];

export type EncerramentoDaConcessaoDto = Omit<Esquemas['EncerramentoDaConcessaoDto'], 'causa'> & {
  readonly causa: CausaDoEncerramento;
};

/** Quem respondeu ou atendeu, e quando; o motivo só vem no detalhe. */
export type AtoDoDesfechoDto = Esquemas['AtoDoDesfechoDto'];
export type DesfechoDaProvidenciaDto = Esquemas['DesfechoDaProvidenciaDto'];

/** Os vocabulários da providência, que o contrato tipa como texto. */
interface VocabulariosDaProvidencia {
  readonly tipo: TipoDaProvidencia;
  readonly situacao: SituacaoDaProvidencia;
  readonly encerramentoDaConcessao: EncerramentoDaConcessaoDto | null;
}

/**
 * A providência na fila: sem o fundamento e sem o motivo do desfecho. `impedidoDeResponder` diz
 * que quem lê é quem solicitou ou o beneficiário da concessão, e não responde nem atende.
 */
export type ProvidenciaResumoDto = Omit<
  Esquemas['ProvidenciaResumoDto'],
  keyof VocabulariosDaProvidencia
> &
  VocabulariosDaProvidencia;

export type ProvidenciaDto = Omit<Esquemas['ProvidenciaDto'], keyof VocabulariosDaProvidencia> &
  VocabulariosDaProvidencia;

/** Os pedidos com os vocabulários estreitados e os campos que a tela sempre manda. */
export type SolicitarProvidenciaRequest = Omit<
  Esquemas['SolicitarProvidenciaRequest'],
  'tipo' | 'fundamento'
> & {
  readonly tipo: TipoDaProvidencia;
  readonly fundamento: string;
};

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
