import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, CursoDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CursosPage } from './cursos.page';
import { EdicaoDosCursos } from './edicao-dos-cursos';

const BASE = 'http://localhost:5000';
const LISTA_URL = `${BASE}/api/configuracao/cursos`;
const ESCRITA_URL = `${BASE}/api/configuracao/admin/cursos`;
const GRUPOS_URL = `${BASE}/api/configuracao/vocabularios/grupos-area-enem`;

const cursoSeed: CursoDto = {
  id: '01960000-0000-7000-0000-0000000000c1',
  codigo: 'ENG-CIV',
  nome: 'Engenharia Civil',
  grau: 'Bacharelado',
  nivelEnsino: 'Graduação',
  grupoAreaEnem: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

/** Escritas de cursos atravessando os componentes da página: cliques e digitação, como o operador. */
describe('CursosPage — escritas pela interface', () => {
  let fixture: ComponentFixture<CursosPage>;
  let edicao: EdicaoDosCursos;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [CursosPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(CursosPage);
    edicao = fixture.debugElement.injector.get(EdicaoDosCursos);
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
    await responderLista([cursoSeed]);
  });

  afterEach(() => {
    controller.match(GRUPOS_URL).forEach((pedido) => pedido.flush([]));
    controller.verify();
  });

  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();
  };

  async function responderLista(itens: readonly CursoDto[]): Promise<void> {
    controller.expectOne((r) => r.url === LISTA_URL).flush(itens);
    await propagar();
  }

  const elemento = <T extends HTMLElement>(seletor: string): T => {
    const el = fixture.nativeElement.querySelector(seletor) as T | null;
    expect(el, seletor).not.toBeNull();
    return el as T;
  };

  const digitar = (seletor: string, valor: string): void => {
    const input = elemento<HTMLInputElement>(seletor);
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  };

  async function preencherNovoCurso(): Promise<void> {
    elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
    await propagar();
    digitar('input[formcontrolname="codigo"]', 'DIR');
    digitar('input[formcontrolname="nome"]', 'Direito');
    digitar('input[formcontrolname="grau"]', 'Bacharelado');
    digitar('input[formcontrolname="nivelEnsino"]', 'Graduação');
  }

  const enviarFormulario = (): void =>
    elemento<HTMLButtonElement>('button[form="cfg-curso-form"]').click();

  async function pedirRemocao(): Promise<void> {
    elemento<HTMLButtonElement>('button[aria-label="Remover curso ENG-CIV"]').click();
    await propagar();
    elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
    await propagar();
  }

  function recusar(corpo: object): void {
    controller.expectOne(ESCRITA_URL).flush(JSON.stringify(corpo), {
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { 'content-type': 'application/problem+json' },
    });
  }

  it('gravação pendente bloqueia nova submissão e a remoção', async () => {
    await preencherNovoCurso();
    enviarFormulario();
    const post = controller.expectOne(ESCRITA_URL);

    enviarFormulario();
    await pedirRemocao();

    controller.expectNone((r) => r.url.startsWith(ESCRITA_URL));
    expect(edicao.gravando()).toBe(true);
    post.flush('novo-id', { status: 201, statusText: 'Created' });
    await propagar();
    await responderLista([cursoSeed]);
  });

  it('remoção pendente bloqueia a submissão do formulário', async () => {
    await pedirRemocao();
    const remocao = controller.expectOne(`${ESCRITA_URL}/${cursoSeed.id}`);

    await preencherNovoCurso();
    enviarFormulario();

    controller.expectNone(ESCRITA_URL);
    remocao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    await responderLista([]);
  });

  it('recusa do servidor é mostrada no campo recusado', async () => {
    await preencherNovoCurso();
    enviarFormulario();
    recusar({
      type: 'about:blank',
      title: 'Dados inválidos',
      status: 422,
      code: 'uniplus.validacao',
      traceId: 'test-trace',
      errors: [
        {
          field: 'Nome',
          code: 'uniplus.configuracao.curso.nome_invalido',
          message: 'Nome fora do padrão do catálogo.',
        },
      ],
    });
    await propagar();

    const campo = elemento('input[formcontrolname="nome"]').closest('label') as HTMLElement;
    expect(campo.querySelector('.field__error')?.textContent?.trim()).toBe(
      'Nome fora do padrão do catálogo.',
    );
    expect(elemento('input[formcontrolname="nome"]').getAttribute('aria-invalid')).toBe('true');
  });
});
