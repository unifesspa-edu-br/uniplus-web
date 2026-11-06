import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CampusDto, CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CampiStore } from './campi.store';
import { CAMPI_ROUTES } from './campi.routes';
import { CampiPage } from './campi.page';

const URL_DA_LISTA = 'http://localhost:5000/api/configuracao/campi';

const campus: CampusDto = {
  id: '01960000-0000-7000-0000-0000000000b1',
  sigla: 'MARABA',
  nome: 'Campus de Marabá',
  codigoEmec: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

const falha = (
  status: number,
): [string, { status: number; statusText: string; headers: Record<string, string> }] => [
  JSON.stringify({ type: 'about:blank', title: 'Indisponível', status, code: 'uniplus.x' }),
  { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
];

describe('CampiStore', () => {
  let store: CampiStore;
  let controller: HttpTestingController;
  let app: ApplicationRef;
  const erro = vi.fn();

  beforeEach(() => {
    erro.mockClear();
    TestBed.configureTestingModule({
      providers: [
        CampiStore,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: 'http://localhost:5000' },
        { provide: NotificationService, useValue: { errorFromProblem: erro } },
      ],
    });
    store = TestBed.inject(CampiStore);
    controller = TestBed.inject(HttpTestingController);
    app = TestBed.inject(ApplicationRef);
  });

  afterEach(() => controller.verify());

  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    app.tick();
  };

  const responder = async (itens: readonly CampusDto[], cabecalho?: string): Promise<void> => {
    controller
      .expectOne((r) => r.url === URL_DA_LISTA)
      .flush(itens, cabecalho ? { headers: { Link: cabecalho } } : {});
    await propagar();
  };

  const falharLista = async (status: number): Promise<void> => {
    const [corpo, opcoes] = falha(status);
    controller.expectOne((r) => r.url === URL_DA_LISTA).flush(corpo, opcoes);
    await propagar();
  };

  it('uma falha 5xx avisa a pessoa e a mensagem de erro aparece', async () => {
    await propagar();
    await falharLista(503);

    expect(store.mensagemDeErro()).toBe('Indisponível');
    expect(erro).toHaveBeenCalledOnce();
  });

  it('uma falha 4xx não notifica', async () => {
    await propagar();
    await falharLista(403);

    expect(store.mensagemDeErro()).toBe('Indisponível');
    expect(erro).not.toHaveBeenCalled();
  });

  it('tentar novamente com a lista carregando não repete a consulta', async () => {
    await propagar();
    store.tentarNovamente();
    await propagar();

    await responder([campus]);
  });

  it('recarregar na primeira página repete a consulta', async () => {
    await propagar();
    await responder([campus]);

    store.recarregar();
    await propagar();

    await responder([]);
    expect(store.campi()).toEqual([]);
  });

  it('recarregar fora da primeira página volta à primeira', async () => {
    await propagar();
    await responder([campus], `<${URL_DA_LISTA}?cursor=abc&direction=forward>; rel="next"`);
    store.proximaPagina();
    await propagar();
    const segunda = controller.expectOne((r) => r.url === URL_DA_LISTA);
    expect(segunda.request.params.get('direction')).toBe('next');
    segunda.flush([]);
    await propagar();

    store.recarregar();
    await propagar();

    expect(controller.expectOne((r) => r.url === URL_DA_LISTA).request.params.has('cursor')).toBe(
      false,
    );
  });
});

describe('rotas de campi', () => {
  it('carrega a página de campi sob demanda', async () => {
    const carregar = CAMPI_ROUTES[0].loadComponent as () => Promise<unknown>;

    await expect(carregar()).resolves.toBe(CampiPage);
  });
});
