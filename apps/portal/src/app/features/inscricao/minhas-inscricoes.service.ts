import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { forkJoin, map, type Observable, of, switchMap } from 'rxjs';
import { type ApiOk, type ApiResult } from '@uniplus/shared-core/http';
import {
  certamePublicoRequest,
  type CertamePublicadoDto,
  type ComprovanteInscricaoDto,
  type FormularioRenderizavelDto,
  InscricoesApi,
  type MinhaInscricaoDto,
  SELECAO_BASE_PATH,
} from '@uniplus/shared-data/selecao';

/** Uma inscrição do candidato com o processo como o certame publicado o mostra; nulo se não estiver publicado. */
export interface InscricaoDaLista extends MinhaInscricaoDto {
  readonly processo: CertamePublicadoDto | null;
}

/** Um comprovante e a ordem da submissão que o emitiu, a contar de 1. */
export interface ComprovanteNumerado {
  readonly numero: number;
  readonly comprovante: ComprovanteInscricaoDto;
}

/** As inscrições do candidato e os comprovantes de cada uma. */
@Injectable({ providedIn: 'root' })
export class MinhasInscricoesService {
  private readonly api = inject(InscricoesApi);
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(SELECAO_BASE_PATH);

  listar(): Observable<ApiResult<readonly InscricaoDaLista[]>> {
    return this.api.minhas().pipe(
      switchMap((minhas) => {
        if (!minhas.ok) return of(minhas);
        if (minhas.data.length === 0) return of({ ...minhas, data: [] });
        return forkJoin(minhas.data.map((i) => this.certame(i.processoSeletivoId))).pipe(
          map((certames) => ({
            ...minhas,
            data: minhas.data.map((inscricao, i) => ({ ...inscricao, processo: certames[i] })),
          })),
        );
      }),
    );
  }

  /** O certame publicado do processo; nulo quando não está publicado. */
  certame(processoId: string): Observable<CertamePublicadoDto | null> {
    const { url, context } = certamePublicoRequest(this.basePath, processoId);
    return this.http
      .get<ApiResult<CertamePublicadoDto>>(url, { context })
      .pipe(map((certame) => (certame.ok ? certame.data : null)));
  }

  /** O formulário da versão que a inscrição fixou: dá os rótulos do que o comprovante mostra. */
  formulario(processoId: string): Observable<ApiResult<FormularioRenderizavelDto>> {
    return this.api.obterFormulario(processoId);
  }

  comprovante(processoId: string, numero: number): Observable<ApiResult<ComprovanteNumerado>> {
    return this.api
      .obterComprovante(processoId, numero)
      .pipe(
        map((resultado) =>
          resultado.ok
            ? { ...resultado, data: { numero, comprovante: resultado.data } }
            : resultado,
        ),
      );
  }

  /**
   * O comprovante da última submissão. O contrato não diz quantos há: lê em ordem até o primeiro que
   * falta.
   */
  comprovanteMaisRecente(processoId: string): Observable<ApiResult<ComprovanteNumerado>> {
    return this.aPartirDe(processoId, 1, null);
  }

  private aPartirDe(
    processoId: string,
    numero: number,
    anterior: ApiOk<ComprovanteNumerado> | null,
  ): Observable<ApiResult<ComprovanteNumerado>> {
    return this.comprovante(processoId, numero).pipe(
      switchMap((resultado) => {
        if (resultado.ok) return this.aPartirDe(processoId, numero + 1, resultado);
        return of(resultado.status === 404 && anterior ? anterior : resultado);
      }),
    );
  }
}
