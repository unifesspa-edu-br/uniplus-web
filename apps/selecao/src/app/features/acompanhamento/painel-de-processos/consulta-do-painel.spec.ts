import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpHeaders } from '@angular/common/http';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import type { ApiResult, ProblemDetails } from '@uniplus/shared-core/http';
import {
  ProcessosSeletivosApi,
  type ProcessoSeletivoResumoDto,
} from '@uniplus/shared-data/selecao';

import { ConsultaDoPainel } from './consulta-do-painel';

type Resposta = ApiResult<readonly ProcessoSeletivoResumoDto[]>;
type Chamada = {
  query: Parameters<ProcessosSeletivosApi['listar']>[0];
  resposta: Subject<Resposta>;
};

const resumo = (id: string, nome: string) => ({ id, nome }) as unknown as ProcessoSeletivoResumoDto;

function sucesso(itens: ProcessoSeletivoResumoDto[], link?: string): Resposta {
  return {
    ok: true,
    data: itens,
    status: 200,
    headers: new HttpHeaders(link === undefined ? {} : { Link: link }),
  };
}

function falha(status: number, code = 'uniplus.client.http'): Resposta {
  return {
    ok: false,
    status,
    problem: { type: 'about:blank', title: 't', status, code } as ProblemDetails,
    headers: new HttpHeaders(),
  };
}

const LINKS =
  '</api?cursor=PROX&direction=next>; rel="next", </api?cursor=ANT&direction=prev>; rel="prev"';

describe('ConsultaDoPainel', () => {
  let chamadas: Chamada[];
  let usuarioId: ReturnType<typeof signal<string | null>>;
  let consulta: ConsultaDoPainel;

  beforeEach(() => {
    chamadas = [];
    usuarioId = signal<string | null>('u1');
    TestBed.configureTestingModule({
      providers: [
        ConsultaDoPainel,
        {
          provide: ProcessosSeletivosApi,
          useValue: {
            listar: (query: Chamada['query']) => {
              const resposta = new Subject<Resposta>();
              chamadas.push({ query, resposta });
              return resposta;
            },
          },
        },
        {
          provide: UserContextService,
          useValue: {
            isAuthenticated: () => usuarioId() !== null,
            user: () => (usuarioId() === null ? null : { id: usuarioId() }),
          },
        },
      ],
    });
    consulta = TestBed.inject(ConsultaDoPainel);
    TestBed.tick();
  });

  const ultima = () => chamadas[chamadas.length - 1];
  const responder = (r: Resposta) => ultima().resposta.next(r);

  it('consulta a primeira página sem cursor e com limit=50', () => {
    expect(chamadas).toHaveLength(1);
    expect(ultima().query).toEqual({ cursor: undefined, direction: undefined, limit: 50 });
    expect(consulta.carregando()).toBe(true);
  });

  it('mantém a ordem recebida e expõe só id e nome', () => {
    responder(sucesso([resumo('b', 'B'), resumo('a', 'A')], LINKS));

    expect(consulta.itens()).toEqual([
      { id: 'b', nome: 'B' },
      { id: 'a', nome: 'A' },
    ]);
    expect(consulta.carregando()).toBe(false);
    expect(consulta.temAnterior()).toBe(true);
    expect(consulta.temProxima()).toBe(true);
  });

  it('avança e retrocede com o cursor e a direção dos links', () => {
    responder(sucesso([resumo('a', 'A')], LINKS));
    consulta.proximaPagina();
    expect(ultima().query).toMatchObject({ cursor: 'PROX', direction: 'next', limit: undefined });
    responder(sucesso([resumo('c', 'C')], LINKS));
    consulta.paginaAnterior();
    expect(ultima().query).toMatchObject({ cursor: 'ANT', direction: 'prev' });
  });

  it('não repete a consulta enquanto uma está em curso', () => {
    responder(sucesso([resumo('a', 'A')], LINKS));
    consulta.proximaPagina();
    consulta.proximaPagina();
    consulta.atualizarLista();
    expect(chamadas).toHaveLength(2);
  });

  it('reinicia sem cursor ao trocar o tamanho', () => {
    responder(sucesso([resumo('a', 'A')], LINKS));
    consulta.trocarTamanho(25);
    expect(ultima().query).toEqual({ cursor: undefined, direction: undefined, limit: 25 });
    expect(consulta.limite()).toBe(25);
  });

  it('lista vazia não é falha', () => {
    responder(sucesso([]));
    expect(consulta.itens()).toEqual([]);
    expect(consulta.falha()).toBeNull();
    expect(consulta.restricao()).toBeNull();
  });

  it('falha inicial limpa itens e cursores e a nova tentativa recomeça', () => {
    responder(falha(500));
    expect(consulta.falha()).toBe('inicial');
    expect(consulta.itens()).toEqual([]);

    consulta.tentarNovamente();
    expect(ultima().query).toMatchObject({ cursor: undefined, limit: 50 });
    expect(consulta.falha()).toBeNull();
  });

  it('falha de navegação preserva a página e a nova tentativa repete a consulta que falhou', () => {
    responder(sucesso([resumo('a', 'A')], LINKS));
    consulta.proximaPagina();
    responder(falha(500));

    expect(consulta.falha()).toBe('navegacao');
    expect(consulta.itens()).toEqual([{ id: 'a', nome: 'A' }]);
    expect(consulta.temProxima()).toBe(true);

    consulta.tentarNovamente();
    expect(ultima().query).toMatchObject({ cursor: 'PROX', direction: 'next' });
  });

  it('cursor expirado (410) pede atualização e reinicia sem o cursor vencido', () => {
    responder(sucesso([resumo('a', 'A')], LINKS));
    consulta.proximaPagina();
    responder(falha(410, 'uniplus.cursor.expirado'));

    expect(consulta.restricao()).toBe('cursor-expirado');
    expect(consulta.temProxima()).toBe(false);
    expect(consulta.temAnterior()).toBe(false);

    consulta.atualizarLista();
    expect(ultima().query).toMatchObject({ cursor: undefined, limit: 50 });
    expect(consulta.restricao()).toBeNull();
  });

  it('403 limpa os dados anteriores e sinaliza acesso negado, não lista vazia', () => {
    responder(sucesso([resumo('a', 'A')], LINKS));
    consulta.proximaPagina();
    responder(falha(403));

    expect(consulta.restricao()).toBe('acesso-negado');
    expect(consulta.itens()).toEqual([]);
    expect(consulta.temProxima()).toBe(false);
  });

  it('troca de sessão limpa itens e cursores e ignora a resposta tardia', () => {
    responder(sucesso([resumo('a', 'A')], LINKS));
    consulta.proximaPagina();
    const antiga = ultima();

    usuarioId.set('u2');
    TestBed.tick();

    expect(consulta.itens()).toEqual([]);
    expect(consulta.temProxima()).toBe(false);
    expect(chamadas).toHaveLength(3);
    expect(ultima().query).toMatchObject({ cursor: undefined, limit: 50 });

    antiga.resposta.next(sucesso([resumo('x', 'Do anterior')], LINKS));
    expect(consulta.itens()).toEqual([]);

    responder(sucesso([resumo('n', 'Novo')]));
    expect(consulta.itens()).toEqual([{ id: 'n', nome: 'Novo' }]);
  });

  it('sem sessão cancela a consulta e não pede outra', () => {
    usuarioId.set(null);
    TestBed.tick();
    expect(chamadas).toHaveLength(1);
    expect(consulta.carregando()).toBe(false);
    expect(consulta.itens()).toEqual([]);
  });
});
