import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type ApiResult } from '@uniplus/shared-core/http';
import {
  certamePublicoRequest,
  type CertamePublicadoDto,
  SELECAO_BASE_PATH,
} from '@uniplus/shared-data/selecao';
import { forkJoin, map, type Observable, of } from 'rxjs';

import { type CertameParaPublicacoes, montarPublicacaoMock } from './publicacoes.mock';
import type { Publicacao } from './publicacoes.model';

export type { CertameParaPublicacoes } from './publicacoes.mock';

/**
 * Acesso às Publicações — enquanto a consulta pública da linha do tempo não existe
 * (uniplus-api#1497/uniplus-api#1498), a linha do tempo de cada certame é simulada
 * (`publicacoes.mock.ts`), e só o PDF do edital vem do certame publicado. Quando a consulta
 * existir, só este repositório muda, sem tocar em quem o consome.
 */
@Injectable({ providedIn: 'root' })
export class PublicacoesRepository {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(SELECAO_BASE_PATH);

  /**
   * Publicações dos certames de uma página da vitrine, indexadas por `processoSeletivoId`. O
   * certame que não responde fica sem o PDF do edital, sem derrubar os demais.
   */
  buscarPorCertames(
    certames: readonly CertameParaPublicacoes[],
  ): Observable<ReadonlyMap<string, Publicacao>> {
    if (certames.length === 0) return of(new Map());
    return forkJoin(
      certames.map((certame) =>
        this.enderecoDoEdital(certame.processoSeletivoId).pipe(
          map((documentoUrl) => montarPublicacaoMock(certame, documentoUrl)),
        ),
      ),
    ).pipe(
      map((publicacoes) => new Map(publicacoes.map((publicacao) => [publicacao.id, publicacao]))),
    );
  }

  private enderecoDoEdital(processoSeletivoId: string): Observable<string | undefined> {
    const { url, context } = certamePublicoRequest(this.basePath, processoSeletivoId);
    return this.http.get<ApiResult<CertamePublicadoDto>>(url, { context }).pipe(
      map((certame) => (certame.ok ? certame.data.documentoEdital?.urlDownload : undefined)),
    );
  }
}
