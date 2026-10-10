import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { forkJoin, map, type Observable, of } from 'rxjs';
import { type ApiResult } from '@uniplus/shared-core/http';
import { GeoApi } from '@uniplus/shared-data/geo';
import {
  certamePublicoRequest,
  type CertamePublicadoDto,
  type ComprovanteInscricaoDto,
  type FormularioRenderizavelDto,
  InscricoesApi,
  type MinhaInscricaoDto,
  SELECAO_BASE_PATH,
} from '@uniplus/shared-data/selecao';

/** As inscrições do candidato e os comprovantes de cada uma. */
@Injectable({ providedIn: 'root' })
export class MinhasInscricoesService {
  private readonly api = inject(InscricoesApi);
  private readonly geo = inject(GeoApi);
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(SELECAO_BASE_PATH);

  /** As inscrições do dono do token, cada uma com os comprovantes emitidos, em ordem de emissão. */
  listar(): Observable<ApiResult<readonly MinhaInscricaoDto[]>> {
    return this.api.minhas();
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

  /**
   * Os municípios pelo código IBGE, como "Nome — UF", com uma leitura por código. O que o Geo não
   * devolve fica de fora: quem mostra cai no código.
   */
  nomesDosMunicipios(codigos: readonly string[]): Observable<ReadonlyMap<string, string>> {
    if (codigos.length === 0) return of(new Map());
    return forkJoin(
      codigos.map((codigo) =>
        this.geo
          .obterCidade(codigo)
          .pipe(
            map((cidade) =>
              cidade.ok ? [[codigo, `${cidade.data.nome} — ${cidade.data.uf}`] as const] : [],
            ),
          ),
      ),
    ).pipe(map((nomes) => new Map(nomes.flat())));
  }

  comprovante(processoId: string, numero: number): Observable<ApiResult<ComprovanteInscricaoDto>> {
    return this.api.obterComprovante(processoId, numero);
  }
}
