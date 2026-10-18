import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type ApiResult } from '@uniplus/shared-core/http';
import {
  certamePublicoDoPortalRequest,
  type CertamePublicoResponse,
  type EventoDaLinhaDoTempoResponse,
  PORTAL_BASE_PATH,
} from '@uniplus/shared-data/portal';
import type { CertameNaVitrineDto } from '@uniplus/shared-data/selecao';
import { forkJoin, map, type Observable, of } from 'rxjs';

import { paraDocumentos } from './documento-da-publicacao';
import type { PublicacaoDoCertame, PublicacoesDoCertame } from './publicacoes.model';

/** O que basta saber de um certame da vitrine para ler as publicações dele. */
export type CertameParaPublicacoes = Pick<
  CertameNaVitrineDto,
  'processoSeletivoId' | 'identificadorLegivel'
>;

/**
 * Publicações lidas da página pública do certame na Portal API. `null` é o certame cuja consulta
 * falhou: ele mostra o erro sem derrubar os demais.
 */
export type PublicacoesPorCertame = ReadonlyMap<string, PublicacoesDoCertame | null>;

@Injectable({ providedIn: 'root' })
export class PublicacoesRepository {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(PORTAL_BASE_PATH);

  /**
   * Publicações dos certames de uma página da vitrine, indexadas por `processoSeletivoId`, com uma
   * consulta à página pública de cada certame.
   */
  buscarPorCertames(
    certames: readonly CertameParaPublicacoes[],
  ): Observable<PublicacoesPorCertame> {
    if (certames.length === 0) return of(new Map());
    return forkJoin(
      certames.map((certame) =>
        this.publicacoesDe(certame.identificadorLegivel).pipe(
          map((publicacoes) => [certame.processoSeletivoId, publicacoes] as const),
        ),
      ),
    ).pipe(map((entradas) => new Map(entradas)));
  }

  private publicacoesDe(identificador: string): Observable<PublicacoesDoCertame | null> {
    const { url, context } = certamePublicoDoPortalRequest(this.basePath, identificador);
    return this.http
      .get<ApiResult<CertamePublicoResponse>>(url, { context })
      .pipe(map((resposta) => (resposta.ok ? paraPublicacoes(resposta.data) : null)));
  }
}

function paraPublicacoes(certame: CertamePublicoResponse): PublicacoesDoCertame {
  return {
    ...(certame.documentoEditalUrl ? { documentoEditalUrl: certame.documentoEditalUrl } : {}),
    ...(certame.aviso ? { aviso: certame.aviso } : {}),
    publicacoes: certame.linhaDoTempo.map(paraPublicacao),
  };
}

function paraPublicacao(evento: EventoDaLinhaDoTempoResponse): PublicacaoDoCertame {
  return {
    id: evento.id,
    data: evento.data,
    titulo: evento.titulo,
    tipo: evento.tipo.nome,
    ...(evento.descricao ? { descricao: evento.descricao } : {}),
    documentos: paraDocumentos(evento.documentos),
  };
}
