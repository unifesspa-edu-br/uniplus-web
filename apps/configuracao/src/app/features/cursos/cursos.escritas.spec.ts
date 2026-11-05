import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, CursoDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CursosPage } from './cursos.page';
import { CursosStore } from './cursos.store';
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
  let store: CursosStore;
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
    store = fixture.debugElement.injector.get(CursosStore);
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

  it('identifica os campos obrigatórios para tecnologias assistivas', async () => {
    await preencherNovoCurso();
    for (const campo of ['codigo', 'nome', 'grau', 'nivelEnsino']) {
      expect(elemento<HTMLElement>(`[formcontrolname="${campo}"]`).getAttribute('aria-required')).toBe(
        'true',
      );
    }
  });

  it('gravação pendente deixa o formulário somente leitura e impede fechar', async () => {
    await preencherNovoCurso();
    const salvar = elemento<HTMLButtonElement>('button[form="cfg-curso-form"]');
    salvar.focus();
    salvar.click();
    const post = controller.expectOne(ESCRITA_URL);
    await propagar();

    // Somente leitura: os valores ficam, os campos não aceitam edição e o foco segue no botão.
    expect(elemento<HTMLInputElement>('input[formcontrolname="codigo"]').matches(':disabled')).toBe(
      true,
    );
    expect(elemento<HTMLInputElement>('input[formcontrolname="codigo"]').value).toBe('DIR');
    expect(salvar.getAttribute('aria-disabled')).toBe('true');
    expect(salvar.getAttribute('aria-busy')).toBe('true');
    expect(salvar.textContent).toContain('Salvando...');
    expect(document.activeElement).toBe(salvar);
    // Cancelar, X e Esc ficam indisponíveis.
    expect(botao('.form-drawer__footer button', 'Cancelar').disabled).toBe(true);
    expect(
      drawerDoFormulario().querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')
        ?.disabled,
    ).toBe(true);
    drawerDoFormulario().dispatchEvent(new Event('cancel', { cancelable: true }));
    await propagar();
    expect(edicao.aberto()).toBe(true);

    post.flush('novo-id', { status: 201, statusText: 'Created' });
    await propagar();
    expect(edicao.aberto()).toBe(false);
    await responderLista([cursoSeed]);
  });

  it('remoção pendente mostra "Removendo", indisponibiliza os acionadores e não vira salvamento', async () => {
    await pedirRemocao();
    const remocao = controller.expectOne(`${ESCRITA_URL}/${cursoSeed.id}`);
    await propagar();

    expect(elemento('.panel-head').textContent).toContain('Removendo');
    expect(elemento('.sr-only[role="status"]').textContent?.trim()).toBe(
      'Removendo o curso ENG-CIV.',
    );
    expect(edicao.salvando()).toBe(false);
    expect(edicao.removendo()).toBe(true);
    expect(elemento<HTMLButtonElement>('.panel-head .btn--primary').disabled).toBe(true);
    expect(elemento<HTMLButtonElement>('button[aria-label="Editar curso ENG-CIV"]').disabled).toBe(
      true,
    );
    expect(elemento<HTMLButtonElement>('button[aria-label="Remover curso ENG-CIV"]').disabled).toBe(
      true,
    );

    remocao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    await responderLista([]);
    expect(elemento('.sr-only[role="status"]').textContent?.trim()).toBe('Curso ENG-CIV removido.');
    expect(elemento<HTMLButtonElement>('.panel-head .btn--primary').disabled).toBe(false);
  });

  it('com remoção pendente e a listagem falhando, o "Tentar novamente" da página fica indisponível', async () => {
    await pedirRemocao();
    const remocao = controller.expectOne(`${ESCRITA_URL}/${cursoSeed.id}`);
    store.recarregar();
    await propagar();
    controller
      .expectOne((r) => r.url === LISTA_URL)
      .flush(
        JSON.stringify({
          type: 'about:blank',
          title: 'Indisponível',
          status: 503,
          code: 'uniplus.indisponivel',
          traceId: 'test-trace',
        }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
    await propagar();

    expect(botao('ui-alert button', 'Tentar novamente').disabled).toBe(true);

    remocao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    await responderLista([]);
    await propagar();
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

  describe('campo desabilitado por regra de negócio', () => {
    it('continua desabilitado depois do sucesso, e os demais seguem habilitados no modelo', async () => {
      await preencherNovoCurso();
      edicao.form.controls.grau.disable();
      edicao.salvar();
      expect(edicao.form.controls.grau.disabled).toBe(true);
      expect(edicao.form.controls.nome.enabled).toBe(true);

      controller.expectOne(ESCRITA_URL).flush('id', { status: 201, statusText: 'Created' });
      await propagar();

      expect(edicao.form.controls.grau.disabled).toBe(true);
      expect(edicao.form.controls.nome.enabled).toBe(true);
      await responderLista([cursoSeed]);
    });

    it('continua desabilitado depois da recusa do servidor', async () => {
      await preencherNovoCurso();
      edicao.form.controls.grau.disable();
      edicao.salvar();

      recusar({
        type: 'about:blank',
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        traceId: 'test-trace',
        errors: [
          { field: 'Nome', code: 'uniplus.configuracao.curso.invalido', message: 'Recusado.' },
        ],
      });
      await propagar();

      expect(edicao.form.controls.grau.disabled).toBe(true);
      expect(edicao.form.controls.nome.errors?.['backend']).toBeDefined();
    });
  });

  describe('ativação enquanto o envio corre', () => {
    it('clique e envio do formulário não chamam salvar de novo', async () => {
      const salvarDaClasse = vi.spyOn(edicao, 'salvar');
      await preencherNovoCurso();
      enviarFormulario();
      const post = controller.expectOne(ESCRITA_URL);
      await propagar();

      enviarFormulario();
      elemento<HTMLFormElement>('#cfg-curso-form').dispatchEvent(
        new Event('submit', { cancelable: true }),
      );
      await propagar();

      expect(salvarDaClasse).toHaveBeenCalledTimes(1);
      post.flush('novo-id', { status: 201, statusText: 'Created' });
      await propagar();
      await responderLista([cursoSeed]);
    });
  });

  describe('foco', () => {
    it('após a recusa, vai do botão de salvar ao primeiro campo recusado', async () => {
      await preencherNovoCurso();
      const salvar = elemento<HTMLButtonElement>('button[form="cfg-curso-form"]');
      salvar.focus();
      salvar.click();
      await propagar();
      recusar({
        type: 'about:blank',
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        traceId: 'test-trace',
        errors: [
          {
            field: 'Nome',
            code: 'uniplus.configuracao.curso.invalido',
            message: 'Nome fora do padrão do catálogo.',
          },
        ],
      });
      await propagar();
      await propagar();

      expect(document.activeElement).toBe(elemento('input[formcontrolname="nome"]'));
    });

    it('após o sucesso, volta ao botão que abriu o drawer', async () => {
      const acionador = elemento<HTMLButtonElement>('.panel-head .btn--primary');
      acionador.focus();
      await preencherNovoCurso();
      elemento<HTMLButtonElement>('button[form="cfg-curso-form"]').focus();
      enviarFormulario();
      controller.expectOne(ESCRITA_URL).flush('novo-id', { status: 201, statusText: 'Created' });
      await propagar();
      await propagar();

      expect(edicao.aberto()).toBe(false);
      expect(document.activeElement).toBe(acionador);
      await responderLista([cursoSeed]);
    });
  });
});
