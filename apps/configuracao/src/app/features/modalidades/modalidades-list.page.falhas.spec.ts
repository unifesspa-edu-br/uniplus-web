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

    it('navega entre páginas por cursor e volta à primeira ao recarregar', async () => {
      const store = pagina.fixture.debugElement.injector.get(ModalidadesStore);
      pagina.controller
        .expectOne((r) => r.url === URL)
        .flush([AC], { headers: { Link: `<${URL}?cursor=p2&direction=next>; rel="next"` } });
      pagina.controller.match(URL_CATALOGO).forEach((r) => r.flush(CATALOGO));
      await pagina.propagate();
      expect(store.proximo()).not.toBeNull();

      store.proximaPagina();
      await pagina.propagate();
      const segunda = pagina.controller.expectOne((r) => r.params.get('cursor') === 'p2');
      expect(segunda.request.params.get('direction')).toBe('next');
      segunda.flush([V], { headers: { Link: `<${URL}?cursor=p1&direction=prev>; rel="prev"` } });
      await pagina.propagate();
      expect(store.modalidades().map((m) => m.codigo)).toEqual(['V']);

      store.paginaAnterior();
      await pagina.propagate();
      const volta = pagina.controller.expectOne((r) => r.params.get('cursor') === 'p1');
      expect(volta.request.params.get('direction')).toBe('prev');
      volta.flush([AC]);
      await pagina.propagate();

      store.recarregar();
      await pagina.propagate();
      expect(
        pagina.controller
          .expectOne((r) => r.params.get('cursor') === null)
          .request.params.get('limit'),
      ).toBe('100');
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
    });
  });
});
