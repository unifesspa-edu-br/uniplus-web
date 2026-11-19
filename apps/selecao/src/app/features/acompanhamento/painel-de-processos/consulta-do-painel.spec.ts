import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpHeaders } from '@angular/common/http';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import {
  errorResult,
  mockProblemDetails,
  okResult,
  type ApiResult,
} from '@uniplus/shared-core/http';
import {
  ProcessosSeletivosApi,
  type ProcessoSeletivoResumoDto,
} from '@uniplus/shared-data/selecao';

import { VESTIBULAR_2026, VESTIBULAR_2027 } from './processos-do-painel.testing';
import { ConsultaDoPainel } from './consulta-do-painel';

type Resposta = ApiResult<readonly ProcessoSeletivoResumoDto[]>;
type Chamada = {
  query: Parameters<ProcessosSeletivosApi['listar']>[0];
  resposta: Subject<Resposta>;
};

function sucesso(itens: readonly ProcessoSeletivoResumoDto[], link?: string): Resposta {
  return okResult(itens, 200, new HttpHeaders(link ? { Link: link } : {}));
}

function falha(status: number, code = 'uniplus.client.http'): Resposta {
  return errorResult(mockProblemDetails({ status, code }));
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
    expect(ultima().query).toEqual({ limit: 50 });
    expect(consulta.carregando()).toBe(true);
  });

  it('mantém a ordem recebida e expõe só id e nome', () => {
    responder(sucesso([VESTIBULAR_2027, VESTIBULAR_2026], LINKS));

    expect(consulta.itens()).toEqual([
      { id: VESTIBULAR_2027.id, nome: VESTIBULAR_2027.nome },
      { id: VESTIBULAR_2026.id, nome: VESTIBULAR_2026.nome },
    ]);
    expect(consulta.carregando()).toBe(false);
    expect(consulta.temAnterior()).toBe(true);
    expect(consulta.temProxima()).toBe(true);
  });

  it('avança e retrocede com o cursor e a direção dos links', () => {
    responder(sucesso([VESTIBULAR_2026], LINKS));
    consulta.proximaPagina();
    expect(ultima().query).toMatchObject({ cursor: 'PROX', direction: 'next' });
    responder(sucesso([VESTIBULAR_2027], LINKS));
    consulta.paginaAnterior();
    expect(ultima().query).toMatchObject({ cursor: 'ANT', direction: 'prev' });
  });

  it('não repete a consulta enquanto uma está em curso', () => {
    responder(sucesso([VESTIBULAR_2026], LINKS));
    consulta.proximaPagina();
    consulta.proximaPagina();
    consulta.atualizarLista();
    expect(chamadas).toHaveLength(2);
  });

  it('reinicia sem cursor ao trocar o tamanho', () => {
    responder(sucesso([VESTIBULAR_2026], LINKS));
    consulta.trocarTamanho(25);
    expect(ultima().query).toEqual({ limit: 25 });
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
    expect(ultima().query).toMatchObject({ limit: 50 });
    expect(consulta.falha()).toBeNull();
  });

  it('falha de navegação preserva a página e a nova tentativa repete a consulta que falhou', () => {
    responder(sucesso([VESTIBULAR_2026], LINKS));
    consulta.proximaPagina();
    responder(falha(500));

    expect(consulta.falha()).toBe('navegacao');
    expect(consulta.itens()).toEqual([{ id: VESTIBULAR_2026.id, nome: VESTIBULAR_2026.nome }]);
    expect(consulta.temProxima()).toBe(true);

    consulta.tentarNovamente();
    expect(ultima().query).toMatchObject({ cursor: 'PROX', direction: 'next' });
  });

  it('cursor expirado (410) pede atualização e reinicia sem o cursor vencido', () => {
    responder(sucesso([VESTIBULAR_2026], LINKS));
    consulta.proximaPagina();
    responder(falha(410, 'uniplus.cursor.expirado'));

    expect(consulta.restricao()).toBe('cursor-expirado');
    expect(consulta.temProxima()).toBe(false);
    expect(consulta.temAnterior()).toBe(false);

    consulta.atualizarLista();
    expect(ultima().query).toEqual({ limit: 50 });
    expect(consulta.restricao()).toBe('cursor-expirado');
    responder(sucesso([]));
    expect(consulta.restricao()).toBeNull();
  });

  it('403 limpa os dados anteriores e sinaliza acesso negado, não lista vazia', () => {
    responder(sucesso([VESTIBULAR_2026], LINKS));
    consulta.proximaPagina();
    responder(falha(403));

    expect(consulta.restricao()).toBe('acesso-negado');
    expect(consulta.itens()).toEqual([]);
    expect(consulta.temProxima()).toBe(false);
  });

  describe('troca de sessão durante a navegação', () => {
    let paginaDoUsuarioAnterior: Subject<Resposta>;

    beforeEach(() => {
      responder(sucesso([VESTIBULAR_2026], LINKS));
      consulta.proximaPagina();
      paginaDoUsuarioAnterior = ultima().resposta;
      usuarioId.set('u2');
      TestBed.tick();
    });

    it('descarta a página anterior e consulta a primeira página do novo usuário', () => {
      expect(consulta.itens()).toEqual([]);
      expect(consulta.temProxima()).toBe(false);
      expect(chamadas).toHaveLength(3);
      expect(ultima().query).toEqual({ limit: 50 });
    });

    it('exibe apenas a resposta da nova sessão, mesmo se a anterior chegar depois', () => {
      responder(sucesso([VESTIBULAR_2027]));
      paginaDoUsuarioAnterior.next(sucesso([VESTIBULAR_2026], LINKS));
      expect(consulta.itens()).toEqual([{ id: VESTIBULAR_2027.id, nome: VESTIBULAR_2027.nome }]);
      expect(consulta.temProxima()).toBe(false);
    });
  });

  it('sem sessão cancela a consulta e não pede outra', () => {
    usuarioId.set(null);
    TestBed.tick();
    expect(chamadas).toHaveLength(1);
    expect(consulta.carregando()).toBe(false);
    expect(consulta.itens()).toEqual([]);
  });
});
