import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CenarioDaLista,
  LGPD,
  URL,
  USO_IMAGEM,
  comProximo,
} from './termos-consentimento-list.testing';

describe('TermosConsentimentoListPage — busca e paginação', () => {
  let c: CenarioDaLista;

  beforeEach(() => {
    c = new CenarioDaLista();
  });

  afterEach(() => c.encerrar());

  it('carrega a lista inicial de termos de consentimento', async () => {
    await c.montar();
    expect(c.store.termos().length).toBe(2);
    expect(c.store.termos()[0].nome).toBe('Termo LGPD');
  });

  it('aplica debounce de 300ms e normaliza com trim ao alterar a busca', async () => {
    vi.useFakeTimers();
    await c.montar();

    c.store.alterarBusca('  lgpd  ');

    vi.advanceTimersByTime(200);
    await c.propagar();
    c.controller.expectNone((r) => r.url === URL && r.params.has('q'));

    vi.advanceTimersByTime(100);
    await c.propagar();
    const req = c.controller.expectOne((r) => r.url === URL && r.params.get('q') === 'lgpd');
    req.flush([LGPD]);
    await c.propagar();

    expect(c.store.termos().length).toBe(1);
  });

  it('limpa filtros, cancela o debounce pendente e permite repetir o mesmo termo', async () => {
    vi.useFakeTimers();
    await c.montar();

    c.store.alterarBusca('lgpd');
    vi.advanceTimersByTime(150);
    await c.propagar();

    c.store.limparFiltros();
    await c.propagar();

    const req = c.controller.expectOne((r) => r.url === URL && !r.params.has('q'));
    req.flush([LGPD, USO_IMAGEM]);
    await c.propagar();

    vi.advanceTimersByTime(150);
    await c.propagar();
    c.controller.expectNone((r) => r.url === URL && r.params.get('q') === 'lgpd');
    expect(c.store.busca()).toBe('');

    c.store.alterarBusca('lgpd');
    vi.advanceTimersByTime(300);
    await c.propagar();

    c.controller.expectOne((r) => r.url === URL && r.params.get('q') === 'lgpd').flush([LGPD]);
  });

  it('ignora disparos se o termo normalizado for idêntico', async () => {
    vi.useFakeTimers();
    await c.montar();

    c.store.alterarBusca('lgpd');
    vi.advanceTimersByTime(300);
    await c.propagar();
    c.controller.expectOne((r) => r.url === URL && r.params.get('q') === 'lgpd').flush([LGPD]);

    c.store.alterarBusca('lgpd ');
    vi.advanceTimersByTime(300);
    await c.propagar();

    c.controller.expectNone((r) => r.url === URL && r.params.get('q') === 'lgpd');
  });

  it('zera cursores e lista imediatamente ao aplicar um novo filtro', async () => {
    await c.montar();

    vi.useFakeTimers();
    c.store.alterarBusca('novo-termo');
    vi.advanceTimersByTime(300);
    await c.propagar();

    expect(c.store.prevCursor()).toBeNull();
    expect(c.store.nextCursor()).toBeNull();
    expect(c.store.termos()).toEqual([]);

    const req = c.controller.expectOne((r) => r.url === URL && r.params.get('q') === 'novo-termo');
    req.flush([LGPD]);
    await c.propagar();
  });

  it('navega pelas páginas utilizando cursores obtidos do header Link', async () => {
    const linkHeader =
      '<http://localhost:5000/api/configuracao/termos-consentimento?cursor=next-123&direction=next>; rel="next"';
    await c.montar([LGPD], { Link: linkHeader });

    expect(c.store.nextCursor()).toBe('next-123');

    c.store.proximaPagina();
    await c.propagar();
    const req = c.controller.expectOne(
      (r) =>
        r.url === URL &&
        r.params.get('cursor') === 'next-123' &&
        r.params.get('direction') === 'next',
    );
    req.flush([USO_IMAGEM], {
      headers: {
        Link: '<http://localhost:5000/api/configuracao/termos-consentimento?cursor=prev-456&direction=prev>; rel="prev"',
      },
    });

    await c.propagar();
    expect(c.store.prevCursor()).toBe('prev-456');
  });

  it('preserva o filtro ao navegar para a próxima página', async () => {
    vi.useFakeTimers();
    await c.montar();

    c.store.alterarBusca('lgpd');
    vi.advanceTimersByTime(300);
    await c.propagar();
    c.controller
      .expectOne((r) => r.url === URL && r.params.get('q') === 'lgpd')
      .flush([LGPD], {
        headers: {
          Link: '<http://localhost:5000/api/configuracao/termos-consentimento?cursor=next-filtered&direction=next>; rel="next"',
        },
      });
    await c.propagar();

    c.store.proximaPagina();
    await c.propagar();

    c.controller
      .expectOne(
        (r) =>
          r.url === URL &&
          r.params.get('q') === 'lgpd' &&
          r.params.get('cursor') === 'next-filtered' &&
          r.params.get('direction') === 'next',
      )
      .flush([]);
  });

  it('ignora resposta atrasada de um filtro anterior', async () => {
    vi.useFakeTimers();
    await c.montar();

    c.store.alterarBusca('lgpd');
    vi.advanceTimersByTime(300);
    await c.propagar();
    const reqAnterior = c.controller.expectOne(
      (r) => r.url === URL && r.params.get('q') === 'lgpd',
    );

    c.store.alterarBusca('imagem');
    vi.advanceTimersByTime(300);
    await c.propagar();
    const reqAtual = c.controller.expectOne((r) => r.url === URL && r.params.get('q') === 'imagem');

    reqAtual.flush([USO_IMAGEM]);
    await c.propagar();
    expect(reqAnterior.cancelled).toBe(true);

    expect(c.store.termos()).toEqual([USO_IMAGEM]);
  });

  it('pagina e limpa a busca pelos botões da tela', async () => {
    await c.montar([LGPD], {
      Link: '<http://localhost:5000/x?cursor=next-1&direction=next>; rel="next"',
    });
    c.botao('Próximo').click();
    await c.propagar();
    c.controller
      .expectOne((r) => r.url === URL && r.params.get('cursor') === 'next-1')
      .flush([USO_IMAGEM], {
        headers: { Link: '<http://localhost:5000/x?cursor=prev-1&direction=prev>; rel="prev"' },
      });
    await c.propagar();
    c.botao('Anterior').click();
    await c.propagar();
    c.controller
      .expectOne((r) => r.url === URL && r.params.get('direction') === 'prev')
      .flush([LGPD]);
    await c.propagar();
    c.store.alterarBusca('lgpd');
    c.botao('Limpar').click();
    await c.propagar();
    expect(c.store.busca()).toBe('');
    c.controller.match((r) => r.url === URL).forEach((r) => r.flush([LGPD]));
  });

  it('voltar à busca já aplicada não repete a consulta, mas na página seguinte volta à primeira', async () => {
    vi.useFakeTimers();
    await c.montar([LGPD], comProximo('n1'));
    c.store.alterarBusca('lgpd');
    vi.advanceTimersByTime(300);
    await c.propagar();
    c.controller
      .expectOne((r) => r.url === URL && r.params.get('q') === 'lgpd')
      .flush([LGPD], { headers: comProximo('n2') });
    await c.propagar();
    c.store.alterarBusca('x');
    c.store.alterarBusca('lgpd');
    vi.advanceTimersByTime(300);
    await c.propagar();
    c.controller.expectNone((r) => r.url === URL && r.params.has('q'));

    c.store.proximaPagina();
    await c.propagar();
    c.controller.expectOne((r) => r.params.get('cursor') === 'n2').flush([USO_IMAGEM]);
    await c.propagar();
    c.store.alterarBusca('x');
    c.store.alterarBusca('lgpd');
    vi.advanceTimersByTime(300);
    await c.propagar();
    c.controller
      .expectOne((r) => r.url === URL && r.params.get('q') === 'lgpd' && !r.params.has('cursor'))
      .flush([LGPD]);
  });

  it('limpar a busca estando em outra página volta à primeira', async () => {
    await c.montar([LGPD], comProximo('n1'));
    c.store.proximaPagina();
    await c.propagar();
    c.controller.expectOne((r) => r.params.get('cursor') === 'n1').flush([USO_IMAGEM]);
    await c.propagar();
    c.store.alterarBusca('imagem');
    c.store.limparFiltros();
    await c.propagar();
    c.controller
      .expectOne((r) => r.url === URL && !r.params.has('cursor') && !r.params.has('q'))
      .flush([LGPD]);
  });

  it('limpar sem busca nem filtro não consulta de novo', async () => {
    await c.montar();
    c.store.limparFiltros();
    await c.propagar();
  });
});
