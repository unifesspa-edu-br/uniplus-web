import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { rotasDoProcesso } from './rotas-do-processo';
import { SELECAO_BASE_PATH } from './tokens';

export type MotivoDeDecisaoDoProcessoDto = components['schemas']['MotivoDeDecisaoDoProcessoDto'];

/**
 * Cliente dos motivos de decisão que o processo seletivo escolhe do cadastro, em cada fase
 * (UNI-REQ-0285). A escolha grava na hora, sem passar pelo cronograma, e só vale em rascunho: depois
 * da publicação nada do que foi publicado se retira.
 *
 * A leitura e a escrita exigem a permissão de configurar o processo. A escrita exige
 * `Idempotency-Key`; nenhum dos dois comandos leva corpo.
 *
 * API thin (ADR-0013): tipos do `schema.ts` gerado; resposta envelopada em `ApiResult<T>`
 * (ADR-0011); versionamento por vendor MIME `motivo-do-processo v1` (ADR-0016).
 */
@Injectable({ providedIn: 'root' })
export class MotivosDoProcessoApi {
  private readonly http = inject(HttpClient);
  private readonly rotas = rotasDoProcesso(inject(SELECAO_BASE_PATH));

  /**
   * GET `/api/selecao/processos-seletivos/{id}/motivos-de-decisao` — os motivos escolhidos pelo
   * processo em todas as fases e etapas, cada um com o lugar onde foi escolhido.
   */
  listar(processoId: string): Observable<ApiResult<readonly MotivoDeDecisaoDoProcessoDto[]>> {
    return this.http.get<ApiResult<readonly MotivoDeDecisaoDoProcessoDto[]>>(
      this.rotas.doProcesso(processoId, 'motivos-de-decisao'),
      { context: withVendorMime('motivo-do-processo', 1) },
    );
  }

  /**
   * PUT `/api/selecao/processos-seletivos/{id}/fases/{faseCanonicaOrigemId}/motivos-de-decisao/{motivoId}`
   * — inclui na fase o motivo do cadastro. Responde 204. Recusas: 409 quando a fase já o escolheu,
   * 404 quando a fase ainda não está gravada no processo, 422 para motivo desativado ou processo
   * fora de rascunho.
   */
  incluirNaFase(
    processoId: string,
    faseCanonicaOrigemId: string,
    motivoDeDecisaoId: string,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.put<ApiResult<void>>(
      this.rotaDaFase(processoId, faseCanonicaOrigemId, motivoDeDecisaoId),
      null,
      { context },
    );
  }

  /**
   * DELETE `/api/selecao/processos-seletivos/{id}/fases/{faseCanonicaOrigemId}/motivos-de-decisao/{motivoId}`
   * — retira da fase o motivo escolhido. Responde 204. A recusa por motivo que a fase não escolheu
   * chega como 404.
   */
  retirarDaFase(
    processoId: string,
    faseCanonicaOrigemId: string,
    motivoDeDecisaoId: string,
    context: HttpContext,
  ): Observable<ApiResult<void>> {
    return this.http.delete<ApiResult<void>>(
      this.rotaDaFase(processoId, faseCanonicaOrigemId, motivoDeDecisaoId),
      { context },
    );
  }

  private rotaDaFase(
    processoId: string,
    faseCanonicaOrigemId: string,
    motivoDeDecisaoId: string,
  ): string {
    return this.rotas.doProcesso(
      processoId,
      'fases',
      faseCanonicaOrigemId,
      'motivos-de-decisao',
      motivoDeDecisaoId,
    );
  }
}
