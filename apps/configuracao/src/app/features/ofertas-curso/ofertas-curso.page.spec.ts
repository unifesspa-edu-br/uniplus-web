import { TestBed } from '@angular/core/testing';
import { buildVendorMimeAccept } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CursoDto, LocalOfertaDto, OfertaCursoDto } from '@uniplus/shared-data/configuracao';
import { UnidadeDto } from '@uniplus/shared-data/organizacao';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CURSOS,
  ERRO_INTERNO,
  LIMITE_MAXIMO_API,
  LISTA,
  LOCAIS,
  Pagina,
  SEM_PERMISSAO,
  TITULO_DA_LISTA,
  UNIDADES,
  engCiv,
  engMinas,
  identificador,
  ige,
  maraba,
  montarPagina,
  oferta,
  problema,
} from './ofertas-curso.testing';

const mesmaOferta = (id: string, mudancas: Partial<OfertaCursoDto> = {}): OfertaCursoDto => ({
  ...oferta,
  id,
  ...mudancas,
});

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
      expect(document.activeElement).toBe(recarregar);
      expect(p.erros).toHaveBeenCalledTimes(2);
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

describe('OfertasCursoPage — listagem', () => {
  let p: Pagina;
  afterEach(() => p.encerrar());

  it('resolve o curso pelo nome, sem o código, e a unidade pela sigla, sem o nome', async () => {
    p = await montarPagina();
    const curso = p.elemento('td[data-label="Curso"]');
    expect(curso.textContent?.trim()).toBe('Engenharia Civil');
    expect(curso.textContent).not.toContain('ENG-CIV');
    const unidade = p.elemento('td[data-label="Unidade ofertante"]');
    expect(unidade.textContent?.trim()).toBe('IGE');
    expect(unidade.textContent).not.toContain('Instituto');
    expect(p.elemento('td[data-label="Local de oferta"]').textContent).toContain('Marabá');
  });

  it('mostra os regimes e o programa pelo rótulo, não pelo token do contrato', async () => {
    p = await montarPagina([mesmaOferta('x', { regimeDeFuncionamento: 'ALTERNANCIA_PEDAGOGICA' })]);
    const texto = p.fixture.nativeElement.textContent as string;
    expect(texto).toContain('Alternância Pedagógica');
    expect(texto).toContain('Regular');
    expect(texto).not.toContain('ALTERNANCIA_PEDAGOGICA');
    expect(texto).not.toContain('EXTENSIVO');
  });

  it('mostra a coluna Grau logo após Curso, com o grau de cada curso', async () => {
    const licenciatura: CursoDto = { ...engMinas, grau: 'Licenciatura' };
    p = await montarPagina([oferta, mesmaOferta('y', { cursoId: engMinas.id })], {
      cursos: [engCiv, licenciatura],
    });
    const cabecalhos = [...p.fixture.nativeElement.querySelectorAll('th')].map((th) =>
      (th as HTMLElement).textContent?.trim(),
    );
    expect(cabecalhos.slice(0, 2)).toEqual(['Curso', 'Grau']);
    const graus = [...p.fixture.nativeElement.querySelectorAll('td[data-label="Grau"]')].map((td) =>
      (td as HTMLElement).textContent?.trim(),
    );
    expect(graus).toEqual(['Bacharelado', 'Licenciatura']);
  });

  it('mostra "—" no Grau quando o curso não está no catálogo', async () => {
    p = await montarPagina([mesmaOferta('z', { cursoId: 'desconhecido' })]);
    expect(p.elemento('td[data-label="Grau"]').textContent?.trim()).toBe('—');
  });

  it('descreve a tabela por uma legenda acessível', async () => {
    p = await montarPagina();
    const legenda = p.elemento('table > caption');
    expect(legenda.classList.contains('sr-only')).toBe(true);
    expect(legenda.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Ofertas de curso, com local de oferta, unidade ofertante, regimes de funcionamento e turno, e vagas e-MEC',
    );
  });

  it('apresenta as linhas na ordem que a API devolve, sem pedir ordenação', async () => {
    const zoo: CursoDto = { ...engCiv, id: 'z', codigo: 'ZOO', nome: 'Zootecnia' };
    const adm: CursoDto = { ...engCiv, id: 'a', codigo: 'ADM', nome: 'Administração' };
    p = await montarPagina(
      [mesmaOferta('1', { cursoId: adm.id }), mesmaOferta('2', { cursoId: zoo.id })],
      {
        cursos: [zoo, adm],
      },
    );
    const nomes = [...p.fixture.nativeElement.querySelectorAll('td[data-label="Curso"]')].map(
      (td) => (td as HTMLElement).textContent?.trim(),
    );
    expect(nomes).toEqual(['Administração', 'Zootecnia']);
    p.store.recarregar();
    await p.propagar();
    const pedido = p.http.expectOne((r) => r.url === LISTA);
    expect(pedido.request.params.has('sort')).toBe(false);
    pedido.flush([]);
  });

  describe('nome acessível das ações', () => {
    it('identifica a oferta pelas colunas da linha, nunca pelo id técnico', async () => {
      p = await montarPagina();
      expect(p.editar(identificador)).toBeTruthy();
      expect(p.remover(identificador)).toBeTruthy();
      for (const botao of p.fixture.nativeElement.querySelectorAll(
        '[aria-label*="oferta de curso"]',
      )) {
        expect(botao.getAttribute('aria-label')).not.toContain(oferta.id);
      }
    });

    it('distingue ofertas de cursos diferentes no mesmo local e unidade', async () => {
      p = await montarPagina([oferta, mesmaOferta('b', { cursoId: engMinas.id })], {
        cursos: [engCiv, engMinas],
      });
      expect(p.editar(identificador)).toBeTruthy();
      expect(
        p.editar(identificador.replace('Engenharia Civil', 'Engenharia de Minas')),
      ).toBeTruthy();
    });

    it('distingue ofertas do mesmo curso em turnos ou programas diferentes', async () => {
      p = await montarPagina([
        oferta,
        mesmaOferta('b', { turnos: ['NOTURNO'] }),
        mesmaOferta('c', { programaDeOferta: 'PARFOR', baseLegal: 'Decreto 6.755/2009' }),
      ]);
      const nomes = [
        ...p.fixture.nativeElement.querySelectorAll('button[aria-label^="Editar oferta de curso"]'),
      ].map((botao) => botao.getAttribute('aria-label'));
      expect(nomes).toEqual([
        `Editar oferta de curso ${identificador}`,
        `Editar oferta de curso ${identificador.replace('Matutino', 'Noturno')}`,
        `Editar oferta de curso ${identificador.replace('Regular · Matutino', 'PARFOR · Matutino')}`,
      ]);
    });

    it('acrescenta o ordinal quando todas as colunas do nome coincidem', async () => {
      p = await montarPagina([oferta, mesmaOferta('b', { formatoPedagogico: 'EAD' })]);
      for (const ordem of ['1 de 2', '2 de 2']) {
        expect(p.editar(`${identificador} (${ordem})`)).toBeTruthy();
        expect(p.remover(`${identificador} (${ordem})`)).toBeTruthy();
      }
    });
  });

  describe('paginação e total', () => {
    const comTotal = (total: string, proxima = false) => ({
      headers: {
        'X-Total-Count': total,
        ...(proxima ? { Link: `<${LISTA}?cursor=p2&direction=next>; rel="next"` } : {}),
      },
    });
    const indicador = (): string | null =>
      p.fixture.nativeElement
        .querySelector('.panel-head__title .list-count')
        ?.textContent?.trim() ?? null;
    const recarregarPrimeira = async (total: string, proxima = false): Promise<void> => {
      p.store.recarregar();
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA).flush([oferta], comTotal(total, proxima));
      await p.propagar();
    };

    it('exibe o total informado pela API no formato da issue', async () => {
      p = await montarPagina();
      await recarregarPrimeira('120');
      expect(indicador()).toBe('Total de ofertas cadastradas: 120');
    });

    it('exibe zero quando a API informa que não há ofertas', async () => {
      p = await montarPagina();
      p.store.recarregar();
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA).flush([], comTotal('0'));
      await p.propagar();
      expect(indicador()).toBe('Total de ofertas cadastradas: 0');
    });

    it('a troca de página não pede nem altera o total', async () => {
      p = await montarPagina();
      await recarregarPrimeira('120', true);
      p.store.proximaPagina();
      await p.propagar();
      const segunda = p.http.expectOne((r) => r.url === LISTA);
      expect(segunda.request.params.get('cursor')).toBe('p2');
      expect(segunda.request.params.has('include_total')).toBe(false);
      segunda.flush([mesmaOferta('b')], {
        headers: { Link: `<${LISTA}?cursor=p1&direction=prev>; rel="prev"` },
      });
      await p.propagar();
      expect(indicador()).toBe('Total de ofertas cadastradas: 120');

      p.store.paginaAnterior();
      await p.propagar();
      const primeira = p.http.expectOne((r) => r.url === LISTA);
      expect(primeira.request.params.get('direction')).toBe('prev');
      primeira.flush([oferta], comTotal('120', true));
      await p.propagar();
      expect(indicador()).toBe('Total de ofertas cadastradas: 120');
    });

    it('sem X-Total-Count o indicador não afirma um total', async () => {
      p = await montarPagina();
      p.store.recarregar();
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA).flush([oferta]);
      await p.propagar();
      expect(indicador()).toBeNull();
    });

    it('a falha da consulta esconde o indicador em vez de exibir zero', async () => {
      p = await montarPagina();
      await recarregarPrimeira('5');
      p.store.recarregar();
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA).flush(...problema(503, { code: ERRO_INTERNO }));
      await p.propagar();
      expect(p.store.mensagemDeErro()).not.toBeNull();
      expect(indicador()).toBeNull();
    });

    it('trocar o limite volta à primeira página com o novo limit', async () => {
      p = await montarPagina();
      await recarregarPrimeira('120', true);
      p.store.proximaPagina();
      await p.propagar();
      p.http.expectOne((r) => r.url === LISTA).flush([oferta]);
      await p.propagar();

      p.store.aoTrocarLimite(50);
      await p.propagar();
      const pedido = p.http.expectOne((r) => r.url === LISTA);
      expect(pedido.request.params.get('limit')).toBe('50');
      expect(pedido.request.params.has('cursor')).toBe(false);
      pedido.flush([oferta]);
      await p.propagar();
      expect(p.store.limite()).toBe(50);
    });

    it('cursor recusado (400) na navegação recarrega do início e avisa que a consulta mudou', async () => {
      p = await montarPagina();
      const informar = vi.spyOn(TestBed.inject(NotificationService), 'info');
      await recarregarPrimeira('2', true);
      p.store.proximaPagina();
      await p.propagar();
      p.http
        .expectOne((r) => r.url === LISTA)
        .flush(...problema(400, { code: 'uniplus.cursor.invalido' }));
      await p.propagar();

      const recarga = p.http.expectOne((r) => r.url === LISTA);
      expect(recarga.request.params.has('cursor')).toBe(false);
      recarga.flush([oferta]);
      await p.propagar();
      expect(p.store.mensagemDeErro()).toBeNull();
      expect(informar).toHaveBeenCalledExactlyOnceWith(
        'A paginação foi reiniciada porque a consulta mudou.',
        'Recarregamos a listagem do começo.',
      );
    });
  });
});
