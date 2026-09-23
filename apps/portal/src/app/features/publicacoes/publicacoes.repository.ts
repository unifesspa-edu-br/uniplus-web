import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

import { MOCK_PUBLICACOES, encontrarPublicacao } from './publicacoes.mock';
import type { Publicacao } from './publicacoes.model';

/** Só para os estados de carregamento terem algo a mostrar antes da API existir. */
const LATENCIA_SIMULADA_MS = 300;

/**
 * Acesso às Publicações — hoje devolve o catálogo mocado (`publicacoes.mock.ts`
 * via `of(...).pipe(delay(...))`); quando a consulta pública existir
 * (uniplus-api#1497/uniplus-api#1498), só os métodos abaixo mudam, sem tocar
 * em quem os consome (CA-11 de #859 e #860: dado simulado fica isolado nesta
 * camada, não nos componentes). Tela de listagem e tela de detalhes usam o
 * mesmo contrato de dados (`Publicacao`), como pede a dependência de #860.
 */
@Injectable({ providedIn: 'root' })
export class PublicacoesRepository {
  /** Só os processos ainda não finalizados (tudo exceto `encerrado`) — mesmo contrato esperado da futura consulta pública. */
  listarNaoFinalizadas(): Observable<readonly Publicacao[]> {
    const naoFinalizadas = MOCK_PUBLICACOES.filter(
      (publicacao) => publicacao.situacao !== 'encerrado',
    );
    return of(naoFinalizadas).pipe(delay(LATENCIA_SIMULADA_MS));
  }

  /**
   * Uma publicação por id, para a tela de detalhes — inclui as já
   * finalizadas (o candidato pode acessar o detalhe de um processo
   * encerrado mesmo que ele não apareça na listagem). `undefined` quando o
   * id não corresponde a nenhuma publicação.
   */
  buscarPorId(id: string): Observable<Publicacao | undefined> {
    return of(encontrarPublicacao(id)).pipe(delay(LATENCIA_SIMULADA_MS));
  }
}
