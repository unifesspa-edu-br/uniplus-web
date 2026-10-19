import { Injectable, inject } from '@angular/core';
import { type Observable, tap } from 'rxjs';
import { type ApiResult } from '@uniplus/shared-core/http';
import {
  deveRotacionarIdempotencyKey,
  idempotencyKey,
  withIdempotencyKey,
} from '@uniplus/shared-core/idempotency';
import {
  type AvaliacaoDaInscricaoDto,
  type AvaliacaoDaInscricaoRequest,
  type ComprovanteInscricaoDto,
  type FormularioRenderizavelDto,
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
   * O envio em curso: a chave e a assinatura do corpo que ela acompanha. A chave se repete enquanto o
   * resultado não chega, para o reenvio não gerar outro comprovante, mas só vale para o mesmo corpo: a
   * API recusa a mesma chave com outro corpo (`body_mismatch`). Trocada também quando a regra de
   * idempotência pede.
   */
  private envioEmCurso: { readonly chave: string; readonly assinatura: string } | null = null;

  iniciar(processoId: string): Observable<ApiResult<InscricaoDto>> {
    return this.api.iniciar(processoId);
  }

  obter(processoId: string): Observable<ApiResult<InscricaoDto>> {
    return this.api.obter(processoId);
  }

  obterFormulario(processoId: string): Observable<ApiResult<FormularioRenderizavelDto>> {
    return this.api.obterFormulario(processoId);
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
  ): Observable<ApiResult<ComprovanteInscricaoDto>> {
    const assinatura = assinaturaDoEnvio(processoId, request);
    if (this.envioEmCurso?.assinatura !== assinatura) {
      this.envioEmCurso = { chave: idempotencyKey.create(), assinatura };
    }
    return this.api
      .submeter(processoId, request, eTag, withIdempotencyKey(this.envioEmCurso.chave))
      .pipe(
        tap((resultado) => {
          if (resultado.ok || deveRotacionarIdempotencyKey(resultado.problem)) {
            this.envioEmCurso = null;
          }
        }),
      );
  }
}

/**
 * O processo e o corpo do envio no mesmo texto que vai na requisição: a API compara o hash dos bytes do
 * corpo, então a mesma chave só pode acompanhar o mesmo texto — inclusive na ordem das chaves.
 */
function assinaturaDoEnvio(processoId: string, request: InscricaoRequest): string {
  return JSON.stringify([processoId, request]);
}
