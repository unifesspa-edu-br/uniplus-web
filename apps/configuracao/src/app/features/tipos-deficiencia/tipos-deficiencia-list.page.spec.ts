import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApplicationRef } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import {
  CONFIGURACAO_BASE_PATH,
  RecursoAcessibilidadeDto,
  TipoDeficienciaDto,
} from '@uniplus/shared-data/configuracao';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { TiposDeficienciaListPage } from './tipos-deficiencia-list.page';

const BASE = 'http://localhost:5000';
const TIPO_DEFICIENCIA_ID = '019f41cf-69fd-759a-ac6d-09acabc1b027';
const tipoDeficienciaSeed: RecursoAcessibilidadeDto = {
  'id': TIPO_DEFICIENCIA_ID,
  nome: 'Visual',
  descricao: 'Inclui baixa visão e cegueira',
  criadoEm: '2026-07-07T13:23:42.707136+00:00',
};

describe('TiposDeficienciaListPage', () => {
  let fixture: ComponentFixture<TiposDeficienciaListPage>;
  let component: TiposDeficienciaListPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TiposDeficienciaListPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(TiposDeficienciaListPage);
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
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-deficiencia`);
    expect(req.request.params.get('limit')).toBe('50');
    req.flush(items);
    await propagate();
  }

  // Pós-mutação, `recarregar()` só dá reload no resource da lista principal —
  // os lookups de Tipos de Deficiência já estão em cache e não recarregam.
  async function flushRecarregarLista(items: readonly RecursoAcessibilidadeDto[]): Promise<void> {
    await propagate();
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-deficiencia`)
      .flush(items);
    await propagate();
  }

  function getSalvarOuEditarButtonEl() {
    return fixture.nativeElement.querySelector(
      'button[form="cfg-unidade-form"]',
    ) as HTMLButtonElement;
  }

  it('drawer mostra empty-state quando tipos de deficiência não tem ofertas vivas', async () => {
    await flushLista([]);

    await propagate();

    expect(component['tiposDeficiencia']()).toHaveLength(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhum tipo de deficiência carregado');
  });

  it('busca sem resultado mostra o empty-state de filtro, não o de lista vazia', async () => {
    await flushLista([tipoDeficienciaSeed]);

    component['termoBusca'].set('tipo-deficiencia-inexistente');
    fixture.detectChanges();

    expect(component['tiposDeficienciaFiltrados']()).toHaveLength(0);
    expect(fixture.nativeElement.textContent).toContain('Nenhum tipo de deficiência encontrado');
    expect(fixture.nativeElement.textContent).toContain('Ajuste a busca para ver resultados.');
    expect(fixture.nativeElement.textContent).not.toContain('Nenhum tipo de deficiência carregado');
  });

  it('renderiza a lista de tipos de deficiência', async () => {
    await flushLista([tipoDeficienciaSeed]);
    expect(component['tiposDeficiencia']()).toHaveLength(1);

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Visual');
    expect(fixture.nativeElement.textContent).toContain('Inclui baixa visão e cegueira');
  });

  it('cria tipo de deficiência com nome único, descrição válidos', async () => {
      await flushLista([]);

      component['abrirDrawerCriacao']();
      component['form'].setValue({
        nome: 'Visual',
        descricao: 'Inclui baixa visão e cegueira',
      });
      const key = component['idempotencyKeyAtual']();

      component['salvar']();

      const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-deficiencia`);
      expect(post.request.method).toBe('POST');
      expect(post.request.headers.get('Idempotency-Key')).toBe(key);
      expect(post.request.body).toMatchObject({
        nome: 'Visual',
        descricao: 'Inclui baixa visão e cegueira',
      });
      post.flush('new-id', { status: 201, statusText: 'Created' });
      await propagate();

      expect(component['formOpen']()).toBe(false);
      expect(component['modo']()).toBe('criar');
      await flushLista([tipoDeficienciaSeed]);
  });

  it('bloqueia botão de salvar quando os campos obrigatórios estão vazios', async () => {
    await flushLista([]);
    component['abrirDrawerCriacao']();
    fixture.detectChanges();

    const submit = getSalvarOuEditarButtonEl();
    component['salvar']();

    expect(submit.disabled).toBe(true);
    controller.expectNone(`${BASE}/api/configuracao/admin/tipos-deficiencia`);
    expect(component['modo']()).toBe('criar');
  });

  it('nome duplicado (409) é mapeado ao campo Nome sem fechar o drawer', async () => {
    await flushLista([]);

    component['abrirDrawerCriacao']();
    component['form'].setValue({
      nome: 'Visual',
      descricao: ''
    });
    component['salvar']();
    const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-deficiencia`);
      post.flush(
        JSON.stringify({
          type: 'https://uniplus.dev/erros/uniplus.configuracao.tipo_deficiencia.nome_ja_existe',
          title: 'Já existe um tipo de deficiência ativo com este nome',
          status: 409,
          code: 'uniplus.configuracao.tipo_deficiencia.nome_ja_existe',
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
    const outroTipoDeficiencia: TipoDeficienciaDto = {
      ...tipoDeficienciaSeed,
      id: '2',
      nome: 'Auditiva',
      descricao: 'inclui surdez e surdocegueira.'
    };
    await flushLista([tipoDeficienciaSeed, outroTipoDeficiencia,]);

    component['termoBusca'].set('Visual');
    fixture.detectChanges();

    expect(component['tiposDeficienciaFiltrados']()).toHaveLength(1);
    expect(component['tiposDeficienciaFiltrados']()[0].nome).toBe('Visual');
  });

  it('edita campos de nome', async () => {
      const NOVO_NOME = 'Visual e Auditiva';
      const tipo_deficiencia: TipoDeficienciaDto = {
        ...tipoDeficienciaSeed,
        nome: NOVO_NOME,
      };

      await flushLista([tipoDeficienciaSeed]);

      component['abrirEdicao'](tipoDeficienciaSeed);
      await propagate();

      component['form'].controls.nome.setValue(NOVO_NOME);
      component['salvar']();

      const put = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-deficiencia/${TIPO_DEFICIENCIA_ID}`);      expect(put.request.method).toBe('PUT');
      expect(put.request.body.nome).toBe(NOVO_NOME);
      put.flush(null, { status: 204, statusText: 'No Content' });
      await flushRecarregarLista([tipo_deficiencia]);
    });
});
