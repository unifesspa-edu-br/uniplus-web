import { HttpTestingController } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { CursoDto } from '@uniplus/shared-data/configuracao';
import { ligarRelogioControlado, passarOTempo } from '@uniplus/shared-testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CURSOS_URL, cursoSeed, montarCursosPage } from './cursos.listagem.testing';
import { CursosStore, ESPERA_DA_BUSCA_MS } from './cursos.store';

describe('CursosPage — paginação e busca', () => {
  let store!: CursosStore;
  let controller!: HttpTestingController;
  let appRef!: ApplicationRef;
  let propagate!: () => Promise<void>;
  let flushLista!: (itens: readonly CursoDto[]) => Promise<void>;
  let encerrar!: () => void;

  beforeEach(() => {
    ligarRelogioControlado();
    ({ store, controller, appRef, propagate, flushLista, encerrar } = montarCursosPage());
  });

  afterEach(() => {
    encerrar();
    vi.useRealTimers();
  });

  it('trocar itens por página recarrega a primeira página com o novo limit', async () => {
    await flushLista([cursoSeed]);

    store.aoTrocarLimite(100);
    await propagate();

    const req = controller.expectOne((r) => r.url === CURSOS_URL);
    expect(req.request.params.get('limit')).toBe('100');
    expect(req.request.params.has('cursor')).toBe(false);
    req.flush([cursoSeed]);
    await propagate();
    expect(store.limite()).toBe(100);
  });

  it('trocar itens por página a partir de uma página navegada volta ao início sem cursor', async () => {
    const p1 = controller.expectOne((r) => r.url === CURSOS_URL);
    p1.flush([cursoSeed], {
      headers: { Link: `<${CURSOS_URL}?cursor=pagina-2&direction=next>; rel="next"` },
    });
    await propagate();

    store.proximaPagina();
    await propagate();
    const p2 = controller.expectOne((r) => r.url === CURSOS_URL);
    expect(p2.request.params.get('cursor')).toBe('pagina-2');
    p2.flush([cursoSeed]);
    await propagate();

    store.aoTrocarLimite(50);
    await propagate();

    const p3 = controller.expectOne((r) => r.url === CURSOS_URL);
    expect(p3.request.params.get('limit')).toBe('50');
    expect(p3.request.params.has('cursor')).toBe(false);
    p3.flush([cursoSeed]);
    await propagate();
  });

  it('CA-01/CA-14a: a listagem não envia sort — consome a ordem alfabética que a API devolve por padrão', async () => {
    const req = controller.expectOne((r) => r.url === CURSOS_URL);
    expect(req.request.params.has('sort')).toBe(false);
    expect(req.request.params.has('ordenarPor')).toBe(false);

    // A API devolve fora da ordem dos identificadores; a Web apresenta na
    // sequência recebida, sem reordenar a página localmente.
    const foraDeOrdem: readonly CursoDto[] = [
      {
        ...cursoSeed,
        id: '01960000-0000-7000-0000-0000000000c9',
        codigo: 'ADM',
        nome: 'Administração',
      },
      {
        ...cursoSeed,
        id: '01960000-0000-7000-0000-0000000000c1',
        codigo: 'ZOO',
        nome: 'Zootecnia',
      },
    ];
    req.flush(foraDeOrdem);
    await propagate();

    expect(store.cursos().map((c) => c.nome)).toEqual(['Administração', 'Zootecnia']);
  });

  it('CA-14c: cursor recusado (400) na navegação recarrega a listagem do início, sem cursor', async () => {
    const p1 = controller.expectOne((r) => r.url === CURSOS_URL);
    p1.flush([cursoSeed], {
      headers: { Link: `<${CURSOS_URL}?cursor=p2&direction=next>; rel="next"` },
    });
    await propagate();

    store.proximaPagina();
    await propagate();
    const p2 = controller.expectOne((r) => r.url === CURSOS_URL);
    expect(p2.request.params.get('cursor')).toBe('p2');
    p2.flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.cursor.invalido',
        title: 'Cursor de paginação inválido',
        status: 400,
        code: 'uniplus.cursor.invalido',
        traceId: 'test-trace',
      }),
      {
        status: 400,
        statusText: 'Bad Request',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();

    // Volta à primeira página automaticamente: novo GET sem cursor.
    const recarga = controller.expectOne((r) => r.url === CURSOS_URL);
    expect(recarga.request.params.has('cursor')).toBe(false);
    expect(recarga.request.params.has('limit')).toBe(true);
    recarga.flush([cursoSeed]);
    await propagate();
    expect(store.mensagemDeErro()).toBeNull();
  });

  it('CA-14c: cursor expirado (410) também recarrega do início', async () => {
    const p1 = controller.expectOne((r) => r.url === CURSOS_URL);
    p1.flush([cursoSeed], {
      headers: { Link: `<${CURSOS_URL}?cursor=p2&direction=next>; rel="next"` },
    });
    await propagate();

    store.proximaPagina();
    await propagate();
    controller
      .expectOne((r) => r.url === CURSOS_URL)
      .flush(
        JSON.stringify({
          type: 'https://uniplus.dev/erros/uniplus.cursor.expirado',
          title: 'Cursor de paginação expirado',
          status: 410,
          code: 'uniplus.cursor.expirado',
          traceId: 'test-trace',
        }),
        {
          status: 410,
          statusText: 'Gone',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
    await propagate();

    const recarga = controller.expectOne((r) => r.url === CURSOS_URL);
    expect(recarga.request.params.has('cursor')).toBe(false);
    recarga.flush([cursoSeed]);
    await propagate();
  });

  it('CA-14c: 400/410 na PRIMEIRA página (sem cursor) mostra a mensagem da API, não uma tela muda', async () => {
    // Contrato não prevê (a 1ª página nunca manda cursor), mas a guarda não pode
    // silenciar a mensagem sem também recuperar: o operador tem de ver algo.
    const p1 = controller.expectOne((r) => r.url === CURSOS_URL);
    expect(p1.request.params.has('cursor')).toBe(false);
    p1.flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.cursor.expirado',
        title: 'Cursor de paginação expirado',
        status: 410,
        code: 'uniplus.cursor.expirado',
        traceId: 'test-trace',
      }),
      { status: 410, statusText: 'Gone', headers: { 'content-type': 'application/problem+json' } },
    );
    await propagate();

    // Sem recarga automática em loop (não havia página para recomeçar) e com
    // mensagem visível.
    controller.expectNone((r) => r.url === CURSOS_URL);
    expect(store.mensagemDeErro()).toBe('Cursor de paginação expirado');
  });

  it('CA-14b: 422 de busca é apresentado com a mensagem da API', async () => {
    await flushLista([cursoSeed]);

    store.termoBusca.set('x'.repeat(201));
    await passarOTempo(ESPERA_DA_BUSCA_MS);
    await propagate();

    const req = controller.expectOne((r) => r.url === CURSOS_URL && r.params.has('q'));
    req.flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.consulta.busca_muito_longa',
        title: 'Busca inválida',
        detail: 'O texto pesquisado excede 200 caracteres.',
        status: 422,
        code: 'uniplus.consulta.busca_muito_longa',
        traceId: 'test-trace',
      }),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(store.mensagemDeErro()).toBe('O texto pesquisado excede 200 caracteres.');
  });

  it('busca server-side: digitação em rajada dispara um único GET com q após o debounce, na primeira página', async () => {
    await flushLista([cursoSeed]);

    store.termoBusca.set('a');
    store.termoBusca.set('adm');
    store.termoBusca.set('administ');
    appRef.tick();
    await passarOTempo(ESPERA_DA_BUSCA_MS - 1);
    controller.expectNone((r) => r.url === CURSOS_URL && r.params.has('q'));

    await passarOTempo(1);
    await propagate();

    const req = controller.expectOne((r) => r.url === CURSOS_URL && r.params.has('q'));
    expect(req.request.params.get('q')).toBe('administ');
    expect(req.request.params.has('cursor')).toBe(false);
    expect(req.request.params.has('limit')).toBe(true);
    req.flush([{ ...cursoSeed, codigo: 'ADM', nome: 'Administração' }]);
    await propagate();
    expect(store.cursos()).toHaveLength(1);
  });

  it('navegar com busca ativa reanexa q (o cursor não carrega o filtro)', async () => {
    await flushLista([cursoSeed]);

    store.termoBusca.set('eng');
    await passarOTempo(ESPERA_DA_BUSCA_MS);
    await propagate();

    const p1 = controller.expectOne((r) => r.url === CURSOS_URL && r.params.get('q') === 'eng');
    p1.flush([cursoSeed], {
      headers: { Link: `<${CURSOS_URL}?cursor=p2&direction=next>; rel="next"` },
    });
    await propagate();

    store.proximaPagina();
    await propagate();

    const p2 = controller.expectOne((r) => r.url === CURSOS_URL);
    expect(p2.request.params.get('q')).toBe('eng');
    expect(p2.request.params.get('cursor')).toBe('p2');
    p2.flush([cursoSeed]);
    await propagate();
  });
});
