import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CursoDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cursoSeed, GRUPOS, GRUPOS_URL, montarCursosPage } from './cursos.listagem.testing';
import { CursosPage } from './cursos.page';
import { EdicaoDosCursos } from './edicao-dos-cursos';
import { GruposDoCurso } from './grupos-do-curso';

describe('CursosPage — vocabulário de grupos', () => {
  let fixture!: ComponentFixture<CursosPage>;
  let edicao!: EdicaoDosCursos;
  let controller!: HttpTestingController;
  let propagate!: () => Promise<void>;
  let responderGrupos!: () => void;
  let flushLista!: (itens: readonly CursoDto[]) => Promise<void>;
  let encerrar!: () => void;

  beforeEach(() => {
    ({ fixture, edicao, controller, propagate, responderGrupos, flushLista, encerrar } =
      montarCursosPage());
  });

  afterEach(() => {
    encerrar();
  });

  it('a lista de grupos é pedida uma vez, ao abrir a página, e abrir o formulário não a pede de novo', async () => {
    await flushLista([cursoSeed]);
    responderGrupos();

    edicao.abrirCadastro();
    controller.expectNone(GRUPOS_URL);
  });

  it('numa visita nova, a tabela passa ao rótulo oficial quando o vocabulário chega, sem abrir o formulário', async () => {
    await flushLista([
      { ...cursoSeed, grupoAreaEnem: { codigo: 'TECNOLOGICA', rotulo: 'Rótulo do registro' } },
    ]);
    fixture.detectChanges();
    const celula = (): string | undefined =>
      (fixture.nativeElement as HTMLElement)
        .querySelector('td[data-label="Grupo ENEM"]')
        ?.textContent?.trim();
    expect(celula()).toBe('Rótulo do registro');

    responderGrupos();
    fixture.detectChanges();
    expect(celula()).toBe('Tecnológica');
  });

  it('falha da carga de fundo do vocabulário não mostra alerta na listagem', async () => {
    await flushLista([cursoSeed]);
    controller
      .expectOne(GRUPOS_URL)
      .flush(
        { title: 'Indisponível', status: 503 },
        { status: 503, statusText: 'Service Unavailable' },
      );
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('#cfg-curso-grupos-tentar'),
    ).toBeNull();
  });

  describe('bordas do vocabulário de grupos', () => {
    const falha503 = (): void => {
      controller.expectOne(GRUPOS_URL).flush(
        JSON.stringify({
          title: 'Serviço indisponível',
          status: 503,
          code: 'uniplus.internal.unexpected',
          traceId: 'trace-fundo',
        }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
    };

    const opcoes = (): string[] =>
      Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLOptionElement>(
          '#cfg-curso-grupo-area-enem option',
        ),
        (opcao) => opcao.value,
      );

    it('falha da carga de fundo com o formulário fechado não gera aviso', async () => {
      const erroSpy = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
      falha503();
      await flushLista([cursoSeed]);
      fixture.detectChanges();

      expect(erroSpy).not.toHaveBeenCalled();
    });

    it('com o formulário aberto, a nova falha dos grupos é apresentada uma única vez', async () => {
      const erroSpy = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
      falha503();
      await flushLista([cursoSeed]);
      expect(erroSpy).not.toHaveBeenCalled();

      edicao.abrirCadastro();
      fixture.detectChanges();
      await propagate();
      expect(erroSpy).not.toHaveBeenCalled();

      falha503();
      fixture.detectChanges();
      await propagate();

      expect(erroSpy).toHaveBeenCalledTimes(1);
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('#cfg-curso-grupos-falha'),
      ).not.toBeNull();
    });

    it('com o formulário aberto, a lista que chega depois da falha de fundo não gera aviso', async () => {
      const erroSpy = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
      falha503();
      await flushLista([cursoSeed]);

      edicao.abrirCadastro();
      fixture.detectChanges();
      await propagate();
      controller.expectOne(GRUPOS_URL).flush([...GRUPOS]);
      fixture.detectChanges();
      await propagate();

      expect(erroSpy).not.toHaveBeenCalled();
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('#cfg-curso-grupos-falha'),
      ).toBeNull();
    });

    it('grupo do curso sem código e sem rótulo não gera opção vazia', async () => {
      const semGrupo = { ...cursoSeed, grupoAreaEnem: { codigo: ' ', rotulo: ' ' } };
      await flushLista([semGrupo]);
      edicao.abrirEdicao(semGrupo);
      controller.expectOne(GRUPOS_URL).flush([...GRUPOS]);
      fixture.detectChanges();

      expect(
        fixture.debugElement.injector.get(GruposDoCurso).formulario().foraDasOpcoes,
      ).toBeNull();
      expect(opcoes()).toEqual(['', ...GRUPOS.map((g) => g.codigo)]);
    });

    it('código com espaços é aparado: a opção, a seleção e o payload usam o código aparado', async () => {
      const comEspacos = {
        ...cursoSeed,
        grupoAreaEnem: { codigo: ' TECNOLOGICA ', rotulo: 'Tecnológica' },
      };
      await flushLista([comEspacos]);
      edicao.abrirEdicao(comEspacos);
      controller
        .expectOne(GRUPOS_URL)
        .flush([{ codigo: ' TECNOLOGICA ', rotulo: 'Tecnológica' }, ...GRUPOS.slice(1)]);
      fixture.detectChanges();

      expect(opcoes()).toEqual(['', ...GRUPOS.map((g) => g.codigo)]);
      expect(
        fixture.debugElement.injector.get(GruposDoCurso).formulario().foraDasOpcoes,
      ).toBeNull();
      expect(edicao.form.controls.grupoAreaEnem.value).toBe('TECNOLOGICA');

      edicao.salvar();
      const put = controller.expectOne((r) => r.method === 'PUT');
      expect(put.request.body.grupoAreaEnem).toBe('TECNOLOGICA');
      put.flush(null, { status: 204, statusText: 'No Content' });
      await propagate();
      await flushLista([]);
    });
  });
});
