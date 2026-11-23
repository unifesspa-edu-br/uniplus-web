import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import type { ApiResult } from '@uniplus/shared-core/http';
import { errorResult, mockProblemDetails, okResult } from '@uniplus/shared-testing';
import { ProcessosSeletivosApi, type ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import { ConsultaDoAcompanhamento } from './consulta-do-acompanhamento';

type Resposta = ApiResult<ProcessoSeletivoDto>;
interface Chamada {
  readonly id: string;
  readonly resposta: Subject<Resposta>;
}

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

const processo = (id: string, nome: string) => okResult({ id, nome } as ProcessoSeletivoDto);
const falha = (status: number): Resposta => errorResult(mockProblemDetails({ status }));

describe('ConsultaDoAcompanhamento', () => {
  let chamadas: Chamada[];
  let usuarioId: ReturnType<typeof signal<string | null>>;
  let consulta: ConsultaDoAcompanhamento;

  beforeEach(() => {
    chamadas = [];
    usuarioId = signal<string | null>('u1');
    TestBed.configureTestingModule({
      providers: [
        ConsultaDoAcompanhamento,
        {
          provide: ProcessosSeletivosApi,
          useValue: {
            obter: (id: string) => {
              const resposta = new Subject<Resposta>();
              chamadas.push({ id, resposta });
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
    consulta = TestBed.inject(ConsultaDoAcompanhamento);
    TestBed.tick();
  });

  const responder = (indice: number, r: Resposta) => chamadas[indice].resposta.next(r);
  const estado = () => consulta.situacao().estado;

  it('identificador malformado não consulta e diz não encontrado', () => {
    consulta.abrir('abc');
    expect(chamadas).toHaveLength(0);
    expect(estado()).toBe('nao-encontrado');
  });

  it('abre o processo pelo recurso existente e apresenta o sucesso', () => {
    consulta.abrir(ID_A);
    expect(estado()).toBe('lendo');
    responder(0, processo(ID_A, 'Vestibular'));
    expect(consulta.situacao()).toMatchObject({ estado: 'lido', processo: { nome: 'Vestibular' } });
  });

  it.each([
    [404, 'nao-encontrado'],
    [403, 'acesso-negado'],
    [500, 'falha'],
  ])('status %i vira %s', (status, esperado) => {
    consulta.abrir(ID_A);
    responder(0, falha(status));
    expect(estado()).toBe(esperado);
  });

  it('resposta tardia do processo A não altera o contexto do B', () => {
    consulta.abrir(ID_A);
    consulta.abrir(ID_B);
    expect(estado()).toBe('lendo');
    responder(0, processo(ID_A, 'A'));
    expect(estado()).toBe('lendo');
    responder(1, processo(ID_B, 'B'));
    expect(consulta.situacao()).toMatchObject({ processo: { nome: 'B' } });
  });

  it('trocar o identificador limpa o processo anterior enquanto carrega', () => {
    consulta.abrir(ID_A);
    responder(0, processo(ID_A, 'A'));
    consulta.abrir(ID_B);
    expect(consulta.situacao()).toEqual({ estado: 'lendo' });
  });

  it('a nova tentativa consulta o identificador atual e só vale após falha', () => {
    consulta.abrir(ID_A);
    consulta.tentarNovamente();
    expect(chamadas).toHaveLength(1);
    responder(0, falha(500));
    consulta.tentarNovamente();
    expect(chamadas.map((c) => c.id)).toEqual([ID_A, ID_A]);
    expect(estado()).toBe('lendo');
  });

  it('a troca de sessão limpa o contexto e ignora a resposta antiga', () => {
    consulta.abrir(ID_A);
    usuarioId.set('u2');
    TestBed.tick();
    expect(estado()).toBe('lendo');
    expect(chamadas).toHaveLength(2);
    responder(0, processo(ID_A, 'do usuário antigo'));
    expect(estado()).toBe('lendo');
  });
});
