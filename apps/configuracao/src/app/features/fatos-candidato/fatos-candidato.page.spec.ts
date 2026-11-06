import { afterEach, describe, expect, it } from 'vitest';
import {
  CATALOGO,
  LISTA,
  PERMISSAO_DE_CONSULTAR,
  Pagina,
  comAprovacao,
  corRaca,
  montarPagina,
  problema,
  trabalha,
  PROTECAO,
} from './fatos-candidato.testing';
import {
  situacaoDaNovaTentativa,
  textoRepetidaDe,
  textoTentandoDe,
} from '../../shared/foco/situacao-da-nova-tentativa.testing';

describe('FatosCandidatoPage — leitura', () => {
  let p: Pagina;
  afterEach(() => {
    p.atenderApoios();
    p.atenderPendencias();
    p.http.verify();
  });

  describe('consulta', () => {
    it('CA-01: pede só os ativos, na primeira página, com o vendor MIME do fato', async () => {
      p = await montarPagina([]);
      p.store.recarregar();
      await p.propagar();
      const req = p.http.expectOne((r) => r.url === LISTA && r.method === 'GET');
      expect(req.request.params.get('ativo')).toBe('true');
      expect(req.request.params.get('limit')).toBe('50');
      expect(req.request.params.has('origem')).toBe(false);
      expect(req.request.headers.get('Accept')).toBe(
        'application/vnd.uniplus.fato-candidato.v1+json',
      );
      req.flush([]);
      await p.propagar();
    });

    it('CA-01: a situação e a origem escolhidas chegam à consulta da API', async () => {
      p = await montarPagina([]);

      p.store.filtroOrigem.set('DERIVADO');
      p.store.filtroSituacao.set('');
      await p.propagar();

      const filtrada = p.http.expectOne((r) => r.url === LISTA && r.method === 'GET');
      expect(filtrada.request.params.get('origem')).toBe('DERIVADO');
      expect(filtrada.request.params.has('ativo')).toBe(false);
      filtrada.flush([]);
      await p.propagar();
    });

    it('os chips de origem e de situação mudam o filtro, e o filtro ativo aparece na barra', async () => {
      p = await montarPagina([]);

      const chip = [...p.raiz().querySelectorAll<HTMLElement>('ui-filter-chips button')].find(
        (b) => b.textContent?.trim() === 'Derivado',
      );
      expect(chip).toBeDefined();
      chip?.click();
      await p.propagar();

      expect(p.store.filtroOrigem()).toBe('DERIVADO');
      p.http.expectOne((r) => r.url === LISTA && r.params.get('origem') === 'DERIVADO').flush([]);
      await p.propagar();
      expect(p.texto('ui-filter-bar')).toContain('Origem');
    });

    it('trocar o filtro volta à primeira página, sem o cursor do filtro anterior', async () => {
      p = await montarPagina([]);
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA && r.method === 'GET')
        .flush([trabalha], {
          headers: { Link: `<${LISTA}?cursor=pagina-2&direction=next>; rel="next"` },
        });
      await p.propagar();
      p.store.proximaPagina();
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA && r.params.has('cursor')).flush([corRaca]);
      await p.propagar();

      p.store.filtroOrigem.set('DECLARADO');
      await p.propagar();

      const filtrada = p.http.expectOne((r) => r.url === LISTA && r.method === 'GET');
      expect(filtrada.request.params.has('cursor'), 'o cursor era do filtro anterior').toBe(false);
      filtrada.flush([]);
      await p.propagar();
    });

    it('a falha na primeira página do filtro novo não deixa no paginador o cursor do filtro anterior', async () => {
      p = await montarPagina([]);
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA && r.method === 'GET')
        .flush([], { headers: { Link: `<${LISTA}?cursor=pagina-2&direction=next>; rel="next"` } });
      await p.propagar();
      expect(p.store.proximo()).not.toBeNull();

      p.store.filtroOrigem.set('DERIVADO');
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA && r.method === 'GET')
        .flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();

      expect(p.store.proximo()).toBeNull();
    });

    it('preserva a página e os cursores quando a navegação falha, e permite tentar novamente', async () => {
      p = await montarPagina([]);
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA && r.method === 'GET')
        .flush([trabalha], {
          headers: { Link: `<${LISTA}?cursor=abc&direction=next>; rel="next"` },
        });
      await p.propagar();
      p.store.proximaPagina();
      await p.propagar();
      const requisicao = p.http.expectOne((r) => r.url === LISTA && r.method === 'GET');
      expect(requisicao.request.params.get('cursor')).toBe('abc');
      expect(requisicao.request.params.get('direction')).toBe('next');
      expect(requisicao.request.params.has('limit')).toBe(false);
      requisicao.flush(...problema(503, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();
      expect(p.store.fatos()).toEqual([trabalha]);
      expect(p.store.proximo()).not.toBeNull();

      p.store.tentarNovamente();
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA && r.params.get('cursor') === 'abc').flush([corRaca]);
      await p.propagar();
      expect(p.store.fatos()).toEqual([corRaca]);
    });

    it('a busca filtra por código ou nome só na página carregada', async () => {
      p = await montarPagina();

      p.store.termoBusca.set('  cor  ');
      expect(p.store.fatosBuscados()).toEqual([corRaca]);
      p.store.termoBusca.set('trabalha');
      expect(p.store.fatosBuscados()).toEqual([trabalha]);
      p.store.termoBusca.set('inexistente');
      await p.propagar();
      expect(p.texto()).toContain('Nenhum fato encontrado');
    });
  });

  describe('falha da lista', () => {
    it('5xx mostra o alerta com "Tentar novamente" e avisa por toast; 4xx não', async () => {
      p = await montarPagina([]);
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA && r.method === 'GET')
        .flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();

      expect(p.texto('ui-alert')).toContain('Não foi possível carregar os fatos');
      expect(p.erros).toHaveBeenCalledTimes(1);

      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA && r.method === 'GET')
        .flush(...problema(403, { code: 'uniplus.auth.forbidden' }));
      await p.propagar();
      expect(p.erros).toHaveBeenCalledTimes(1);
    });

    it('"Tentar novamente" foca o título da lista quando a nova tentativa dá certo', async () => {
      p = await montarPagina([]);
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA && r.method === 'GET')
        .flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();

      const tentar = p.botaoPeloTexto('Tentar novamente') as HTMLButtonElement;
      tentar.focus();
      tentar.click();
      await p.propagar();
      expect(tentar.getAttribute('aria-disabled')).toBe('true');
      p.http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush([trabalha]);
      await p.propagar();
      await p.propagar();

      expect(document.activeElement).toBe(p.titulo());
    });
  });

  describe('permissão', () => {
    it('sem a de manter, a lista segue visível mas não oferece criar, editar nem desativar', async () => {
      p = await montarPagina([trabalha], { concedidas: [PERMISSAO_DE_CONSULTAR] });

      expect(p.texto()).toContain('Trabalha');
      expect(p.existe('#cfg-fatos-novo')).toBe(false);
      expect(p.raiz().querySelectorAll('td.table-responsive__actions button')).toHaveLength(0);
      p.http.expectNone((r) => r.url.includes('protecao-do-catalogo'));
    });

    it('sem a de manter, abre o detalhe só de leitura', async () => {
      p = await montarPagina([comAprovacao(trabalha, 'AJUSTE_RECOMENDADO', 'SENSIVEL')], {
        concedidas: [PERMISSAO_DE_CONSULTAR],
      });

      await p.acionar(p.nomeDaLinha());

      const rodape = [...p.detalhe().querySelectorAll('.form-drawer__footer button')].map((b) =>
        b.textContent?.trim(),
      );
      expect(rodape).toEqual(['Fechar']);
      p.http.match((r) => r.url.includes('/protecao/atos')).forEach((r) => r.flush([]));
    });
  });

  describe('tabela', () => {
    it('o nome da linha é um botão nativo, alcançável por Tab, com nome acessível', async () => {
      p = await montarPagina([corRaca]);

      const alvo = p.nomeDaLinha(corRaca);
      expect(alvo.type).toBe('button');
      expect(alvo.disabled).toBe(false);
      expect(alvo.tabIndex).toBeGreaterThanOrEqual(0);
      expect(p.elemento('tbody tr').hasAttribute('onclick')).toBe(false);
    });

    it('descreve a tabela por uma legenda acessível e rotula a região rolável', async () => {
      p = await montarPagina([trabalha]);

      expect(p.elemento('table > caption').classList.contains('sr-only')).toBe(true);
      expect(p.texto('table > caption')).toContain('Use o nome para abrir o detalhe.');
      expect(p.elemento('.table-responsive').getAttribute('aria-label')).toBe(
        'Lista de fatos do candidato',
      );
    });

    it('mostra origem, tipo de dado, situação e sensibilidade em palavras', async () => {
      p = await montarPagina([comAprovacao(corRaca, 'AJUSTE_RECOMENDADO', 'SENSIVEL')]);

      const linha = p.texto('tbody tr');
      for (const esperado of [
        'COR_RACA',
        'Declarado pelo candidato',
        'Lista de valores',
        'Ativo',
        'Pessoal sensível',
        'Ajuste recomendado',
      ]) {
        expect(linha).toContain(esperado);
      }
      expect(p.texto('tbody')).not.toContain('Classificação recomendada');
    });

    it('paginação: sem Link não há paginador; com Link o botão "próxima" busca com o cursor', async () => {
      p = await montarPagina([trabalha]);
      expect(p.existe('ui-pager')).toBe(false);

      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA && r.method === 'GET')
        .flush([trabalha], {
          headers: { Link: `<${LISTA}?cursor=p2&direction=next>; rel="next"` },
        });
      await p.propagar();

      expect(p.existe('ui-pager')).toBe(true);
      const proxima = [...p.raiz().querySelectorAll<HTMLButtonElement>('ui-pager button')].find(
        (b) => /pr[óo]xim/iu.test(b.textContent ?? b.getAttribute('aria-label') ?? ''),
      ) as HTMLButtonElement;
      proxima.click();
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA && r.params.get('cursor') === 'p2').flush([corRaca]);
      await p.propagar();
      expect(p.store.fatos()).toEqual([corRaca]);
    });
  });

  describe('cursor recusado e falhas sem resposta', () => {
    const naSegundaPagina = async (): Promise<void> => {
      p = await montarPagina([]);
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA && r.method === 'GET')
        .flush([trabalha], {
          headers: { Link: `<${LISTA}?cursor=abc&direction=next>; rel="next"` },
        });
      await p.propagar();
      p.store.proximaPagina();
      await p.propagar();
    };

    it.each([
      ['uniplus.cursor.invalido', 'A paginação foi reiniciada porque a consulta mudou.'],
      ['uniplus.cursor.expirado', 'A listagem ficou aberta tempo demais e a consulta expirou.'],
    ])('o cursor %s reinicia do começo, avisa e não mostra erro', async (code, aviso) => {
      await naSegundaPagina();

      p.http
        .expectOne((r) => r.url === LISTA && r.params.get('cursor') === 'abc')
        .flush(...problema(400, { code }));
      await p.propagar();

      const reinicio = p.http.expectOne((r) => r.url === LISTA && r.method === 'GET');
      expect(reinicio.request.params.has('cursor')).toBe(false);
      reinicio.flush([trabalha]);
      await p.propagar();
      expect(p.informacoes).toHaveBeenCalledWith(aviso, 'Recarregamos a listagem do começo.');
      expect(p.texto()).not.toContain('Não foi possível conectar');
    });

    it('a falha sem resposta da API diz que não conectou e deixa tentar de novo', async () => {
      p = await montarPagina([]);
      p.store.recarregar();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA && r.method === 'GET')
        .error(new ProgressEvent('error'));
      await p.propagar();

      expect(p.texto()).toContain('Não foi possível conectar ao servidor');
      await p.acionar(p.botaoPeloTexto('Tentar novamente') as HTMLButtonElement);
      p.http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush([trabalha]);
      await p.propagar();
      expect(p.texto()).not.toContain('Não foi possível conectar ao servidor');
    });
  });

  it('a falha ao ler os itens que aguardam a proteção de dados é avisada, com nova tentativa', async () => {
    p = await montarPagina([trabalha]);
    p.store.recarregar();
    await p.propagar();
    p.http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush([trabalha]);
    p.http
      .expectOne((r) => r.url === PROTECAO)
      .flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
    await p.propagar();

    expect(p.texto()).toContain('itens que aguardam a proteção de dados');
    const recarregar = p.botaoPeloTexto(
      'Recarregar itens que aguardam a proteção de dados',
    ) as HTMLButtonElement;
    recarregar.focus();
    await p.acionar(recarregar);
    expect(recarregar.isConnected).toBe(true);
    expect(recarregar.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(recarregar);
    p.atenderPendencias();
    await p.propagar();
    await p.propagar();
    expect(p.fixture.nativeElement.querySelector('ui-lookup-alert ui-alert')).toBeNull();
    expect(document.activeElement).toBe(p.elemento('#cfg-fatos-list-title'));
  });

  it('mostra e anuncia cada nova tentativa de ler os itens que aguardam a proteção', async () => {
    p = await montarPagina([trabalha]);
    p.store.recarregar();
    await p.propagar();
    p.http.expectOne((r) => r.url === LISTA && r.method === 'GET').flush([trabalha]);
    const falhar = async (): Promise<void> => {
      p.http
        .expectOne((r) => r.url === PROTECAO)
        .flush(...problema(500, { code: 'uniplus.internal.unexpected' }));
      await p.propagar();
    };
    const anuncio = (): string => situacaoDaNovaTentativa(p.fixture.nativeElement);
    await falhar();

    await p.acionar(
      p.botaoPeloTexto('Recarregar itens que aguardam a proteção de dados') as HTMLButtonElement,
    );
    expect(anuncio()).toBe(textoTentandoDe('itens que aguardam a proteção de dados'));
    await falhar();
    expect(anuncio()).toBe(textoRepetidaDe('itens que aguardam a proteção de dados'));
  });

  it('o catálogo de apoio não é pedido com a lista aberta e nenhum detalhe nem edição', async () => {
    p = await montarPagina([trabalha]);

    p.http.expectNone((r) => r.url === CATALOGO);
  });
});
