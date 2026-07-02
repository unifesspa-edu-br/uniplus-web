import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, CursoDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CursosPage } from './cursos.page';

const BASE = 'http://localhost:5000';

const cursoSeed: CursoDto = {
  id: '01960000-0000-7000-0000-0000000000c1',
  codigo: 'ENG-CIV',
  nome: 'Engenharia Civil',
  grau: 'Bacharelado',
  nivelEnsino: 'Graduação',
  grupoAreaEnem: 'Tecnológica',
  criadoEm: '2026-06-10T12:00:00Z',
};

describe('CursosPage', () => {
  let fixture: ComponentFixture<CursosPage>;
  let component: CursosPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
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
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  async function flushLista(itens: readonly CursoDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/cursos`);
    expect(req.request.params.get('limit')).toBe('50');
    req.flush(itens);
    await propagate();
  }

  it('renderiza a lista de cursos', async () => {
    await flushLista([cursoSeed]);
    expect(component['cursos']()).toHaveLength(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Engenharia Civil');
    expect(fixture.nativeElement.textContent).toContain('ENG-CIV');
  });

  it('CA-02: cria curso com código único, nome, grau e nível válidos', async () => {
    await flushLista([]);

    component['abrirCadastro']();
    component['form'].setValue({
      codigo: 'ADM',
      nome: 'Administração',
      grau: 'Bacharelado',
      nivelEnsino: 'Graduação',
      grupoAreaEnem: '',
    });
    const key = component['idempotencyKeyAtual']();

    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/cursos`);
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.get('Idempotency-Key')).toBe(key);
    expect(post.request.body).toMatchObject({
      codigo: 'ADM',
      nome: 'Administração',
      grau: 'Bacharelado',
      nivelEnsino: 'Graduação',
      grupoAreaEnem: null,
    });
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();

    await flushLista([cursoSeed]);
    expect(component['formOpen']()).toBe(false);
  });

  it('CA-02: cria curso sem grupo de área do ENEM (campo opcional)', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].setValue({
      codigo: 'HIST',
      nome: 'História',
      grau: 'Licenciatura',
      nivelEnsino: 'Graduação',
      grupoAreaEnem: '',
    });
    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/cursos`);
    expect(post.request.body.grupoAreaEnem).toBeNull();
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([]);
  });

  it('bloqueia salvar com campos obrigatórios vazios', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    fixture.detectChanges();

    const submit = fixture.nativeElement.querySelector(
      'button[form="cfg-curso-form"]',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);

    component['salvar']();

    controller.expectNone(`${BASE}/api/configuracao/admin/cursos`);
  });

  it('CA-03: código duplicado (409) é mapeado ao campo Código sem fechar o drawer', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].setValue({
      codigo: 'ENG-CIV',
      nome: 'Engenharia Civil (duplicado)',
      grau: 'Bacharelado',
      nivelEnsino: 'Graduação',
      grupoAreaEnem: '',
    });
    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/cursos`);
    post.flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.configuracao.curso.codigo_ja_existe',
        title: 'Já existe um curso ativo com este código',
        status: 409,
        code: 'uniplus.configuracao.curso.codigo_ja_existe',
        traceId: 'test-trace',
      }),
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(component['formOpen']()).toBe(true);
    expect(component['form'].controls.codigo.errors?.['backend']).toBeTruthy();
  });

  it('CA-08: remoção bloqueada por oferta viva (409) mantém o modal aberto com toast de erro', async () => {
    await flushLista([cursoSeed]);
    component['pedirRemocao'](cursoSeed);
    component['removerConfirmado']();

    const req = controller.expectOne(`${BASE}/api/configuracao/admin/cursos/${cursoSeed.id}`);
    req.flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.configuracao.curso.remocao_bloqueada_por_oferta_curso',
        title: 'Não é possível remover um curso referenciado por uma oferta de curso ativa',
        status: 409,
        code: 'uniplus.configuracao.curso.remocao_bloqueada_por_oferta_curso',
        traceId: 'test-trace',
      }),
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(component['confirmOpen']()).toBe(true);
  });

  it('remove um curso sem oferta viva após confirmação', async () => {
    await flushLista([cursoSeed]);
    component['pedirRemocao'](cursoSeed);
    component['removerConfirmado']();

    const req = controller.expectOne(`${BASE}/api/configuracao/admin/cursos/${cursoSeed.id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([]);
    expect(component['confirmOpen']()).toBe(false);
  });

  it('filtra a lista client-side por código ou nome', async () => {
    const outroCurso: CursoDto = { ...cursoSeed, id: 'outro-id', codigo: 'ADM', nome: 'Administração' };
    await flushLista([cursoSeed, outroCurso]);

    component['termoBusca'].set('ADM');
    fixture.detectChanges();

    expect(component['cursosFiltrados']()).toHaveLength(1);
    expect(component['cursosFiltrados']()[0].codigo).toBe('ADM');
  });
});
