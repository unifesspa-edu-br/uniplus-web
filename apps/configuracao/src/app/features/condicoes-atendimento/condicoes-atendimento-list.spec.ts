import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApplicationRef } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import {
  CONFIGURACAO_BASE_PATH,
  CondicaoAtendimentoDto,
} from '@uniplus/shared-data/configuracao';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CondicoesAtendimentoListPage } from './condicoes-atendimento-list';

const BASE = 'http://localhost:5000';
const CONDICAO_ATENDIMENTO_ID = '019f41cf-69fd-759a-ac6d-09acabc1b027';
const condicao_atendimento_seed: CondicaoAtendimentoDto = {
  'id': CONDICAO_ATENDIMENTO_ID,
  codigo: 'PCD',
  nome: 'Pcd',
  descricao: 'LBI (Lei 13.146/2015), art. 30',
  criadoEm: '2026-07-07T13:23:42.707136+00:00',
};

describe('CondicoesAtendimentoListPage', () => {
  let fixture: ComponentFixture<CondicoesAtendimentoListPage>;
  let component: CondicoesAtendimentoListPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CondicoesAtendimentoListPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(CondicoesAtendimentoListPage);
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

  async function flushLista(items: readonly CondicaoAtendimentoDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/condicoes-atendimento`);
    expect(req.request.params.get('limit')).toBe('50');
    req.flush(items);
    await propagate();
  }

  function getSalvarOuEditarButtonEl() {
    return fixture.nativeElement.querySelector(
      'button[form="cfg-unidade-form"]',
    ) as HTMLButtonElement;
  }

  function getInativarButtonEl(): HTMLButtonElement {
    return fixture.nativeElement.querySelector(
      'td.table-responsive__actions > button:last-child',
    ) as HTMLButtonElement;
  }

  function getEditarButtonEl(): HTMLButtonElement {
    return fixture.nativeElement.querySelector(
      'td.table-responsive__actions > button:first-child',
    ) as HTMLButtonElement;
  }

  // Pós-mutação, `recarregar()` só dá reload no resource da lista principal —
    // os lookups de Curso/Local de oferta já estão em cache e não recarregam.
    async function flushRecarregarLista(items: readonly CondicaoAtendimentoDto[]): Promise<void> {
      await propagate();
      controller
        .expectOne((r) => r.url === `${BASE}/api/configuracao/condicoes-atendimento`)
        .flush(items);
      await propagate();
    }

  it('drawer mostra empty-state quando condições não tem ofertas vivas', async () => {
    await flushLista([]);

    await propagate();

    expect(component['condicoes']()).toHaveLength(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhuma condição de atendimento carregada');
  });

  it('busca sem resultado mostra o empty-state de filtro, não o de lista vazia', async () => {
    await flushLista([condicao_atendimento_seed]);

    component['termoBusca'].set('condicao-inexistente');
    fixture.detectChanges();

    expect(component['condicoesFiltradas']()).toHaveLength(0);
    expect(fixture.nativeElement.textContent).toContain('Nenhuma condição de atendimento encontrada');
    expect(fixture.nativeElement.textContent).toContain('Ajuste a busca para ver resultados.');
    expect(fixture.nativeElement.textContent).not.toContain('Nenhuma condição de atendimento carregada');
  });

  it('renderiza a lista de condições de atendimento', async () => {
    await flushLista([condicao_atendimento_seed]);
    expect(component['condicoes']()).toHaveLength(1);

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('PCD');
    expect(fixture.nativeElement.textContent).toContain('Pcd');
    expect(fixture.nativeElement.textContent).toContain('LBI (Lei 13.146/2015), art. 30');
  });

  it('envia null no nome preenchido só com espaços', async () => {
    await flushLista([]);

    component['abrirDrawerCriacao']();
    // `required` + `minLength(2)` aceitam espaços em branco: sem normalizar, o
    // payload levaria '' e o backend responderia sobre formato, não ausência.
    component['form'].setValue({ codigo: 'PCD', nome: '   ', descricao: ' ' });

    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/condicoes-atendimento`);
    expect(post.request.body).toMatchObject({ codigo: 'PCD', nome: null, descricao: null });
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([]);
  });

  it('cria condição de atendimento com código único, nome, descrição válidos', async () => {
      await flushLista([]);

      component['abrirDrawerCriacao']();
      component['form'].setValue({
        codigo: 'PCD',
        nome: 'Pcd',
        descricao: 'LBI (Lei 13.146/2015), art. 30',
      });
      const key = component['idempotencyKeyAtual']();

      component['salvar']();

      const post = controller.expectOne(`${BASE}/api/configuracao/admin/condicoes-atendimento`);
      expect(post.request.method).toBe('POST');
      expect(post.request.headers.get('Idempotency-Key')).toBe(key);
      expect(post.request.body).toMatchObject({
        codigo: 'PCD',
        nome: 'Pcd',
        descricao: 'LBI (Lei 13.146/2015), art. 30'
      });
      post.flush('new-id', { status: 201, statusText: 'Created' });
      await propagate();

      expect(component['formOpen']()).toBe(false);
      expect(component['modo']()).toBe('criar');
      await flushLista([condicao_atendimento_seed]);
  });

  it('bloqueia salvar com campos obrigatórios vazios', async () => {
    await flushLista([]);
    component['abrirDrawerCriacao']();
    fixture.detectChanges();

    const submit = getSalvarOuEditarButtonEl();

    component['salvar']();

    expect(submit.disabled).toBe(true);
    controller.expectNone(`${BASE}/api/configuracao/admin/condicoes-atendimento`);
    expect(component['modo']()).toBe('criar');
  });

  it('código duplicado (409) é mapeado ao campo Nome sem fechar o drawer', async () => {
    await flushLista([]);

    component['abrirDrawerCriacao']();
    component['form'].setValue({
      codigo: 'PCD',
      nome: 'Pcd II',
      descricao: '',
    });

    component['salvar']();
    const post = controller.expectOne(`${BASE}/api/configuracao/admin/condicoes-atendimento`);
    post.flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.configuracao.condicao_atendimento.codigo_ja_existe',
        title: 'Já existe uma condição de atendimento ativa com este código',
        status: 409,
        code: 'uniplus.configuracao.condicao_atendimento.codigo_ja_existe',
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

  it('desabilita o botão de inativação quando o código é "PCD"', async () => {
    await flushLista([condicao_atendimento_seed]);

    fixture.detectChanges();

    expect(getInativarButtonEl().disabled).toBe(true);
  });

  it('simula cenário que a primeira requisição falha e tenta novamente com sucesso', async () => {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/condicoes-atendimento`);
    req.flush(null, { status: 500, statusText: 'Error' });
    await propagate();
    const tentarNovamenteButtonEl = fixture.nativeElement.querySelector(
      '.cfg-campi__retry > button',
    ) as HTMLButtonElement;
    expect(tentarNovamenteButtonEl).toBeTruthy();

    tentarNovamenteButtonEl.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    await flushRecarregarLista([condicao_atendimento_seed,]);
    expect(component['condicoes']()).toHaveLength(1);
  });

  it('exibe tag com valor "Protegido" quando o código é "PCD"', async () => {
    await flushLista([condicao_atendimento_seed]);
    fixture.detectChanges();

    const tagEl = fixture.debugElement.query(By.css('ui-tag[variant="warning"]'));
    expect(tagEl).toBeTruthy();
    expect((tagEl.nativeElement as HTMLSpanElement).textContent).contain('Protegido');
  });

  it('filtra a lista client-side por código ou nome', async () => {
    const outraCondicaoAtendimento: CondicaoAtendimentoDto = {
      ...condicao_atendimento_seed,
      id: '2',
      codigo: 'DISLEXIA',
      nome: 'Dislexia'
    };
    await flushLista([condicao_atendimento_seed, outraCondicaoAtendimento]);

    component['termoBusca'].set('DISLEXIA');
    fixture.detectChanges();

    expect(component['condicoesFiltradas']()).toHaveLength(1);
    expect(component['condicoesFiltradas']()[0].codigo).toBe('DISLEXIA');
  });

  it('desabilita o campo de edição do código quando é "PCD"', async () => {
    await flushLista([condicao_atendimento_seed]);

    component['abrirEdicao'](condicao_atendimento_seed);
    await propagate();

    expect(component['form'].controls.codigo.disabled).toBe(true);
    expect(component['modo']()).toBe('editar');
    expect(component['formOpen']()).toBe(true);

    const edicaoButtonEl = getSalvarOuEditarButtonEl();

    component['form'].setValue({
      codigo: condicao_atendimento_seed.codigo,
      nome: 'Pcd II',
      descricao: '',
    });

    controller.expectNone(`${BASE}/api/configuracao/admin/condicoes-atendimento/${CONDICAO_ATENDIMENTO_ID}`);
    expect(component['modo']()).toBe('editar');
    expect(edicaoButtonEl.disabled).toBe(false);
    expect(component['formOpen']()).toBe(true);
  });

  it('edita campos de nome e descrição', async () => {
    const NOVO_NOME_PCD = 'PCD_V2';
    const NOVA_DESCRICAO_PCD = 'LBI (Lei 14.000/2020), art. 12';
    const condicao_atendimento: CondicaoAtendimentoDto = {
      ...condicao_atendimento_seed,
      nome: NOVO_NOME_PCD,
      descricao: NOVA_DESCRICAO_PCD
    };

    await flushLista([condicao_atendimento_seed]);

    component['abrirEdicao'](condicao_atendimento_seed);
    await propagate();

    component['form'].controls.nome.setValue(NOVO_NOME_PCD);
    component['form'].controls.descricao.setValue(NOVA_DESCRICAO_PCD);
    component['salvar']();

    const put = controller.expectOne(`${BASE}/api/configuracao/admin/condicoes-atendimento/${CONDICAO_ATENDIMENTO_ID}`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body.nome).toBe(NOVO_NOME_PCD);
    expect(put.request.body.descricao).toBe(NOVA_DESCRICAO_PCD);
    put.flush(null, { status: 204, statusText: 'No Content' });
    await flushRecarregarLista([condicao_atendimento]);
  });

  it('desabilita as ações da linha (Editar e Inativar) durante a recarga da lista', async () => {
    // Condição não-PCD: o "Inativar" do PCD é desabilitado por regra própria, à parte do loading.
    const condicaoAtiva = { ...condicao_atendimento_seed, codigo: 'MOBIL', nome: 'Mobilidade' };

    // Estado estável: lista carregada, nada em voo — os botões da linha estão habilitados.
    await flushLista([condicaoAtiva]);
    fixture.detectChanges();
    expect(component['loading']()).toBe(false);
    expect(getEditarButtonEl().disabled).toBe(false);
    expect(getInativarButtonEl().disabled).toBe(false);

    // Recarga real: reload() deixa loading()=true com o GET em voo, preservando a linha.
    component['tentarNovamente']();
    await propagate();
    fixture.detectChanges();
    expect(component['loading']()).toBe(true);
    expect(getEditarButtonEl().disabled).toBe(true);
    expect(getInativarButtonEl().disabled).toBe(true);

    // Encerra o GET pendente para o controller.verify() do afterEach.
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/condicoes-atendimento`)
      .flush([condicaoAtiva]);
    await propagate();
  });
});
