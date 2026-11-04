import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CONFIGURACAO_BASE_PATH, CursoDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  const botao = (seletor: string, texto: string): HTMLButtonElement => {
    const achado = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(seletor),
    ].find((b) => b.textContent?.trim() === texto);
    expect(achado, `${seletor} "${texto}"`).toBeDefined();
    return achado as HTMLButtonElement;
  };

  const drawerDoFormulario = (): HTMLDialogElement =>
    elemento<HTMLDialogElement>('dialog[aria-label="Formulário de curso"]');

  const gravacaoRecusada = (): [string, object] => [
    JSON.stringify({
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
    }),
    {
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { 'content-type': 'application/problem+json' },
    },
  ];

  it('gravação pendente deixa indisponível salvar, cancelar e fechar o formulário', async () => {
    await preencherNovoCurso();
    enviarFormulario();
    const post = controller.expectOne(ESCRITA_URL);
    await propagar();

    expect(elemento<HTMLButtonElement>('button[form="cfg-curso-form"]').disabled).toBe(true);
    expect(botao('.cfg-form-footer button', 'Cancelar').disabled).toBe(true);
    expect(
      drawerDoFormulario().querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')
        ?.disabled,
    ).toBe(true);
    // Esc: o <dialog> emite `cancel`; com a escrita em curso o drawer recusa fechar.
    drawerDoFormulario().dispatchEvent(new Event('cancel', { cancelable: true }));
    await propagar();
    expect(edicao.aberto()).toBe(true);

    post.flush('novo-id', { status: 201, statusText: 'Created' });
    await propagar();
    expect(edicao.aberto()).toBe(false);
    await responderLista([cursoSeed]);
  });

  it('remoção pendente deixa o botão de salvar desabilitado', async () => {
    await pedirRemocao();
    const remocao = controller.expectOne(`${ESCRITA_URL}/${cursoSeed.id}`);

    await preencherNovoCurso();
    const salvar = elemento<HTMLButtonElement>('button[form="cfg-curso-form"]');
    expect(salvar.disabled).toBe(true);
    salvar.click();

    controller.expectNone(ESCRITA_URL);
    remocao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    await responderLista([]);
  });

  describe('trava da classe de edição contra chamadas concorrentes', () => {
    it('uma segunda submissão não parte enquanto a primeira corre', async () => {
      await preencherNovoCurso();
      edicao.salvar();
      edicao.salvar();

      controller.expectOne(ESCRITA_URL).flush('id', { status: 201, statusText: 'Created' });
      await propagar();
      await responderLista([cursoSeed]);
    });

    it('a remoção não parte enquanto uma gravação corre', async () => {
      await preencherNovoCurso();
      edicao.salvar();
      edicao.pedirRemocao(cursoSeed);
      edicao.removerConfirmado();

      controller.expectNone(`${ESCRITA_URL}/${cursoSeed.id}`);
      controller.expectOne(ESCRITA_URL).flush('id', { status: 201, statusText: 'Created' });
      await propagar();
      await responderLista([cursoSeed]);
    });

    it('a submissão não parte enquanto uma remoção corre', async () => {
      edicao.pedirRemocao(cursoSeed);
      edicao.removerConfirmado();
      await preencherNovoCurso();
      edicao.salvar();

      controller.expectNone(ESCRITA_URL);
      controller
        .expectOne(`${ESCRITA_URL}/${cursoSeed.id}`)
        .flush(null, { status: 204, statusText: 'No Content' });
      await propagar();
      await responderLista([]);
    });
  });

  describe('resposta de uma abertura anterior do formulário', () => {
    it('sucesso não fecha nem altera o formulário aberto depois, mas atualiza a lista', async () => {
      const notificacoes = vi.spyOn(TestBed.inject(NotificationService), 'success');
      await preencherNovoCurso();
      edicao.salvar();
      const post = controller.expectOne(ESCRITA_URL);

      edicao.abrirEdicao(cursoSeed);
      post.flush('novo-id', { status: 201, statusText: 'Created' });
      await propagar();

      expect(notificacoes).toHaveBeenCalledWith('Curso criado');
      expect(edicao.aberto()).toBe(true);
      expect(edicao.modo()).toBe('editar');
      expect(edicao.form.controls.codigo.value).toBe('ENG-CIV');
      await responderLista([cursoSeed]);
    });

    it('recusa não marca campo do formulário aberto depois', async () => {
      await preencherNovoCurso();
      edicao.salvar();
      const post = controller.expectOne(ESCRITA_URL);

      edicao.abrirCadastro();
      post.flush(...gravacaoRecusada());
      await propagar();

      expect(edicao.form.controls.nome.errors?.['backend']).toBeUndefined();
      expect(edicao.erro()).toBeNull();
    });
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
