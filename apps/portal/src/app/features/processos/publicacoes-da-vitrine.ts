import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Subscription, catchError, of } from 'rxjs';

import type { CertameNaVitrineDto } from '@uniplus/shared-data/selecao';
import type { PublicacoesDoCertame } from '../publicacoes/publicacoes.model';
import {
  type PublicacoesPorCertame,
  PublicacoesRepository,
} from '../publicacoes/publicacoes.repository';
import { VitrineDeCertames } from './vitrine-de-certames';

/** Onde está a leitura das publicações de um certame; cada certame tem a sua. */
type LeituraDoCertame =
  | { readonly status: 'carregando' }
  | { readonly status: 'erro' }
  | { readonly status: 'ok'; readonly publicacoes: PublicacoesDoCertame };

/** O que um item da vitrine mostra das publicações do seu certame. */
export interface PublicacoesDoItem {
  readonly publicacoes: PublicacoesDoCertame | undefined;
  readonly carregando: boolean;
  /** A consulta das publicações deste certame falhou. */
  readonly erro: boolean;
  /** Alvo do link "Ver edital" — ausente até as publicações chegarem ou se não houver edital. */
  readonly edital: { readonly documentoUrl: string } | null;
}

/**
 * Publicações (linha do tempo do accordion "Ver publicações" e link do edital
 * vigente) dos certames da página, com uma consulta à página pública de cada
 * um. O certame cuja consulta falha fica sem o PDF e com o erro no accordion, e
 * uma falha aqui não derruba a vitrine: só o accordion avisa, ao ser aberto, e
 * oferece ler de novo. Provida pela página.
 */
@Injectable()
export class PublicacoesDaVitrine {
  private readonly vitrine = inject(VitrineDeCertames);
  private readonly repositorio = inject(PublicacoesRepository);

  private readonly leituras = signal<ReadonlyMap<string, LeituraDoCertame>>(new Map());
  /** As leituras em curso, da página e das novas tentativas; trocar a página cancela todas. */
  private emCurso = new Subscription();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.emCurso.unsubscribe());
    effect(() => {
      const certames = this.vitrine.certames();
      untracked(() => this.lerPagina(certames));
    });
  }

  /**
   * Lê de novo as publicações de um só certame, sem tocar nos demais: os que já carregaram mantêm a
   * linha do tempo e o link do edital. O estado `carregando` sobe na hora, na mesma tarefa do pedido:
   * quem acompanha a espera não pode vê-la começar depois do clique.
   */
  recarregar(certameId: string): void {
    const certame = this.vitrine.certames().find((c) => c.processoSeletivoId === certameId);
    if (certame === undefined || this.leituras().get(certameId)?.status !== 'erro') return;
    this.leituras.update((atual) => new Map(atual).set(certameId, { status: 'carregando' }));
    this.ler([certame]);
  }

  private lerPagina(certames: readonly CertameNaVitrineDto[]): void {
    this.emCurso.unsubscribe();
    this.emCurso = new Subscription();
    this.leituras.set(
      new Map(certames.map((c) => [c.processoSeletivoId, { status: 'carregando' } as const])),
    );
    this.ler(certames);
  }

  /** Quem a consulta não devolve, por ela ter falhado ou por faltar na resposta, fica em erro. */
  private ler(certames: readonly CertameNaVitrineDto[]): void {
    this.emCurso.add(
      this.repositorio
        .buscarPorCertames(certames)
        .pipe(catchError(() => of<PublicacoesPorCertame>(new Map())))
        .subscribe((porCertame) => this.registrar(porCertame, certames)),
    );
  }

  private registrar(
    porCertame: PublicacoesPorCertame,
    certames: readonly CertameNaVitrineDto[],
  ): void {
    this.leituras.update((atual) => {
      const proximas = new Map(atual);
      for (const { processoSeletivoId: id } of certames) {
        const publicacoes = porCertame.get(id);
        proximas.set(id, publicacoes ? { status: 'ok', publicacoes } : { status: 'erro' });
      }
      return proximas;
    });
  }

  /** As publicações de cada certame da página, pelo identificador do processo seletivo. */
  readonly porCertame = computed<ReadonlyMap<string, PublicacoesDoItem>>(() => {
    const leituras = this.leituras();
    return new Map(
      this.vitrine.certames().map((certame) => {
        const id = certame.processoSeletivoId;
        const leitura = leituras.get(id) ?? { status: 'carregando' };
        const publicacoes = leitura.status === 'ok' ? leitura.publicacoes : undefined;
        const item: PublicacoesDoItem = {
          publicacoes,
          carregando: leitura.status === 'carregando',
          erro: leitura.status === 'erro',
          edital: publicacoes?.documentoEditalUrl
            ? { documentoUrl: publicacoes.documentoEditalUrl }
            : null,
        };
        return [id, item];
      }),
    );
  });
}
