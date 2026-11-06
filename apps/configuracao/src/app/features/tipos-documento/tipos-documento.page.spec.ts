import { afterEach, describe, expect, it } from 'vitest';
import {
  CATEGORIAS,
  PROTECAO_URL,
  ESCRITA,
  LISTA,
  Pagina,
  diploma,
  laudo,
  montarPagina,
  orfao,
  problema,
  rg,
  sucesso,
} from './tipos-documento.testing';

describe('TiposDocumentoPage — leitura', () => {
  let p: Pagina;
  afterEach(() => p.encerrar());

  const textoDaPagina = (): string => p.fixture.nativeElement.textContent.replace(/\s+/gu, ' ');
  const chip = (rotulo: string): HTMLButtonElement => {
    const achado = [...p.fixture.nativeElement.querySelectorAll('ui-filter-chips button')].find(
      (b) => (b as HTMLElement).textContent?.includes(rotulo),
    );
    expect(achado, rotulo).toBeTruthy();
    return achado as HTMLButtonElement;
  };
  const digitarBusca = async (valor: string): Promise<void> => {
    const busca = p.elemento<HTMLInputElement>('input[type="search"]');
    busca.value = valor;
    busca.dispatchEvent(new Event('input'));
    await p.propagar();
  };
  const linhas = (): HTMLElement[] => [...p.fixture.nativeElement.querySelectorAll('tbody tr')];

  it('lê a lista com o vendor MIME do recurso e o limite da tela', async () => {
    p = await montarPagina([]);
    p.store.recarregar();
    await p.propagar();
    const req = p.http.expectOne((r) => r.url === LISTA);
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.headers.get('Accept')).toBe(
      'application/vnd.uniplus.tipo-documento.v1+json',
    );
    req.flush([]);
    await p.propagar();
  });

  it('renderiza a lista com colunas, equivalente e um chip por categoria mais "Todas"', async () => {
    p = await montarPagina([rg, laudo]);

    expect(textoDaPagina()).toContain('Registro Geral');
    expect(textoDaPagina()).toContain('Equiv.: CIN');
    expect(p.store.categoriaChips()).toHaveLength(CATEGORIAS.length + 1);
    const colunas = [...p.fixture.nativeElement.querySelectorAll('.panel thead th')].map((th) =>
      (th as HTMLElement).textContent?.trim(),
    );
    expect(colunas).toEqual([
      'Código',
      'Nome',
      'Categoria',
      'Formatos aceitos',
      'Sensibilidade',
      'Situação',
      'Ações',
    ]);
  });

  it('expõe legenda acessível descrevendo a tabela', async () => {
    p = await montarPagina([rg]);
    const caption = p.elemento('table > caption');
    expect(caption.classList.contains('sr-only')).toBe(true);
    expect(caption.textContent?.replace(/\s+/gu, ' ').trim()).toBe(
      'Tipos de documento, com categoria, formatos aceitos, sensibilidade e situação da aprovação. Use o nome para abrir o detalhe.',
    );
  });

  it('o chip de categoria filtra a lista e o contador acompanha o conjunto da busca', async () => {
    p = await montarPagina([rg, laudo]);
    chip('Saúde').click();
    await p.propagar();

    expect(linhas()).toHaveLength(1);
    expect(linhas()[0].textContent).toContain('LAUDO_MEDICO');
    expect(p.store.categoriaChips().find((c) => c.value === 'SAUDE')?.count).toBe(1);
    expect(p.store.filtrosAtivos()).toEqual([{ nome: 'Categoria', valor: 'Saúde' }]);
  });

  it('a busca filtra por código e por nome', async () => {
    p = await montarPagina([rg, laudo]);
    await digitarBusca('LAUDO');
    expect(linhas()).toHaveLength(1);
    expect(linhas()[0].textContent).toContain('Laudo médico — PcD');

    await digitarBusca('registro');
    expect(linhas()).toHaveLength(1);
    expect(linhas()[0].textContent).toContain('RG');
  });

  it('sem resultado para a busca, oferece "Limpar filtros", que a esvazia', async () => {
    p = await montarPagina([rg]);
    await digitarBusca('XYZNOTFOUND');
    expect(textoDaPagina()).toContain('Nenhum tipo de documento encontrado');
    const limpar = [...p.fixture.nativeElement.querySelectorAll('button')].find((b) =>
      (b as HTMLElement).textContent?.includes('Limpar filtros'),
    ) as HTMLButtonElement;
    limpar.click();
    await p.propagar();

    expect(p.store.termoBusca()).toBe('');
    expect(linhas()).toHaveLength(1);
  });

  it('sem registros nem filtro, convida ao primeiro cadastro', async () => {
    p = await montarPagina([]);
    expect(p.store.temFiltro()).toBe(false);
    expect(textoDaPagina()).toContain('Nenhum tipo de documento cadastrado');
  });

  it('a coluna Categoria mostra o nome do cadastro, não o token em caixa alta', async () => {
    p = await montarPagina([diploma]);
    expect(textoDaPagina()).toContain('Titulação e experiência');
    expect(textoDaPagina()).not.toContain('TITULACAO_EXPERIENCIA');
  });

  it('todo tipo carregado aparece em pelo menos um chip de categoria', async () => {
    p = await montarPagina([rg, laudo, diploma, orfao]);
    const especificos = p.store.categoriaChips().filter((c) => c.value !== '');
    for (const tipo of [rg, laudo, diploma, orfao]) {
      const cobre = especificos.filter((c) => {
        p.store.filtroCategoria.set(c.value);
        return p.store.tiposFiltrados().some((item) => item.id === tipo.id);
      });
      expect(cobre.length, `${tipo.codigo} ficou fora de todos os chips`).toBeGreaterThan(0);
    }
  });

  it('categoria fora do cadastro mantém a linha, sem token cru, e fica alcançável pelo chip próprio', async () => {
    p = await montarPagina([orfao]);

    expect(textoDaPagina()).toContain('Certidão militar');
    const celula = p.elemento('td[data-label="Categoria"]');
    expect(celula.textContent?.trim()).toBe('Não identificado');
    const fora = p.store.categoriaChips().find((c) => c.label === 'Fora do cadastro');
    expect(fora?.count).toBe(1);
    p.store.filtroCategoria.set(fora?.value ?? '');
    expect(p.store.tiposFiltrados()).toHaveLength(1);
  });

  it('enquanto o catálogo não chega, a coluna diz que carrega e nenhum registro é órfão', async () => {
    p = await montarPagina([diploma], { categorias: 'pendente' });

    expect(p.elemento('td[data-label="Categoria"]').textContent?.trim()).toBe('Carregando…');
    expect(p.store.categoriaChips().map((c) => c.label)).not.toContain('Fora do cadastro');
    p.atenderCategorias();
  });

  describe('falha dos catálogos que rotulam a lista', () => {
    const falhaDoServidor = (traceId: string) => problema(503, { traceId });

    it('o 5xx das categorias avisa por toast uma vez, com o traceId', async () => {
      p = await montarPagina([diploma], { categorias: 'falha' });

      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(p.erros.mock.calls[0]?.[0]).toMatchObject({ status: 503, traceId: 'trace-503' });
      expect(textoDaPagina()).toContain('Rótulos não carregados');
    });

    it('a recusa 403 das categorias aparece no alerta, sem toast', async () => {
      p = await montarPagina([diploma], { categorias: 'falha', statusDaFalha: 403 });

      expect(p.erros).not.toHaveBeenCalled();
      expect(textoDaPagina()).toContain('Rótulos não carregados');
    });

    it('o 5xx da situação da proteção avisa por toast uma vez, com o traceId', async () => {
      p = await montarPagina([rg]);
      p.store.aprovacao.carregar();
      for (const req of p.http.match((r) => r.url === PROTECAO_URL)) {
        req.flush(...falhaDoServidor('trace-situacao'));
      }
      await p.propagar();

      expect(p.erros).toHaveBeenCalledTimes(1);
      expect(p.erros.mock.calls[0]?.[0]).toMatchObject({ status: 503, traceId: 'trace-situacao' });
      expect(textoDaPagina()).toContain('Não foi possível ler a situação');
    });

    it('a recusa 403 da situação da proteção não avisa por toast', async () => {
      p = await montarPagina([rg]);
      p.store.aprovacao.carregar();
      for (const req of p.http.match((r) => r.url === PROTECAO_URL)) req.flush(...problema(403));
      await p.propagar();

      expect(p.erros).not.toHaveBeenCalled();
      expect(textoDaPagina()).toContain('Não foi possível ler a situação');
    });
  });

  it('a recusa do catálogo é comunicada fora do formulário, e a nova tentativa devolve o foco ao título', async () => {
    p = await montarPagina([diploma], { categorias: 'falha' });

    expect(textoDaPagina()).toContain('Rótulos não carregados');
    const recarregar = [...p.fixture.nativeElement.querySelectorAll('.lookup-alert__retry')].find(
      (b) => (b as HTMLElement).textContent?.includes('categorias'),
    ) as HTMLButtonElement;
    recarregar.focus();
    recarregar.click();
    await p.propagar();
    p.atenderCategorias();
    await p.propagar();

    expect(textoDaPagina()).not.toContain('Rótulos não carregados');
    expect(p.elemento('td[data-label="Categoria"]').textContent?.trim()).toBe(
      'Titulação e experiência',
    );
    expect(document.activeElement).toBe(p.elemento('#cfg-tipos-documento-list-title'));
  });

  it('limpa o chip selecionado quando a categoria sai do cadastro', async () => {
    p = await montarPagina([rg, laudo]);
    chip('Saúde').click();
    await p.propagar();
    expect(linhas()).toHaveLength(1);

    p.store.categorias.recarregar();
    p.atenderCategorias(CATEGORIAS.filter((c) => c.codigo !== 'SAUDE'));
    await p.propagar();

    expect(p.store.filtroCategoria()).toBe('');
    expect(linhas()).toHaveLength(2);
  });

  it('segue pelo cursor e volta à primeira página ao recarregar', async () => {
    p = await montarPagina([rg]);
    p.store.recarregar();
    await p.propagar();
    p.http
      .expectOne((r) => r.url === LISTA)
      .flush([rg], {
        headers: { Link: '</api/tipos-documento?cursor=abc&direction=next>; rel="next"' },
      });
    await p.propagar();

    p.store.proximaPagina();
    await p.propagar();
    const proxima = p.http.expectOne((r) => r.params.get('cursor') === 'abc');
    expect(proxima.request.params.get('direction')).toBe('next');
    proxima.flush([laudo]);
    await p.propagar();
    expect(p.store.tipos()).toEqual([laudo]);

    p.store.recarregar();
    await p.propagar();
    const primeira = p.http.expectOne((r) => r.url === LISTA);
    expect(primeira.request.params.has('cursor')).toBe(false);
    primeira.flush([rg]);
    await p.propagar();
    expect(p.store.tipos()).toEqual([rg]);
  });

  it('a falha 5xx da leitura avisa por toast; a 4xx só mostra o alerta', async () => {
    p = await montarPagina([rg]);
    p.store.recarregar();
    await p.propagar();
    p.http.expectOne((r) => r.url === LISTA).flush(...problema(503));
    await p.propagar();
    expect(p.erros).toHaveBeenCalledTimes(1);
    expect(textoDaPagina()).toContain('Não foi possível carregar os tipos de documento');

    p.store.tentarNovamente();
    await p.propagar();
    p.http.expectOne((r) => r.url === LISTA).flush(...problema(403));
    await p.propagar();
    expect(p.erros).toHaveBeenCalledTimes(1);
    expect(p.elemento('ui-alert .list-state__retry button')).toBeTruthy();
  });

  it('o alerta de falha oferece "Tentar novamente" e devolve o foco ao título ao concluir', async () => {
    p = await montarPagina([rg]);
    p.store.recarregar();
    await p.propagar();
    p.http.expectOne((r) => r.url === LISTA).flush(...problema(503));
    await p.propagar();

    const tentar = p.elemento<HTMLButtonElement>('ui-alert .list-state__retry button');
    tentar.focus();
    tentar.click();
    await p.propagar();
    expect(tentar.getAttribute('aria-disabled')).toBe('true');
    await p.recarregarCom([rg]);
    expect(document.activeElement).toBe(p.elemento('#cfg-tipos-documento-list-title'));
  });

  it('remover é um verbo de remoção: o botão e a confirmação não falam em inativar', async () => {
    p = await montarPagina([rg]);
    expect(p.remover(rg).getAttribute('data-tooltip')).toBe('Remover tipo de documento');
    p.remover(rg).click();
    await p.propagar();

    const dialogo = p.elemento('cfg-confirmacao-de-remocao').textContent ?? '';
    expect(dialogo).toContain('Remover tipo de documento');
    expect(dialogo).toContain('Deseja remover "Registro Geral" (RG)?');
    expect(dialogo).toContain('Editais já publicados que o referenciam não são afetados');
    expect(dialogo).toContain('parâmetros foram congelados na configuração do edital');
    expect(dialogo).not.toMatch(/inativ/iu);
  });

  it('a confirmação remove sem checagem prévia, relê a lista e a situação da proteção', async () => {
    p = await montarPagina([rg]);
    const del = await p.confirmarRemocao(rg);
    expect(del.request.method).toBe('DELETE');
    del.flush(...sucesso());
    await p.propagar();

    expect(p.http.match((r) => r.url.endsWith('/admin/protecao-do-catalogo'))).toHaveLength(1);
    p.http.expectOne((r) => r.url === LISTA).flush([]);
    await p.propagar();
    expect(p.edicao.confirmando()).toBe(false);
    p.http.expectNone(ESCRITA);
  });
});
