import { afterEach, describe, expect, it } from 'vitest';
import {
  Pagina,
  desativado,
  isencao,
  montarPagina,
  problema,
  LISTA,
  PERMISSAO_DE_MANTER,
} from './motivos-de-decisao.testing';

describe('MotivosDeDecisaoPage — leitura', () => {
  let p: Pagina;
  afterEach(() => p.http.verify());

  it('lê o tipo inicial só com os ativos, na primeira página, com o vendor MIME do motivo', async () => {
    p = await montarPagina([]);
    p.store.recarregar();
    await p.propagar();

    const req = p.http.expectOne((r) => r.url === LISTA && r.method === 'GET');
    expect(req.request.params.get('tipo')).toBe('ISENCAO_DA_TAXA');
    expect(req.request.params.get('apenasAtivos')).toBe('true');
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.headers.get('Accept')).toBe(
      'application/vnd.uniplus.motivo-de-decisao.v1+json',
    );
    req.flush([]);
    await p.propagar();
  });

  it('mostra código, descrição, sentido, fundamento e situação de cada motivo', async () => {
    p = await montarPagina([isencao]);

    const linha = p.texto('tbody tr');
    expect(linha).toContain('RENDA_ACIMA_DO_LIMITE');
    expect(linha).toContain('Desfavorável ao candidato');
    expect(linha).toContain('BAIXA_RENDA');
    expect(linha).toContain('Ativo');
    expect(p.texto('thead')).toContain('Fundamento');
  });

  it('trocar o tipo lê o novo recorte e some a coluna de fundamento quando o tipo não a tem', async () => {
    p = await montarPagina([isencao]);
    const seletor = p.elemento<HTMLSelectElement>('[data-testid="motivos-tipo"]');

    seletor.value = 'CLASSIFICACAO';
    seletor.dispatchEvent(new Event('change'));
    await p.propagar();
    await p.lerLista(
      [{ ...desativado, tipo: 'CLASSIFICACAO', subclassificacao: null, ativo: true }],
      (q) => expect(q['tipo']).toBe('CLASSIFICACAO'),
    );

    expect(p.texto('thead')).not.toContain('Fundamento');
    expect(p.texto('tbody')).toContain('DOCUMENTO_ILEGIVEL');
  });

  it('mostrar os desativados tira o filtro de ativos da leitura e marca a situação', async () => {
    p = await montarPagina([isencao]);
    const caixa = p.elemento<HTMLInputElement>('[data-testid="motivos-desativados"]');

    caixa.checked = true;
    caixa.dispatchEvent(new Event('change'));
    await p.propagar();
    await p.lerLista([isencao, desativado], (q) => expect(q['apenasAtivos']).toBe('false'));

    expect(p.texto('tbody')).toContain('Desativado');
  });

  it('a busca filtra pelo código ou pela descrição e oferece limpar quando nada confere', async () => {
    p = await montarPagina([isencao, desativado]);

    p.store.termoBusca.set('ilegivel');
    await p.propagar();
    expect(p.texto('tbody')).toContain('DOCUMENTO_ILEGIVEL');
    expect(p.texto('tbody')).not.toContain('RENDA_ACIMA');

    p.store.termoBusca.set('inexistente');
    await p.propagar();
    expect(p.texto()).toContain('Nenhum motivo encontrado');
  });

  it('com mais de uma página, a busca sem resultado avisa que só alcança a página atual', async () => {
    p = await montarPagina([isencao]);
    p.store.recarregar();
    await p.propagar();
    p.http
      .expectOne((r) => r.url === LISTA)
      .flush([isencao], {
        headers: {
          Link: '</api/selecao/motivos-de-decisao?cursor=abc&direction=next>; rel="next"',
        },
      });
    await p.propagar();

    p.store.termoBusca.set('inexistente');
    await p.propagar();

    expect(p.texto('ui-empty-state')).toContain('Ela não alcança as outras páginas');
    expect(p.raiz().querySelector('ui-filter-bar input')?.getAttribute('placeholder')).toContain(
      'nesta página',
    );
  });

  it('com falha na leitura, mostra a recusa e a lista não finge estar vazia', async () => {
    p = await montarPagina([]);
    p.store.recarregar();
    await p.propagar();
    p.http
      .expectOne((r) => r.url === LISTA)
      .flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
    await p.propagar();

    expect(p.store.mensagemDeErro()).not.toBeNull();
    expect(p.texto()).not.toContain('Nenhum motivo cadastrado neste tipo');
    expect(p.erros).toHaveBeenCalled();
  });
});

describe('MotivosDeDecisaoPage — paginação', () => {
  let p: Pagina;
  afterEach(() => p.http.verify());

  it('navega pelo cursor, volta pela página anterior e reinicia na primeira ao recarregar', async () => {
    p = await montarPagina([isencao]);
    p.store.recarregar();
    await p.propagar();
    p.http
      .expectOne((r) => r.url === LISTA)
      .flush([isencao], {
        headers: {
          Link: '</api/selecao/motivos-de-decisao?cursor=abc&direction=next>; rel="next"',
        },
      });
    await p.propagar();

    p.store.proximaPagina();
    await p.propagar();
    const segunda = p.http.expectOne((r) => r.url === LISTA);
    expect(segunda.request.params.get('cursor')).toBe('abc');
    expect(segunda.request.params.get('direction')).toBe('next');
    segunda.flush([desativado], {
      headers: { Link: '</api/selecao/motivos-de-decisao?cursor=zzz&direction=prev>; rel="prev"' },
    });
    await p.propagar();
    expect(p.store.motivos()).toEqual([desativado]);

    p.store.paginaAnterior();
    await p.propagar();
    const voltando = p.http.expectOne((r) => r.url === LISTA);
    expect(voltando.request.params.get('direction')).toBe('prev');
    voltando.flush([isencao]);
    await p.propagar();

    p.store.recarregar();
    await p.propagar();
    const recarga = p.http.expectOne((r) => r.url === LISTA);
    expect(recarga.request.params.has('cursor')).toBe(false);
    recarga.flush([isencao]);
    await p.propagar();
  });
});

describe('MotivosDeDecisaoPage — nova tentativa', () => {
  let p: Pagina;
  afterEach(() => p.http.verify());

  it('"Tentar novamente" relê a lista e, ao dar certo, leva o foco ao título dela', async () => {
    p = await montarPagina([]);
    p.store.recarregar();
    await p.propagar();
    p.http
      .expectOne((r) => r.url === LISTA)
      .flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
    await p.propagar();
    const tentar = [...p.raiz().querySelectorAll('button')].find(
      (botao) => botao.textContent?.trim() === 'Tentar novamente',
    ) as HTMLButtonElement;

    tentar.focus();
    tentar.click();
    await p.propagar();
    await p.lerLista([isencao]);
    await p.propagar();
    await p.propagar();

    expect(p.store.mensagemDeErro()).toBeNull();
    expect(document.activeElement).toBe(p.elemento('#cfg-motivos-de-decisao-list-title'));
  });
});

describe('MotivosDeDecisaoPage — permissão', () => {
  let p: Pagina;
  afterEach(() => p.http.verify());

  it('com a permissão de manter, oferece criar, editar e desativar', async () => {
    p = await montarPagina([isencao]);

    expect(p.existe('#cfg-motivos-de-decisao-novo')).toBe(true);
    expect(p.pelaEtiqueta('Editar motivo RENDA_ACIMA_DO_LIMITE')).toBeTruthy();
    expect(p.pelaEtiqueta('Desativar motivo RENDA_ACIMA_DO_LIMITE')).toBeTruthy();
  });

  it('sem ela, a lista segue visível mas não oferece criar nem alterar', async () => {
    p = await montarPagina([isencao], { concedidas: [] });

    expect(p.texto()).toContain('RENDA_ACIMA_DO_LIMITE');
    expect(p.existe('#cfg-motivos-de-decisao-novo')).toBe(false);
    expect(p.raiz().querySelectorAll('td.table-responsive__actions button')).toHaveLength(0);
    expect(PERMISSAO_DE_MANTER).toBe('selecao:motivos-de-decisao:manter');
  });
});
