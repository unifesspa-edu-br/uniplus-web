import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable, tap } from 'rxjs';
import { type ApiResult } from '@uniplus/shared-core/http';
import {
  deveRotacionarIdempotencyKey,
  idempotencyKey,
  withIdempotencyKey,
} from '@uniplus/shared-core/idempotency';
import {
  certamePublicoRequest,
  type CertamePublicadoDto,
  type ComprovanteInscricaoDto,
  type FormularioRenderizavelDto,
  type InscricaoDto,
  type InscricaoRequest,
  InscricoesApi,
  SELECAO_BASE_PATH,
} from '@uniplus/shared-data/selecao';

import { nomeDaOferta } from '../oferta-da-inscricao';
import {
  InscricaoDoCandidatoService,
  type OfertaDaInscricao,
} from './inscricao-do-candidato.service';

/** A inscrição do candidato na API do módulo Seleção. */
@Injectable()
export class InscricaoDoCandidatoHttp extends InscricaoDoCandidatoService {
  private readonly api = inject(InscricoesApi);
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(SELECAO_BASE_PATH);

  /**
   * A chave do envio em curso. Repetida enquanto o resultado não chega, para o reenvio não gerar outro
   * comprovante; trocada quando a regra de idempotência pede.
   */
  private chaveDoEnvio: string | null = null;

  iniciar(processoId: string): Observable<ApiResult<InscricaoDto>> {
    return this.api.iniciar(processoId);
  }

  obter(processoId: string): Observable<ApiResult<InscricaoDto>> {
    return this.api.obter(processoId);
  }

  obterFormulario(processoId: string): Observable<ApiResult<FormularioRenderizavelDto>> {
    return this.api.obterFormulario(processoId);
  }

  obterOfertas(processoId: string): Observable<ApiResult<readonly OfertaDaInscricao[]>> {
    const { url, context } = certamePublicoRequest(this.basePath, processoId);
    return this.http
      .get<ApiResult<CertamePublicadoDto>>(url, { context })
      .pipe(
        map((certame) => (certame.ok ? { ...certame, data: ofertasDo(certame.data) } : certame)),
      );
  }

  salvar(
    processoId: string,
    request: InscricaoRequest,
    eTag: string,
  ): Observable<ApiResult<InscricaoDto>> {
    return this.api.salvar(processoId, request, eTag);
  }

  submeter(
    processoId: string,
    request: InscricaoRequest,
    eTag: string,
  ): Observable<ApiResult<ComprovanteInscricaoDto>> {
    this.chaveDoEnvio ??= idempotencyKey.create();
    return this.api.submeter(processoId, request, eTag, withIdempotencyKey(this.chaveDoEnvio)).pipe(
      tap((resultado) => {
        if (resultado.ok || deveRotacionarIdempotencyKey(resultado.problem)) {
          this.chaveDoEnvio = null;
        }
      }),
    );
  }
}

function ofertasDo(certame: CertamePublicadoDto): readonly OfertaDaInscricao[] {
  return certame.ofertas.map((o) => ({ id: o.ofertaCursoOrigemId, nome: nomeDaOferta(o) }));
}
