import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { ConsultaDoAcompanhamento } from './consulta-do-acompanhamento';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';
const rota = (id: string) => `/api/selecao/processos-seletivos/${id}`;

describe('ConsultaDoAcompanhamento', () => {
  let consulta: ConsultaDoAcompanhamento;
  let http: HttpTestingController;
  let usuario: ReturnType<typeof signal<string | null>>;
  let token: ReturnType<typeof signal<string>>;

  beforeEach(() => {
    usuario = signal<string | null>('usuario');
    token = signal('primeiro');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: '' },
        ConsultaDoAcompanhamento,
        {
          provide: UserContextService,
          useValue: {
            isAuthenticated: () => usuario() !== null,
            user: () => ({ id: usuario(), token: token() }),
          },
        },
      ],
    });
    consulta = TestBed.inject(ConsultaDoAcompanhamento);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));
  const atualizar = async () => {
    await Promise.resolve();
    TestBed.tick();
  };
  const abrir = async (id: string) => {
    consulta.abrir(id);
    await atualizar();
  };
  const responder = async (id: string, nome: string) => {
    http.expectOne(rota(id)).flush({ id, nome });
    await atualizar();
  };
  const recusar = async (id: string, status: number) => {
    http.expectOne(rota(id)).flush({}, { status, statusText: 'Erro' });
    await atualizar();
  };

  it('apresenta o processo lido', async () => {
    await abrir(ID_A);
    await responder(ID_A, 'Processo A');
    expect(consulta.situacao()).toMatchObject({ estado: 'lido', processo: { nome: 'Processo A' } });
  });

  it('apresenta não encontrado na resposta 404', async () => {
    await abrir(ID_A);
    await recusar(ID_A, 404);
    expect(consulta.situacao().estado).toBe('nao-encontrado');
  });

  it('repete o identificador atual somente após falha', async () => {
    await abrir(ID_A);
    consulta.tentarNovamente();
    await recusar(ID_A, 500);
    expect(consulta.situacao().estado).toBe('falha');
    await abrir(ID_B);
    await recusar(ID_B, 500);
    consulta.tentarNovamente();
    await atualizar();
    await responder(ID_B, 'Processo B');
    expect(consulta.situacao().estado).toBe('lido');
  });

  it('recusa identificador malformado sem consulta', async () => {
    await abrir('invalido');
    http.expectNone(() => true);
    expect(consulta.situacao().estado).toBe('nao-encontrado');
  });

  it('cancela a leitura anterior ao trocar de identificador', async () => {
    await abrir(ID_A);
    const anterior = http.expectOne(rota(ID_A));
    await abrir(ID_B);
    expect(anterior.cancelled).toBe(true);
    expect(() => anterior.flush({ id: ID_A, nome: 'Antigo' })).toThrow();
    expect(consulta.situacao().estado).toBe('lendo');
    await responder(ID_B, 'Atual');
    expect(consulta.situacao()).toMatchObject({ processo: { nome: 'Atual' } });
  });

  it('refaz a leitura na perda e no retorno da sessão', async () => {
    await abrir(ID_A);
    await responder(ID_A, 'Anterior');
    usuario.set(null);
    await atualizar();
    expect(consulta.situacao().estado).toBe('lendo');
    await recusar(ID_A, 401);
    expect(consulta.situacao().estado).toBe('falha');
    usuario.set('usuario');
    await atualizar();
    expect(consulta.situacao().estado).toBe('lendo');
    await responder(ID_A, 'Atual');
    expect(consulta.situacao()).toMatchObject({ processo: { nome: 'Atual' } });
  });

  it('não reconsulta na renovação do token do mesmo usuário', async () => {
    await abrir(ID_A);
    await responder(ID_A, 'Atual');
    token.set('renovado');
    await atualizar();
    http.expectNone(rota(ID_A));
    expect(consulta.situacao().estado).toBe('lido');
  });
});
