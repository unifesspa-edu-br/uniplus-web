import { TestBed } from '@angular/core/testing';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CursoDto } from '@uniplus/shared-data/configuracao';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  engCiv,
  engMinas,
  ERRO_INTERNO,
  identificador,
  LISTA,
  mesmaOferta,
  montarPagina,
  oferta,
  Pagina,
  problema,
} from './ofertas-curso.testing';

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
    expect(cabecalhos.slice(0, 3)).toEqual(['Código', 'Curso', 'Grau']);
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
      'Ofertas de curso, com código, local de oferta, unidade ofertante, regimes de funcionamento e turno, e vagas e-MEC',
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
