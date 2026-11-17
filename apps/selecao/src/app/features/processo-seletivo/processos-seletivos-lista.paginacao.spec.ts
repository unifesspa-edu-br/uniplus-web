import { mockProblemDetails } from '@uniplus/shared-testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CenarioDaListaDeProcessos,
  URL_LISTA,
  processo,
} from './processos-seletivos-lista.page.testing';

describe('ProcessosSeletivosListaPage', () => {
  let cenario: CenarioDaListaDeProcessos;

  beforeEach(() => {
    cenario = CenarioDaListaDeProcessos.preparar();
  });

  afterEach(() => cenario.controller.verify());

  it('navega para a próxima página com o cursor do header Link', async () => {
    await cenario.responderLista(
      [processo()],
      `<${URL_LISTA}?cursor=pagina-2&direction=next>; rel="next"`,
    );

    (cenario.tela().querySelector('[data-pager="next"]') as HTMLButtonElement).click();
    cenario.fixture.detectChanges();

    const req = cenario.controller.expectOne((r) => r.url === URL_LISTA);

    expect(req.request.params.get('cursor')).toBe('pagina-2');
    expect(req.request.params.get('direction')).toBe('next');
    // O cursor já carrega a janela; reenviar `limit` seria divergir do
    // contrato de navegação (ADR-0026).
    expect(req.request.params.get('limit')).toBeNull();

    req.flush([processo({ id: 'outro-id', nome: 'Vestibular 2026.2' })]);
    await cenario.propagar();
  });

  it('volta para a página anterior com o cursor rel="prev"', async () => {
    await cenario.responderLista(
      [processo()],
      `<${URL_LISTA}?cursor=pagina-0&direction=prev>; rel="prev"`,
    );

    (cenario.tela().querySelector('[data-pager="prev"]') as HTMLButtonElement).click();
    cenario.fixture.detectChanges();

    const req = cenario.controller.expectOne((r) => r.url === URL_LISTA);

    expect(req.request.params.get('cursor')).toBe('pagina-0');
    expect(req.request.params.get('direction')).toBe('prev');

    req.flush([processo()]);
    await cenario.propagar();
  });

  it('recarrega a primeira página, sem cursor, ao trocar os itens por página', async () => {
    await cenario.responderLista(
      [processo()],
      `<${URL_LISTA}?cursor=pagina-2&direction=next>; rel="next"`,
    );
    (cenario.tela().querySelector('[data-pager="next"]') as HTMLButtonElement).click();
    cenario.fixture.detectChanges();
    await cenario.responderLista(
      [processo({ id: 'outro-id', nome: 'Vestibular 2026.2' })],
      `<${URL_LISTA}?cursor=pagina-1&direction=prev>; rel="prev"`,
    );

    const select = cenario.tela().querySelector<HTMLSelectElement>('[data-pager="page-size"]');
    if (select === null) throw new Error('O seletor de itens por página não está no rodapé.');
    select.value = '25';
    select.dispatchEvent(new Event('change'));
    cenario.fixture.detectChanges();

    const req = cenario.controller.expectOne((r) => r.url === URL_LISTA);
    expect(req.request.params.get('limit')).toBe('25');
    expect(req.request.params.get('cursor')).toBeNull();
    expect(req.request.params.get('direction')).toBeNull();
    req.flush([processo()]);
    await cenario.propagar();
  });

  it('deixa a navegação indisponível quando o header Link não traz cursor algum', async () => {
    await cenario.responderLista([processo()]);

    expect(cenario.tela().querySelector('[data-pager="next"]')?.getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(cenario.tela().querySelector('[data-pager="prev"]')?.getAttribute('aria-disabled')).toBe(
      'true',
    );
  });

  /**
   * Invariante da ADR-0026: falha de **navegação** preserva a página em tela e
   * os cursores. Esvaziar a tabela tiraria do operador o conteúdo que ele já
   * estava lendo por causa de uma rede que caiu.
   */
  it('preserva a página atual quando a navegação falha', async () => {
    await cenario.responderLista(
      [processo()],
      `<${URL_LISTA}?cursor=pagina-2&direction=next>; rel="next"`,
    );

    (cenario.tela().querySelector('[data-pager="next"]') as HTMLButtonElement).click();
    cenario.fixture.detectChanges();

    cenario.controller
      .expectOne((r) => r.url === URL_LISTA)
      .flush(mockProblemDetails({ status: 503, title: 'Serviço indisponível' }), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/problem+json' },
      });
    await cenario.propagar();
    cenario.fixture.detectChanges();

    expect(cenario.tela().querySelectorAll('tbody tr')).toHaveLength(1);
    expect(cenario.tela().querySelector('.alert--danger')?.textContent).toContain(
      'Serviço indisponível',
    );
    expect(cenario.tela().querySelector('[data-pager="next"]')).not.toBeNull();
  });

  /** Falha na primeira página limpa: o que estava em tela pode não valer mais. */
  it('limpa a lista quando a primeira página falha', async () => {
    cenario.controller
      .expectOne((r) => r.url === URL_LISTA)
      .flush(mockProblemDetails({ status: 500, title: 'Falha ao listar' }), {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'application/problem+json' },
      });
    await cenario.propagar();
    cenario.fixture.detectChanges();

    expect(cenario.tela().querySelector('tbody tr')).toBeNull();
    expect(cenario.tela().querySelector('.alert--danger')).not.toBeNull();
    expect(cenario.tela().querySelector('[data-pager="next"]')).toBeNull();
  });

  it('relê a página pelo botão de nova tentativa', async () => {
    cenario.controller
      .expectOne((r) => r.url === URL_LISTA)
      .flush(mockProblemDetails({ status: 500, title: 'Falha ao listar' }), {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'application/problem+json' },
      });
    await cenario.propagar();
    cenario.fixture.detectChanges();

    const botao = Array.from(
      cenario.tela().querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent?.includes('Tentar novamente'));
    botao?.click();
    cenario.fixture.detectChanges();

    await cenario.responderLista([processo()]);

    expect(cenario.tela().querySelectorAll('tbody tr')).toHaveLength(1);
    expect(cenario.tela().querySelector('.alert--danger')).toBeNull();
  });
});
