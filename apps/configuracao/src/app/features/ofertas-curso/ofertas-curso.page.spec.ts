import { buildVendorMimeAccept } from '@uniplus/shared-core/http';
import { CursoDto, LocalOfertaDto } from '@uniplus/shared-data/configuracao';
import { UnidadeDto } from '@uniplus/shared-data/organizacao';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CURSOS,
  engCiv,
  ERRO_INTERNO,
  ige,
  LIMITE_MAXIMO_API,
  LISTA,
  LOCAIS,
  maraba,
  montarPagina,
  oferta,
  Pagina,
  SEM_PERMISSAO,
  TITULO_DA_LISTA,
  UNIDADES,
  problema,
} from './ofertas-curso.testing';

describe('OfertasCursoPage — catálogos de vínculo', () => {
  let p: Pagina;
  afterEach(() => p.encerrar());

  it('pede o teto de uma página da API nos catálogos de curso, local e unidade, com o tipo de mídia de cada um', async () => {
    p = await montarPagina([]);
    const unidades = await abrirEPegarUnidades();
    expect(p.http.match(() => false)).toEqual([]);
    for (const requisicao of [p.vinculos.cursos, p.vinculos.locais]) {
      expect(requisicao.pendente()).toBe(false);
    }
    expect(unidades.request.params.get('limit')).toBe(String(LIMITE_MAXIMO_API));
    expect(unidades.request.headers.get('Accept')).toContain('unidade');
    unidades.flush([ige]);
  });

  async function abrirEPegarUnidades() {
    p.novo().click();
    await p.propagar();
    return p.doCatalogo(UNIDADES);
  }

  it('pede à API as ofertas no tipo de mídia próprio, com o limite padrão e o total', async () => {
    p = await montarPagina([]);
    p.store.recarregar();
    await p.propagar();
    const pedido = p.http.expectOne((r) => r.url === LISTA);
    expect(pedido.request.headers.get('Accept')).toBe(buildVendorMimeAccept('oferta-curso', 1));
    expect(pedido.request.params.get('limit')).toBe(String(p.store.limite()));
    expect(pedido.request.params.get('include_total')).toBe('true');
    pedido.flush([]);
    await p.propagar();
  });

  it('cancela a busca de cursos anterior ao pedir de novo antes de a resposta chegar', async () => {
    p = await montarPagina();
    p.vinculos.cursos.recarregar();
    const primeira = p.doCatalogo(CURSOS);
    p.vinculos.cursos.recarregar();
    await p.propagar();

    expect(primeira.cancelled).toBe(true);
    p.doCatalogo(CURSOS).flush([engCiv]);
    await p.propagar();
    expect(p.vinculos.cursos.opcoes().map((curso) => curso.id)).toEqual([engCiv.id]);
  });

  it('percorre todas as páginas dos catálogos de curso, local e unidade sem truncar', async () => {
    p = await montarPagina([]);
    const proxima = (url: string) => ({
      headers: { Link: `<${url}?cursor=pagina-2&direction=next>; rel="next"` },
    });
    p.vinculos.cursos.recarregar();
    p.vinculos.locais.recarregar();
    p.novo().click();
    await p.propagar();
    const outraUnidade = { ...ige, id: 'u2', sigla: 'ICH' } as UnidadeDto;
    const outroCurso: CursoDto = { ...engCiv, id: 'c9', codigo: 'DIR', nome: 'Direito' };
    const outroLocal: LocalOfertaDto = {
      ...maraba,
      id: 'e9',
      cidade: { ...maraba.cidade, nome: 'Xinguara' },
    };

    p.doCatalogo(CURSOS).flush([engCiv], proxima(CURSOS));
    p.doCatalogo(LOCAIS).flush([maraba], proxima(LOCAIS));
    p.doCatalogo(UNIDADES).flush([ige], proxima(UNIDADES));
    await p.propagar();
    for (const [url, itens] of [
      [CURSOS, [outroCurso]],
      [LOCAIS, [outroLocal]],
      [UNIDADES, [outraUnidade]],
    ] as const) {
      const segunda = p.http.expectOne((r) => r.url === url);
      expect(segunda.request.params.get('cursor')).toBe('pagina-2');
      segunda.flush(itens);
    }
    await p.propagar();

    expect(p.vinculos.cursos.opcoes().map((curso) => curso.codigo)).toEqual(['ENG-CIV', 'DIR']);
    expect(p.vinculos.locais.opcoes()).toHaveLength(2);
    expect(p.vinculos.unidades.opcoes().map((unidade) => unidade.sigla)).toEqual(['IGE', 'ICH']);
  });

  it('lê as unidades uma só vez, na primeira abertura do cadastro', async () => {
    p = await montarPagina([]);
    p.novo().click();
    await p.responderUnidades();
    p.edicao.fechar();
    await p.propagar();
    p.novo().click();
    await p.propagar();
    p.http.expectNone((r) => r.url === UNIDADES);
    expect(p.vinculos.unidades.opcoes()).toHaveLength(1);
  });

  describe('falha de leitura', () => {
    it('o catálogo de cursos recusado sinaliza só a coluna Curso e oferece recarregar só esse catálogo', async () => {
      p = await montarPagina([oferta], { cursos: 'falha' });
      const celula = p.elemento('td[data-label="Curso"]');
      expect(celula.querySelector('.lookup-label--failed')?.textContent?.trim()).toBe(
        'Não carregado',
      );
      expect(p.elemento('td[data-label="Local de oferta"]').textContent).toContain('Marabá');
      expect(p.elemento('td[data-label="Grau"]').textContent?.trim()).toBe('—');
      expect(
        p.editar('Não carregado · IGE · Campus sede — Marabá · Regular · Matutino'),
      ).toBeTruthy();
      expect(p.erros).toHaveBeenCalledTimes(1);

      const alerta = p.elemento('.alert--warning');
      expect(alerta.textContent).toContain('Recarregar cursos');
      expect(alerta.textContent).not.toContain('Recarregar locais de oferta');
      p.elemento<HTMLButtonElement>('.alert--warning button').click();
      await p.propagar();
      p.doCatalogo(CURSOS).flush([engCiv]);
      await p.propagar();

      expect(p.fixture.nativeElement.querySelector('.alert--warning')).toBeNull();
      expect(celula.textContent).toContain('Engenharia Civil');
      expect(p.editar()).toBeTruthy();
    });

    it('o catálogo de locais recusado sinaliza a própria coluna e o nome acessível das ações', async () => {
      p = await montarPagina([oferta], { locais: 'falha' });
      const celula = p.elemento('td[data-label="Local de oferta"]');
      expect(celula.querySelector('.lookup-label--failed')?.textContent?.trim()).toBe(
        'Não carregado',
      );
      expect(p.elemento('td[data-label="Curso"]').textContent).toContain('Engenharia Civil');
      const nome = 'Engenharia Civil · IGE · Não carregado · Regular · Matutino';
      expect(p.editar(nome)).toBeTruthy();
      expect(p.remover(nome)).toBeTruthy();
      expect(p.elemento('.alert--warning').textContent).toContain('Recarregar locais de oferta');
    });

    it('a nova tentativa mantém o aviso e o foco no botão até terminar, e leva o foco ao título quando dá certo', async () => {
      p = await montarPagina([oferta], { cursos: 'falha' });
      const recarregar = p.elemento<HTMLButtonElement>('.alert--warning button');
      recarregar.focus();
      recarregar.click();
      await p.propagar();

      expect(p.elemento('.alert--warning button')).toBe(recarregar);
      expect(recarregar.getAttribute('aria-disabled')).toBe('true');
      expect(recarregar.getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(recarregar);
      recarregar.click();
      p.doCatalogo(CURSOS).flush([engCiv]);
      await p.propagar();
      await p.propagar();

      expect(p.fixture.nativeElement.querySelector('.alert--warning')).toBeNull();
      expect(document.activeElement).toBe(p.elemento(TITULO_DA_LISTA));
    });

    it('a nova tentativa que falha de novo mantém o aviso e o foco', async () => {
      p = await montarPagina([oferta], { locais: 'falha' });
      const recarregar = p.elemento<HTMLButtonElement>('.alert--warning button');
      recarregar.focus();
      recarregar.click();
      await p.propagar();
      p.doCatalogo(LOCAIS).flush(...problema(503, { code: ERRO_INTERNO }));
      await p.propagar();

      expect(p.elemento('.alert--warning button')).toBe(recarregar);
      expect(recarregar.getAttribute('aria-disabled')).toBeNull();
      expect(document.activeElement).toBe(recarregar);
      expect(p.erros).toHaveBeenCalledTimes(2);
    });

    it('a nova tentativa pedida no campo do formulário mostra a mesma fase na listagem e sai das duas vistas quando dá certo', async () => {
      p = await montarPagina([oferta], { cursos: 'falha' });
      p.novo().click();
      await p.propagar();
      await p.responderUnidades();
      const avisoDaListagem = (): Element | null =>
        p.fixture.nativeElement.querySelector('.alert--warning');
      const avisoDoCampo = (): HTMLElement => p.elemento('.field__error [role="alert"]');
      const botaoDoCampo = p.elemento<HTMLButtonElement>('.field__error button');
      expect(avisoDoCampo().textContent).toBe('Não foi possível carregar os cursos.');
      expect(avisoDaListagem()?.textContent).toContain('Recarregar cursos');

      botaoDoCampo.click();
      await p.propagar();

      const situacoes = [
        ...p.fixture.nativeElement.querySelectorAll('[role="status"].list-state__status'),
      ].map((no) => (no as HTMLElement).textContent);
      expect(situacoes).toEqual(['Recarregando cursos…', 'Recarregando cursos…']);
      expect(avisoDoCampo().textContent).toBe('Não foi possível carregar os cursos.');
      p.doCatalogo(CURSOS).flush([engCiv]);
      await p.propagar();
      await p.propagar();

      expect(avisoDaListagem()).toBeNull();
      expect(p.fixture.nativeElement.querySelector('.field__error [role="alert"]')).toBeNull();
    });

    it('recusa 4xx de um catálogo sinaliza a coluna sem avisar por toast', async () => {
      p = await montarPagina([oferta], { cursos: [] });
      p.vinculos.cursos.recarregar();
      p.doCatalogo(CURSOS).flush(...problema(403, { code: SEM_PERMISSAO }));
      await p.propagar();

      expect(p.elemento('.lookup-label--failed')).toBeTruthy();
      expect(p.erros).not.toHaveBeenCalled();
    });
  });
});
