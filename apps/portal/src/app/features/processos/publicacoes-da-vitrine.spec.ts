import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { CertameNaVitrineDto } from '@uniplus/shared-data/selecao';
import { type Observable, Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PublicacoesDoCertame } from '../publicacoes/publicacoes.model';
import {
  type CertameParaPublicacoes,
  type PublicacoesPorCertame,
  PublicacoesRepository,
} from '../publicacoes/publicacoes.repository';
import { PublicacoesDaVitrine } from './publicacoes-da-vitrine';
import { VitrineDeCertames } from './vitrine-de-certames';

const certame = (id: string): CertameNaVitrineDto =>
  ({ processoSeletivoId: id, identificadorLegivel: `certame-${id}` }) as CertameNaVitrineDto;

const A = certame('a');
const B = certame('b');
const C = certame('c');

const publicacoesDe = (id: string): PublicacoesDoCertame => ({
  documentoEditalUrl: `https://acervo.example/${id}.pdf`,
  publicacoes: [],
});

describe('PublicacoesDaVitrine', () => {
  const certames = signal<readonly CertameNaVitrineDto[]>([]);
  let pedidos: (readonly CertameParaPublicacoes[])[];
  let respostas: Subject<PublicacoesPorCertame>[];
  let paginaLida: PublicacoesPorCertame;
  let fonte: PublicacoesDaVitrine;

  beforeEach(() => {
    pedidos = [];
    respostas = [];
    certames.set([]);
    const buscarPorCertames = (
      lote: readonly CertameParaPublicacoes[],
    ): Observable<PublicacoesPorCertame> => {
      pedidos.push(lote);
      if (pedidos.length === 1) return of(new Map());
      if (pedidos.length === 2) return of(paginaLida);
      const resposta = new Subject<PublicacoesPorCertame>();
      respostas.push(resposta);
      return resposta;
    };
    TestBed.configureTestingModule({
      providers: [
        PublicacoesDaVitrine,
        { provide: VitrineDeCertames, useValue: { certames } },
        { provide: PublicacoesRepository, useValue: { buscarPorCertames: vi.fn(buscarPorCertames) } },
      ],
    });
  });

  /** A página lida com o certame A em falha e os demais carregados. */
  function lerPaginaComFalhaEmA(): void {
    paginaLida = new Map<string, PublicacoesDoCertame | null>([
      [A.processoSeletivoId, null],
      [B.processoSeletivoId, publicacoesDe('b')],
      [C.processoSeletivoId, publicacoesDe('c')],
    ]);
    fonte = TestBed.inject(PublicacoesDaVitrine);
    TestBed.tick();
    certames.set([A, B, C]);
    TestBed.tick();
  }

  const item = (certameId: string) => fonte.porCertame().get(certameId);

  it('a nova tentativa de um certame lê só ele e mantém a linha do tempo e o edital dos demais', () => {
    lerPaginaComFalhaEmA();

    fonte.recarregar(A.processoSeletivoId);

    expect(pedidos.at(-1)?.map((c) => c.processoSeletivoId)).toEqual(['a']);
    expect(item('a')).toMatchObject({ carregando: true, erro: false });
    expect(item('b')).toMatchObject({ carregando: false, erro: false });
    expect(item('b')?.publicacoes).toBeDefined();
    expect(item('b')?.edital).toEqual({ documentoUrl: 'https://acervo.example/b.pdf' });
    expect(item('c')?.edital).not.toBeNull();
  });

  it('a nova tentativa que dá certo carrega o certame sem mexer nos outros', () => {
    lerPaginaComFalhaEmA();
    fonte.recarregar(A.processoSeletivoId);

    respostas[0].next(new Map([[A.processoSeletivoId, publicacoesDe('a')]]));

    expect(item('a')).toMatchObject({ carregando: false, erro: false });
    expect(item('a')?.edital).not.toBeNull();
    expect(item('b')?.publicacoes).toBeDefined();
  });

  it('dois pedidos seguidos em certames diferentes não se cancelam nem deixam carregando preso', () => {
    paginaLida = new Map<string, PublicacoesDoCertame | null>([
      [A.processoSeletivoId, null],
      [B.processoSeletivoId, publicacoesDe('b')],
      [C.processoSeletivoId, null],
    ]);
    fonte = TestBed.inject(PublicacoesDaVitrine);
    TestBed.tick();
    certames.set([A, B, C]);
    TestBed.tick();

    fonte.recarregar(A.processoSeletivoId);
    fonte.recarregar(C.processoSeletivoId);
    respostas[1].next(new Map([[C.processoSeletivoId, null]]));
    respostas[0].next(new Map([[A.processoSeletivoId, publicacoesDe('a')]]));

    expect(item('a')).toMatchObject({ carregando: false, erro: false });
    expect(item('c')).toMatchObject({ carregando: false, erro: true });
    expect(item('b')?.publicacoes).toBeDefined();
  });

  it('pedir de novo um certame que já está sendo lido não parte outra leitura', () => {
    lerPaginaComFalhaEmA();

    fonte.recarregar(A.processoSeletivoId);
    fonte.recarregar(A.processoSeletivoId);

    expect(respostas).toHaveLength(1);
  });

  it('a nova tentativa que falha de vez volta o certame a erro, sem deixar carregando preso', () => {
    lerPaginaComFalhaEmA();
    fonte.recarregar(A.processoSeletivoId);

    respostas[0].error(new Error('rede'));

    expect(item('a')).toMatchObject({ carregando: false, erro: true });
    expect(item('b')?.publicacoes).toBeDefined();
  });

  it('trocar a página cancela a nova tentativa em curso, para a resposta velha não sobrescrever a leitura nova', () => {
    lerPaginaComFalhaEmA();
    fonte.recarregar(A.processoSeletivoId);

    certames.set([A, B]);
    TestBed.tick();

    expect(respostas[0].observed).toBe(false);
  });
});
