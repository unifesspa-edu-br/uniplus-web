import { Injectable, inject } from '@angular/core';
import { type Observable, tap } from 'rxjs';
import { type ApiResult, ChaveDeSubstituicao } from '@uniplus/shared-core/http';
import {
  type AvaliacaoDaInscricaoDto,
  type AvaliacaoDaInscricaoRequest,
  type ReciboDaInscricaoDto,
  type InscricaoDto,
  type InscricaoRequest,
  InscricoesApi,
} from '@uniplus/shared-data/selecao';

import { InscricaoDoCandidatoService } from './inscricao-do-candidato.service';

/** A inscrição do candidato na API do módulo Seleção. */
@Injectable()
export class InscricaoDoCandidatoHttp extends InscricaoDoCandidatoService {
  private readonly api = inject(InscricoesApi);

  /**
   * A chave se repete enquanto o resultado não chega, para o reenvio não gerar outro comprovante, mas só
   * vale para o mesmo processo e corpo: a API recusa a mesma chave com outro corpo (`body_mismatch`).
   */
  private readonly chaveDoEnvio = new ChaveDeSubstituicao();

  iniciar(processoId: string): Observable<ApiResult<InscricaoDto>> {
    return this.api.iniciar(processoId);
  }

  obter(processoId: string): Observable<ApiResult<InscricaoDto>> {
    return this.api.obter(processoId);
  }

  salvar(
    processoId: string,
    request: InscricaoRequest,
    eTag: string,
  ): Observable<ApiResult<InscricaoDto>> {
    return this.api.salvar(processoId, request, eTag);
  }

  avaliar(
    processoId: string,
    request: AvaliacaoDaInscricaoRequest,
  ): Observable<ApiResult<AvaliacaoDaInscricaoDto>> {
    return this.api.avaliar(processoId, request);
  }

  submeter(
    processoId: string,
    request: InscricaoRequest,
    eTag: string,
  ): Observable<ApiResult<ReciboDaInscricaoDto>> {
    const contexto = this.chaveDoEnvio.contextoPara([processoId, request]);
    return this.api.submeter(processoId, request, eTag, contexto).pipe(
      tap((resultado) => {
        if (resultado.ok) this.chaveDoEnvio.renovar();
        else this.chaveDoEnvio.recusada(resultado);
      }),
    );
  }
}
