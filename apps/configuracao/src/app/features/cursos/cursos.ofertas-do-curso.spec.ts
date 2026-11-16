import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture } from '@angular/core/testing';
import { CursoDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cursoSeed, montarCursosPage, OFERTAS_URL, ofertaSeed } from './cursos.listagem.testing';
import { CursosPage } from './cursos.page';
import { OfertasDoCursoStore } from './ofertas-do-curso.store';

describe('CursosPage — ofertas do curso', () => {
  let fixture!: ComponentFixture<CursosPage>;
  let ofertasDoCurso!: OfertasDoCursoStore;
  let controller!: HttpTestingController;
  let propagate!: () => Promise<void>;
  let flushLista!: (itens: readonly CursoDto[]) => Promise<void>;
  let encerrar!: () => void;

  beforeEach(() => {
    ({ fixture, ofertasDoCurso, controller, propagate, flushLista, encerrar } = montarCursosPage());
  });

  afterEach(() => {
    encerrar();
  });

  it('CA1: abrir "Ofertas" lista as ofertas do curso filtrando por cursoId', async () => {
    await flushLista([cursoSeed]);

    ofertasDoCurso.abrir(cursoSeed);
    await propagate();

    const req = controller.expectOne((r) => r.url === OFERTAS_URL);
    expect(req.request.params.get('cursoId')).toBe(cursoSeed.id);
    expect(req.request.params.has('limit')).toBe(true);
    req.flush([ofertaSeed]);
    await propagate();

    expect(ofertasDoCurso.aberto()).toBe(true);
    expect(ofertasDoCurso.itens()).toHaveLength(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('IGE');
    expect(fixture.nativeElement.textContent).toContain('Regular');
  });

  it('CA1: drawer mostra empty-state quando o curso não tem ofertas vivas', async () => {
    await flushLista([cursoSeed]);

    ofertasDoCurso.abrir(cursoSeed);
    await propagate();
    controller.expectOne((r) => r.url === OFERTAS_URL).flush([]);
    await propagate();

    expect(ofertasDoCurso.itens()).toHaveLength(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhuma oferta ativa');
  });

  it('CA1: trocar de curso não vaza as ofertas do curso anterior enquanto o novo GET não resolve', async () => {
    const cursoB: CursoDto = {
      ...cursoSeed,
      id: '01960000-0000-7000-0000-0000000000c2',
      codigo: 'ADM',
      nome: 'Administração',
    };
    await flushLista([cursoSeed, cursoB]);

    ofertasDoCurso.abrir(cursoSeed);
    await propagate();
    controller.expectOne((r) => r.url === OFERTAS_URL).flush([ofertaSeed]);
    await propagate();
    expect(ofertasDoCurso.itens()).toHaveLength(1);

    // Fecha A e abre B: a lista precisa zerar de imediato (antes do GET de B),
    // senão o drawer mostraria a oferta de A sob o cabeçalho de B.
    ofertasDoCurso.aoFechar();
    ofertasDoCurso.abrir(cursoB);
    expect(ofertasDoCurso.itens()).toHaveLength(0);
    expect(ofertasDoCurso.proximo()).toBeNull();

    await propagate();
    const reqB = controller.expectOne((r) => r.url === OFERTAS_URL);
    expect(reqB.request.params.get('cursoId')).toBe(cursoB.id);
    reqB.flush([]);
    await propagate();
    expect(ofertasDoCurso.itens()).toHaveLength(0);
  });

  it('CA3: navegar para a próxima página reanexa cursoId e envia cursor/direction sem limit', async () => {
    await flushLista([cursoSeed]);

    ofertasDoCurso.abrir(cursoSeed);
    await propagate();

    const p1 = controller.expectOne((r) => r.url === OFERTAS_URL);
    p1.flush([ofertaSeed], {
      headers: { Link: `<${OFERTAS_URL}?cursor=pagina-2&direction=next>; rel="next"` },
    });
    await propagate();
    expect(ofertasDoCurso.proximo()).not.toBeNull();

    ofertasDoCurso.proximaPagina();
    await propagate();

    const p2 = controller.expectOne((r) => r.url === OFERTAS_URL);
    expect(p2.request.params.get('cursoId')).toBe(cursoSeed.id);
    expect(p2.request.params.get('cursor')).toBe('pagina-2');
    expect(p2.request.params.get('direction')).toBe('next');
    expect(p2.request.params.has('limit')).toBe(false);
    p2.flush([{ ...ofertaSeed, id: '01960000-0000-7000-0000-0000000000f2' }]);
    await propagate();
  });
});
