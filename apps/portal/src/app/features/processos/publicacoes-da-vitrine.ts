import { Injectable, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap } from 'rxjs';

import type { PublicacoesDoCertame } from '../publicacoes/publicacoes.model';
import {
  type PublicacoesPorCertame,
  PublicacoesRepository,
} from '../publicacoes/publicacoes.repository';
import { VitrineDeCertames } from './vitrine-de-certames';

/** Publicações dos certames da página atual — `carregando` enquanto a consulta não voltou. */
type PublicacoesDaPagina =
  | { readonly status: 'carregando' }
  | { readonly status: 'erro' }
  | { readonly status: 'ok'; readonly porCertame: PublicacoesPorCertame };

/** O que um item da vitrine mostra das publicações do seu certame. */
export interface PublicacoesDoItem {
  readonly publicacoes: PublicacoesDoCertame | undefined;
  readonly carregando: boolean;
  /** A consulta da página toda falhou, ou só a deste certame. */
  readonly erro: boolean;
  /** Alvo do link "Ver edital" — ausente até as publicações chegarem ou se não houver edital. */
  readonly edital: { readonly documentoUrl: string } | null;
}

/**
 * Publicações (linha do tempo do accordion "Ver publicações" e link do edital
 * vigente) dos certames da página, com uma consulta à página pública de cada
 * um. O certame cuja consulta falha fica sem o PDF e com o erro no accordion, e
 * uma falha aqui não derruba a vitrine: só o accordion avisa, ao ser aberto.
 * Provida pela página.
 */
@Injectable()
export class PublicacoesDaVitrine {
  private readonly vitrine = inject(VitrineDeCertames);
  private readonly repositorio = inject(PublicacoesRepository);

  private readonly daPagina = toSignal<PublicacoesDaPagina, PublicacoesDaPagina>(
    toObservable(this.vitrine.certames).pipe(
      switchMap((certames) =>
        this.repositorio.buscarPorCertames(certames).pipe(
          map((porCertame): PublicacoesDaPagina => ({ status: 'ok', porCertame })),
          catchError(() => of<PublicacoesDaPagina>({ status: 'erro' })),
          startWith<PublicacoesDaPagina>({ status: 'carregando' }),
        ),
      ),
    ),
    { initialValue: { status: 'carregando' } },
  );

  /** As publicações de cada certame da página, pelo identificador do processo seletivo. */
  readonly porCertame = computed<ReadonlyMap<string, PublicacoesDoItem>>(() => {
    const atual = this.daPagina();
    return new Map(
      this.vitrine.certames().map((certame) => {
        const id = certame.processoSeletivoId;
        const publicacoes = atual.status === 'ok' ? atual.porCertame.get(id) : undefined;
        const item: PublicacoesDoItem = {
          publicacoes: publicacoes ?? undefined,
          carregando: atual.status === 'carregando',
          erro: atual.status === 'erro' || (atual.status === 'ok' && publicacoes === null),
          edital: publicacoes?.documentoEditalUrl
            ? { documentoUrl: publicacoes.documentoEditalUrl }
            : null,
        };
        return [id, item];
      }),
    );
  });
}
