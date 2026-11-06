import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CONFIGURACAO_BASE_PATH, ModeloFormularioView } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelosFormularioStore } from './modelos-formulario.store';

const BASE = 'http://localhost:5000';
const URL_DA_LISTA = `${BASE}/api/configuracao/admin/modelos-formulario`;
const URL_DOS_TIPOS = `${BASE}/api/configuracao/tipos-processo`;

const modelo = (codigo: string, nome: string): ModeloFormularioView => ({
  id: codigo,
  codigo,
  nome,
  descricao: null,
  finalidade: 'INSCRICAO',
  tipoProcessoCodigo: null,
  ativo: true,
  conteudo: {
    titulo: nome,
    etapas: [],
    itens: [],
    termos: [],
    pressupostos: [],
    grupos: [],
    documentosExigidos: [],
  },
});

const falha = (
  status: number,
  code = 'uniplus.x',
): [string, { status: number; statusText: string; headers: Record<string, string> }] => [
  JSON.stringify({ type: 'about:blank', title: 'Indisponível', status, code }),
  { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
];

describe('ModelosFormularioStore', () => {
  let store: ModelosFormularioStore;
  let controller: HttpTestingController;
  let app: ApplicationRef;
  const notificacoes = { errorFromProblem: vi.fn(), info: vi.fn() };

  beforeEach(() => {
    notificacoes.errorFromProblem.mockClear();
    notificacoes.info.mockClear();
    TestBed.configureTestingModule({
      providers: [
        ModelosFormularioStore,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: NotificationService, useValue: notificacoes },
      ],
    });
    store = TestBed.inject(ModelosFormularioStore);
    controller = TestBed.inject(HttpTestingController);
    app = TestBed.inject(ApplicationRef);
  });

  afterEach(() => controller.verify());

  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    app.tick();
  };
  const lista = () => controller.expectOne((r) => r.url === URL_DA_LISTA);
  const responder = async (
    itens: readonly ModeloFormularioView[],
    link?: string,
  ): Promise<void> => {
    lista().flush(itens, link ? { headers: { Link: link } } : {});
    await propagar();
  };
  const iniciar = async (itens: readonly ModeloFormularioView[] = []): Promise<void> => {
    await propagar();
    controller
      .expectOne((r) => r.url === URL_DOS_TIPOS)
      .flush([{ codigo: 'V', nome: 'Vestibular' }]);
    await responder(itens);
  };

  it('lê a primeira página com o limite e os tipos de processo', async () => {
    await propagar();
    const primeira = lista();
    expect(primeira.request.params.get('limit')).toBe('50');
    expect(primeira.request.params.has('cursor')).toBe(false);
    primeira.flush([]);
    controller
      .expectOne((r) => r.url === URL_DOS_TIPOS)
      .flush([{ codigo: 'V', nome: 'Vestibular' }]);
    await propagar();

    expect(store.tiposDeProcesso()).toEqual([{ codigo: 'V', nome: 'Vestibular' }]);
  });

  it('cada filtro vai à consulta e volta à primeira página', async () => {
    await iniciar();

    store.filtroFinalidade.set('INSCRICAO');
    store.filtroSituacao.set('false');
    store.filtroTipo.set('V');
    await propagar();

    const consulta = lista();
    expect(consulta.request.params.get('finalidade')).toBe('INSCRICAO');
    expect(consulta.request.params.get('ativo')).toBe('false');
    expect(consulta.request.params.get('tipoProcesso')).toBe('V');
    consulta.flush([]);
    await propagar();
  });

  it('a busca filtra a página carregada por código ou nome, sem diferenciar caixa', async () => {
    await iniciar([modelo('INSCRICAO', 'Inscrição geral'), modelo('MATRICULA', 'Matrícula')]);

    store.termoBusca.set('  matr ');
    expect(store.modelosBuscados().map((m) => m.codigo)).toEqual(['MATRICULA']);

    store.termoBusca.set('geral');
    expect(store.modelosBuscados().map((m) => m.codigo)).toEqual(['INSCRICAO']);
  });

  it('navega para a próxima página e volta', async () => {
    await propagar();
    controller.expectOne((r) => r.url === URL_DOS_TIPOS).flush([]);
    await responder([modelo('A', 'A')], `<${URL_DA_LISTA}?cursor=abc&direction=next>; rel="next"`);
    expect(store.proximo()).not.toBeNull();

    store.proximaPagina();
    await propagar();
    const segunda = lista();
    expect(segunda.request.params.get('direction')).toBe('next');
    segunda.flush([modelo('B', 'B')], {
      headers: { Link: `<${URL_DA_LISTA}?cursor=def&direction=prev>; rel="prev"` },
    });
    await propagar();
    expect(store.anterior()).not.toBeNull();

    store.paginaAnterior();
    await propagar();
    expect(lista().request.params.get('direction')).toBe('prev');
  });

  it('uma falha 5xx avisa a pessoa e a mensagem de erro aparece', async () => {
    await propagar();
    controller.expectOne((r) => r.url === URL_DOS_TIPOS).flush([]);
    const [corpo, opcoes] = falha(503);
    lista().flush(corpo, opcoes);
    await propagar();

    expect(store.mensagemDeErro()).toBe('Indisponível');
    expect(notificacoes.errorFromProblem).toHaveBeenCalledOnce();
  });

  it('uma falha 4xx não notifica', async () => {
    await propagar();
    controller.expectOne((r) => r.url === URL_DOS_TIPOS).flush([]);
    const [corpo, opcoes] = falha(403);
    lista().flush(corpo, opcoes);
    await propagar();

    expect(store.mensagemDeErro()).toBe('Indisponível');
    expect(notificacoes.errorFromProblem).not.toHaveBeenCalled();
  });

  it('uma falha de rede mostra que não foi possível conectar ao servidor', async () => {
    await propagar();
    controller.expectOne((r) => r.url === URL_DOS_TIPOS).flush([]);
    lista().error(new ProgressEvent('error'));
    await propagar();

    expect(store.mensagemDeErro()).toBe('Não foi possível conectar ao servidor');
  });

  it('o cursor expirado reinicia a paginação e avisa, sem exibir erro', async () => {
    await propagar();
    controller.expectOne((r) => r.url === URL_DOS_TIPOS).flush([]);
    await responder([modelo('A', 'A')], `<${URL_DA_LISTA}?cursor=abc&direction=next>; rel="next"`);
    store.proximaPagina();
    await propagar();
    const [corpo, opcoes] = falha(410, 'uniplus.cursor.expirado');
    lista().flush(corpo, opcoes);
    await propagar();

    expect(notificacoes.info).toHaveBeenCalledWith(
      'A listagem ficou aberta tempo demais e a consulta expirou.',
      'Recarregamos a listagem do começo.',
    );
    expect(store.mensagemDeErro()).toBeNull();
    expect(lista().request.params.has('cursor')).toBe(false);
  });

  it('o cursor inválido avisa que a consulta mudou', async () => {
    await propagar();
    controller.expectOne((r) => r.url === URL_DOS_TIPOS).flush([]);
    await responder([modelo('A', 'A')], `<${URL_DA_LISTA}?cursor=abc&direction=next>; rel="next"`);
    store.proximaPagina();
    await propagar();
    const [corpo, opcoes] = falha(400, 'uniplus.cursor.invalido');
    lista().flush(corpo, opcoes);
    await propagar();

    expect(notificacoes.info).toHaveBeenCalledWith(
      'A paginação foi reiniciada porque a consulta mudou.',
      'Recarregamos a listagem do começo.',
    );
    lista().flush([]);
  });

  it('tentar novamente com a lista carregando não repete a consulta', async () => {
    await propagar();
    controller.expectOne((r) => r.url === URL_DOS_TIPOS).flush([]);

    store.tentarNovamente();
    await propagar();

    await responder([]);
  });

  it('tentar novamente com a lista parada refaz a consulta', async () => {
    await iniciar();

    store.tentarNovamente();
    await propagar();

    await responder([modelo('A', 'A')]);
    expect(store.modelosBuscados()).toHaveLength(1);
  });
});
