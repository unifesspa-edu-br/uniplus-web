import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApplicationRef } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import {
  CONFIGURACAO_BASE_PATH,
  RecursoAcessibilidadeDto,
} from '@uniplus/shared-data/configuracao';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { RecursosAcessibilidadeListPage } from './recursos-acessibilidade-list.page.js';

const BASE = 'http://localhost:5000';
const RECURSO_ACESSIBILIDADE_ID = '019f41cf-69fd-759a-ac6d-09acabc1b027';
const recurso_acessibilidade_seed: RecursoAcessibilidadeDto = {
  'id': RECURSO_ACESSIBILIDADE_ID,
  nome: 'Ledor',
  descricao: 'Leitura da prova em voz alta por fiscal designado.',
  criadoEm: '2026-07-07T13:23:42.707136+00:00',
};

describe('RecursosAcessibilidadeListPage', () => {
  let fixture: ComponentFixture<RecursosAcessibilidadeListPage>;
  let component: RecursosAcessibilidadeListPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RecursosAcessibilidadeListPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(RecursosAcessibilidadeListPage);
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

  async function flushLista(items: readonly RecursoAcessibilidadeDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/recursos-acessibilidade`);
    expect(req.request.params.get('limit')).toBe('50');
    req.flush(items);
    await propagate();
  }

  function getSalvarOuEditarButtonEl(): HTMLButtonElement {
    return fixture.nativeElement.querySelector(
      'button[form="cfg-unidade-form"]',
    ) as HTMLButtonElement;
  }

  function getInativarButtonEl(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('td[class="table-responsive__actions"] > button:last-child') as HTMLButtonElement;
  }

  function getEditarButtonEl(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('td[class="table-responsive__actions"] > button:first-child') as HTMLButtonElement;
  }

  // Pós-mutação, `recarregar()` só dá reload no resource da lista principal —
  // os lookups de Recursos de acessibilidade já estão em cache e não recarregam.
  async function flushRecarregarLista(items: readonly RecursoAcessibilidadeDto[]): Promise<void> {
    await propagate();
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/recursos-acessibilidade`)
      .flush(items);
    await propagate();
  }

  it('drawer mostra empty-state quando recursos não tem ofertas vivas', async () => {
    await flushLista([]);

    await propagate();

    expect(component['recursos']()).toHaveLength(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhum recurso de acessibilidade carregado');
  });

  it('busca sem resultado mostra o empty-state de filtro, não o de lista vazia', async () => {
    await flushLista([recurso_acessibilidade_seed]);

    component['termoBusca'].set('recurso-inexistente');
    fixture.detectChanges();

    expect(component['recursosFiltrados']()).toHaveLength(0);
    expect(fixture.nativeElement.textContent).toContain('Nenhum recurso de acessibilidade encontrado');
    expect(fixture.nativeElement.textContent).toContain('Ajuste a busca para ver resultados.');
    expect(fixture.nativeElement.textContent).not.toContain('Nenhum recurso de acessibilidade carregado');
  });

  it('simula cenário que a primeira requisição falha e tenta novamente com sucesso', async () => {
    const req = controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/recursos-acessibilidade`,
    );
    req.flush(null, { status: 500, statusText: 'Error' });
    await propagate();
    const tentarNovamenteButtonEl = fixture.nativeElement.querySelector(
      '.cfg-campi__retry > button',
    ) as HTMLButtonElement;
    expect(tentarNovamenteButtonEl).toBeTruthy();

    tentarNovamenteButtonEl.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    await flushRecarregarLista([recurso_acessibilidade_seed]);
    expect(component['recursos']()).toHaveLength(1);
  });

  it('renderiza a lista de recursos de acessibilidade', async () => {
    await flushLista([recurso_acessibilidade_seed]);
    expect(component['recursos']()).toHaveLength(1);

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ledor');
    expect(fixture.nativeElement.textContent).toContain('Leitura da prova em voz alta por fiscal designado.');
  });

  it('cria recurso de acessibilidade com nome único, descrição válidos', async () => {
      await flushLista([]);

      component['abrirDrawerCriacao']();
      component['form'].setValue({
        nome: 'Ledor',
        descricao: 'Leitura da prova em voz alta por fiscal designado.',
      });
      const key = component['idempotencyKeyAtual']();

      component['salvar']();

      const post = controller.expectOne(`${BASE}/api/configuracao/admin/recursos-acessibilidade`);
      expect(post.request.method).toBe('POST');
      expect(post.request.headers.get('Idempotency-Key')).toBe(key);
      expect(post.request.body).toMatchObject({
        nome: 'Ledor',
        descricao: 'Leitura da prova em voz alta por fiscal designado.',
      });
      post.flush('new-id', { status: 201, statusText: 'Created' });
      await propagate();

      expect(component['formOpen']()).toBe(false);
      expect(component['modo']()).toBe('criar');
      await flushLista([recurso_acessibilidade_seed]);
  });

  it('bloqueia botão de salvar quando os campos obrigatórios estão vazios', async () => {
      await flushLista([]);
      component['abrirDrawerCriacao']();
      fixture.detectChanges();

      const submit = getSalvarOuEditarButtonEl();
      component['salvar']();

      expect(submit.disabled).toBe(true);
      controller.expectNone(`${BASE}/api/configuracao/admin/recursos-acessibilidade`);
      expect(component['modo']()).toBe('criar');
    });

  it('nome duplicado (409) é mapeado ao campo Nome sem fechar o drawer', async () => {
    await flushLista([]);

    component['abrirDrawerCriacao']();
    component['form'].setValue({
      nome: 'Ledor',
      descricao: ''
    });
    component['salvar']();
    const post = controller.expectOne(`${BASE}/api/configuracao/admin/recursos-acessibilidade`);
      post.flush(
        JSON.stringify({
          type: 'https://uniplus.dev/erros/uniplus.configuracao.recurso_acessibilidade.nome_ja_existe',
          title: 'Já existe um recurso de acessibilidade ativo com este nome',
          status: 409,
          code: 'uniplus.configuracao.recurso_acessibilidade.nome_ja_existe',
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
    expect(component['form'].controls.nome.errors?.['backend']).toBeTruthy();
  });

  it('filtra a lista client-side por nome', async () => {
    const outroRecursoAcessibilidade: RecursoAcessibilidadeDto = {
      ...recurso_acessibilidade_seed,
      id: '2',
      nome: 'Lupa eletrônica',
      descricao: 'amplificador de baixa visão.'
    };
    await flushLista([recurso_acessibilidade_seed, outroRecursoAcessibilidade,]);

    component['termoBusca'].set('Lupa eletrônica');
    fixture.detectChanges();

    expect(component['recursosFiltrados']()).toHaveLength(1);
    expect(component['recursosFiltrados']()[0].nome).toBe('Lupa eletrônica');
  });

  it('edita campos de nome', async () => {
    const NOVO_NOME = 'Ledor de Prova';
    const recurso_acessibilidade: RecursoAcessibilidadeDto = {
      ...recurso_acessibilidade_seed,
      nome: NOVO_NOME,
    };

    await flushLista([recurso_acessibilidade_seed]);

    component['abrirEdicao'](recurso_acessibilidade_seed);
    await propagate();

    component['form'].controls.nome.setValue(NOVO_NOME);
    component['salvar']();

    const put = controller.expectOne(`${BASE}/api/configuracao/admin/recursos-acessibilidade/${RECURSO_ACESSIBILIDADE_ID}`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body.nome).toBe(NOVO_NOME);
    put.flush(null, { status: 204, statusText: 'No Content' });
    await flushRecarregarLista([recurso_acessibilidade]);
  });

  it('desabilita o botão de inativação quando está carregando a lista', async () => {
    component['recursos'].set([recurso_acessibilidade_seed]);
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/recursos-acessibilidade`);
    req.flush([recurso_acessibilidade_seed]);
    expect(component['loading']()).toBe(true);
    fixture.detectChanges();
    const inativarButtonEl = getInativarButtonEl();
    expect(inativarButtonEl).toBeTruthy();
    expect(inativarButtonEl.disabled).toBe(true);
  });

  it('desabilita o botão de edição quando está carregando a lista', async () => {
    component['recursos'].set([recurso_acessibilidade_seed]);
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/recursos-acessibilidade`);
    req.flush([recurso_acessibilidade_seed]);
    expect(component['loading']()).toBe(true);
    fixture.detectChanges();
    const editarButtonEl = getEditarButtonEl();
    expect(editarButtonEl).toBeTruthy();
    expect(editarButtonEl.disabled).toBe(true);
  });
});
