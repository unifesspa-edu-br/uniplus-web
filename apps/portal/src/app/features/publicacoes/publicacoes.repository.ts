import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

import {
  type CertameParaPublicacoes,
  gravarPublicacoesMock,
  lerPublicacoesMock,
  montarPublicacaoMock,
} from './publicacoes.mock';
import type { Publicacao } from './publicacoes.model';

export type { CertameParaPublicacoes } from './publicacoes.mock';

/** Só para os estados de carregamento terem algo a mostrar antes da API existir. */
const LATENCIA_SIMULADA_MS = 300;

/**
 * Acesso às Publicações — hoje simula, para todo certame, uma linha do tempo
 * montada a partir dos dados dele (`publicacoes.mock.ts`, via
 * `of(...).pipe(delay(...))`); quando a consulta pública existir
 * (uniplus-api#1497/uniplus-api#1498), só os métodos abaixo mudam, sem tocar
 * em quem os consome (dado simulado fica isolado nesta camada, não nos
 * componentes).
 */
@Injectable({ providedIn: 'root' })
export class PublicacoesRepository {
  private readonly geradas = new Map<string, Publicacao>();

  /**
   * Publicações dos certames de uma página da vitrine, numa só consulta —
   * indexadas por `processoSeletivoId`.
   */
  buscarPorCertames(
    certames: readonly CertameParaPublicacoes[],
  ): Observable<ReadonlyMap<string, Publicacao>> {
    const porCertame = new Map<string, Publicacao>();
    for (const certame of certames) {
      const publicacao = montarPublicacaoMock(certame);
      this.geradas.set(publicacao.id, publicacao);
      porCertame.set(certame.processoSeletivoId, publicacao);
    }
    gravarPublicacoesMock([...porCertame.values()]);
    return of<ReadonlyMap<string, Publicacao>>(porCertame).pipe(delay(LATENCIA_SIMULADA_MS));
  }

  /**
   * Uma publicação por id, para a página do documento de um evento. `undefined`
   * quando o id não corresponde a nenhuma publicação.
   */
  buscarPorId(id: string): Observable<Publicacao | undefined> {
    const publicacao =
      this.geradas.get(id) ?? lerPublicacoesMock().find((item) => item.id === id);
    return of(publicacao).pipe(delay(LATENCIA_SIMULADA_MS));
  }
}
