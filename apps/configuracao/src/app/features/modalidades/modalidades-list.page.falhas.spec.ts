import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CATALOGO } from './catalogo-de-fatos.fixture';
import { EdicaoDasModalidades } from './edicao-das-modalidades';
import { PaginaDaListaDeModalidades, V } from './modalidades-list.page.testing';
import { AC, BASE, URL, URL_CATALOGO } from './modalidades-de-teste.testing';
import { ModalidadesStore } from './modalidades.store';

describe('ModalidadesListPage', () => {
  let pagina: PaginaDaListaDeModalidades;

  beforeEach(() => {
    pagina = new PaginaDaListaDeModalidades();
  });

  afterEach(() => {
    pagina.verificar();
  });

  describe('leitura e remoção com falha', () => {
    const problema = (status: number): Record<string, unknown> => ({
      type: 'about:blank',
      title: 'Indisponível',
      status,
      code: 'erro',
    });
    const falhar = (req: ReturnType<HttpTestingController['expectOne']>, status: number): void =>
      req.flush(problema(status), { status, statusText: 'Falha' });

    it('lê todas as páginas e volta à primeira ao recarregar', async () => {
      const store = pagina.fixture.debugElement.injector.get(ModalidadesStore);
      await pagina.flushEmDuasPaginas([AC], [V]);
      expect(store.modalidades().map((m) => m.codigo)).toEqual(['AC', 'V']);

      store.recarregar();
      await pagina.propagate();
      const primeira = pagina.controller.expectOne(
        (r) => r.url === URL && r.params.get('cursor') === null,
      );
      expect(primeira.request.params.get('limit')).toBe('100');
      primeira.flush([AC]);
      await pagina.propagate();
      expect(store.modalidades().map((m) => m.codigo)).toEqual(['AC']);
    });

    it('a falha da segunda página explica o erro e não deixa a lista pela metade', async () => {
      const store = pagina.fixture.debugElement.injector.get(ModalidadesStore);
      pagina.controller
        .expectOne((r) => r.url === URL && r.params.get('cursor') === null)
        .flush([AC], { headers: { Link: `<${URL}?cursor=p2&direction=next>; rel="next"` } });
      await pagina.propagate();
      falhar(
        pagina.controller.expectOne((r) => r.url === URL && r.params.get('cursor') === 'p2'),
        503,
      );
      pagina.controller.match(URL_CATALOGO).forEach((r) => r.flush(CATALOGO));
      await pagina.propagate();
      expect(store.mensagemDeErro()).toBeTruthy();
      expect(store.modalidades()).toEqual([]);
    });

    it('explica a falha da listagem e só tenta de novo quando não está carregando', async () => {
      const store = pagina.fixture.debugElement.injector.get(ModalidadesStore);
      falhar(
        pagina.controller.expectOne((r) => r.url === URL),
        503,
      );
      pagina.controller.match(URL_CATALOGO).forEach((r) => r.flush(CATALOGO));
      await pagina.propagate();
      expect(store.mensagemDeErro()).toBeTruthy();

      store.tentarNovamente();
      store.tentarNovamente();
      await pagina.propagate();
      pagina.controller.expectOne((r) => r.url === URL).flush([AC]);
      await pagina.propagate();
      expect(store.mensagemDeErro()).toBeNull();
    });

    it('explica que não conectou quando a listagem falha sem resposta do servidor', async () => {
      const store = pagina.fixture.debugElement.injector.get(ModalidadesStore);
      pagina.controller.expectOne((r) => r.url === URL).error(new ProgressEvent('error'));
      pagina.controller.match(URL_CATALOGO).forEach((r) => r.flush(CATALOGO));
      await pagina.propagate();
      expect(store.mensagemDeErro()).toBe('Não foi possível conectar ao servidor');
    });

    it('libera a remoção e informa quando o servidor falha sem ser conflito', async () => {
      await pagina.flushLista([V]);
      const edicao = pagina.fixture.debugElement.injector.get(EdicaoDasModalidades);
      edicao.remover(V);
      falhar(
        pagina.controller.expectOne(`${BASE}/api/configuracao/admin/modalidades/${V.id}`),
        500,
      );
      await pagina.propagate();
      expect(edicao.removendo()).toBe(false);
      expect(edicao.mensagemBloqueioServidor()).toBeTruthy();
      expect(edicao.bloqueioServidor()).toBe(false);
    });

    it('anuncia quando a recarga depois da remoção falha', async () => {
      await pagina.flushLista([V]);
      const edicao = pagina.fixture.debugElement.injector.get(EdicaoDasModalidades);
      edicao.remover(V);
      pagina.controller
        .expectOne(`${BASE}/api/configuracao/admin/modalidades/${V.id}`)
        .flush(null, { status: 204, statusText: 'No Content' });
      await pagina.propagate();
      falhar(
        pagina.controller.expectOne((r) => r.url === URL),
        503,
      );
      await pagina.propagate();
      expect(edicao.removendo()).toBe(false);
      expect(edicao.anuncio()).toBe('Não foi possível recarregar as modalidades.');
      expect(pagina.fixture.debugElement.injector.get(ModalidadesStore).modalidades()).toEqual([]);
    });

    it('a falha da recarga depois de uma leitura boa esvazia a lista e mostra o erro', async () => {
      const store = pagina.fixture.debugElement.injector.get(ModalidadesStore);
      await pagina.flushLista([AC, V]);
      store.recarregar();
      await pagina.propagate();
      falhar(
        pagina.controller.expectOne((r) => r.url === URL),
        503,
      );
      await pagina.propagate();
      expect(store.modalidades()).toEqual([]);
      expect(store.mensagemDeErro()).not.toBeNull();
    });

    it('a nova tentativa depois da falha não mostra a lista velha enquanto a leitura não termina', async () => {
      const store = pagina.fixture.debugElement.injector.get(ModalidadesStore);
      await pagina.flushLista([AC, V]);
      store.recarregar();
      await pagina.propagate();
      falhar(
        pagina.controller.expectOne((r) => r.url === URL),
        503,
      );
      await pagina.propagate();

      store.tentarNovamente();
      await pagina.propagate();
      expect(store.carregando()).toBe(true);
      expect(store.modalidades()).toEqual([]);

      pagina.controller.expectOne((r) => r.url === URL).flush([AC]);
      await pagina.propagate();
      expect(store.carregando()).toBe(false);
      expect(store.modalidades().map((m) => m.codigo)).toEqual(['AC']);
    });
  });
});
