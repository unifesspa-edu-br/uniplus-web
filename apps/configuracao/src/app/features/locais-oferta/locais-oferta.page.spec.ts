import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TIPO_LOCAL_DE_TESTE } from './locais-oferta.testing';
import {
  LISTA,
  LOCAL_DE_TESTE,
  PaginaDeLocais,
  carregarLista,
  montarPaginaIniciada,
  raizDa,
} from './locais-oferta.pagina.testing';

describe('LocaisOfertaPage — listagem', () => {
  let pagina: PaginaDeLocais;

  beforeEach(() => {
    pagina = montarPaginaIniciada();
  });

  afterEach(() => pagina.controller.verify());

  const pedidoDaLista = () => pagina.controller.expectOne((r) => r.url === LISTA);

  it('renderiza a lista com tipo e cidade', async () => {
    await carregarLista(pagina, [LOCAL_DE_TESTE]);
    expect(pagina.store.locais()).toHaveLength(1);
    pagina.fixture.detectChanges();
    expect(pagina.fixture.nativeElement.textContent).toContain(TIPO_LOCAL_DE_TESTE.rotulo);
    expect(pagina.fixture.nativeElement.textContent).toContain('Marabá — PA');
  });

  it('navega pelo cursor e volta à primeira página ao recarregar', async () => {
    const { propagar, store } = pagina;
    const primeira = pedidoDaLista();
    expect(primeira.request.params.get('limit')).toBe('50');
    primeira.flush([LOCAL_DE_TESTE], {
      headers: new HttpHeaders({
        Link: `<${LISTA}?cursor=pagina-2&direction=next>; rel="next"`,
      }),
    });
    await propagar();
    store.proximaPagina();
    await propagar();
    const segunda = pedidoDaLista();
    expect(segunda.request.params.get('cursor')).toBe('pagina-2');
    expect(segunda.request.params.get('direction')).toBe('next');
    segunda.flush([]);
    await propagar();
    store.recarregar();
    await propagar();
    const recarga = pedidoDaLista();
    expect(recarga.request.params.get('limit')).toBe('50');
    recarga.flush([LOCAL_DE_TESTE]);
    await propagar();
  });

  it('expõe legenda acessível descrevendo a tabela', async () => {
    await carregarLista(pagina, [LOCAL_DE_TESTE]);
    pagina.fixture.detectChanges();

    const caption = pagina.fixture.nativeElement.querySelector('table > caption');
    // Sem `sr-only` a legenda vira texto visível acima da tabela e quebra o layout.
    expect(caption).not.toBeNull();
    expect(caption?.classList.contains('sr-only')).toBe(true);
    expect(caption?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Locais de oferta, com tipo, cidade, campus responsável e código e-MEC',
    );
  });

  it('volta à página anterior pelo cursor que a API devolveu', async () => {
    const { propagar, store } = pagina;
    pedidoDaLista().flush([LOCAL_DE_TESTE], {
      headers: new HttpHeaders({ Link: `<${LISTA}?cursor=p2&direction=next>; rel="next"` }),
    });
    await propagar();
    store.proximaPagina();
    await propagar();
    pedidoDaLista().flush([LOCAL_DE_TESTE], {
      headers: new HttpHeaders({ Link: `<${LISTA}?cursor=p1&direction=prev>; rel="prev"` }),
    });
    await propagar();
    store.paginaAnterior();
    await propagar();
    const anterior = pedidoDaLista();
    expect(anterior.request.params.get('cursor')).toBe('p1');
    expect(anterior.request.params.get('direction')).toBe('prev');
    anterior.flush([LOCAL_DE_TESTE]);
    await propagar();
  });

  it('notifica a falha do servidor na listagem e mostra o alerta com a mensagem', async () => {
    const notificar = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
    pedidoDaLista().flush(
      JSON.stringify({ type: 'about:blank', title: 'Erro interno', status: 500, code: 'x' }),
      {
        status: 500,
        statusText: 'Server Error',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await pagina.propagar();
    expect(notificar).toHaveBeenCalledTimes(1);
    expect(pagina.fixture.nativeElement.querySelector('ui-alert')?.textContent).toContain(
      pagina.store.mensagemDeErro(),
    );
  });

  it('"Tentar novamente" que dá certo leva o foco, que estava no botão, ao título da lista', async () => {
    const { elemento, propagar } = pagina;
    pedidoDaLista().flush(
      JSON.stringify({ type: 'about:blank', title: 'Falha', status: 400, code: 'x' }),
      {
        status: 400,
        statusText: 'Bad',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagar();
    const tentar = elemento<HTMLButtonElement>('ui-falha-de-leitura button');
    tentar.focus();
    tentar.click();
    await propagar();
    await carregarLista(pagina, [LOCAL_DE_TESTE]);
    await propagar();
    expect(raizDa(pagina).querySelector('.list-state__retry')).toBeNull();
    expect(document.activeElement).toBe(elemento('#cfg-locais-list-title'));
  });

  it('ignora "Tentar novamente" enquanto a listagem ainda carrega', () => {
    pagina.store.tentarNovamente();
    const pendentes = pagina.controller.match((r) => r.url === LISTA);
    expect(pendentes).toHaveLength(1);
  });
});
