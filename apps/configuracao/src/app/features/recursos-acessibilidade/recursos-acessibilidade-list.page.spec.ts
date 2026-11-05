import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { NotificationService } from '@uniplus/shared-core/notifications';
import { RecursosAcessibilidadeStore } from './recursos-acessibilidade.store';
import { EdicaoDosRecursosAcessibilidade } from './edicao-dos-recursos-acessibilidade';
import { RecursosAcessibilidadeListPage } from './recursos-acessibilidade-list.page.js';

const BASE = 'http://localhost:5000';
const RECURSO_ACESSIBILIDADE_ID = '019f41cf-69fd-759a-ac6d-09acabc1b027';
const recurso_acessibilidade_seed: RecursoAcessibilidadeDto = {
  id: RECURSO_ACESSIBILIDADE_ID,
  codigo: 'LEDOR',
  nome: 'Ledor',
  descricao: 'Leitura da prova em voz alta por fiscal designado.',
  criadoEm: '2026-07-07T13:23:42.707136+00:00',
};
const URL_REMOCAO = `${BASE}/api/configuracao/admin/recursos-acessibilidade/${RECURSO_ACESSIBILIDADE_ID}`;

describe('RecursosAcessibilidadeListPage', () => {
  let fixture: ComponentFixture<RecursosAcessibilidadeListPage>;
  let store: RecursosAcessibilidadeStore;
  let edicao: EdicaoDosRecursosAcessibilidade;
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
    store = fixture.debugElement.injector.get(RecursosAcessibilidadeStore);
    edicao = fixture.debugElement.injector.get(EdicaoDosRecursosAcessibilidade);
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
    const req = controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/recursos-acessibilidade`,
    );
    expect(req.request.params.get('limit')).toBe('50');
    req.flush(items);
    await propagate();
  }

  function getSalvarOuEditarButtonEl(): HTMLButtonElement {
    return fixture.nativeElement.querySelector(
      'button[form="cfg-unidade-form"]',
    ) as HTMLButtonElement;
  }

  function getRemoverButtonEl(): HTMLButtonElement {
    return fixture.nativeElement.querySelector(
      'td.table-responsive__actions button[aria-label^="Remover recurso de acessibilidade"]',
    ) as HTMLButtonElement;
  }

  function getEditarButtonEl(): HTMLButtonElement {
    return fixture.nativeElement.querySelector(
      'td.table-responsive__actions button[aria-label^="Editar recurso de acessibilidade"]',
    ) as HTMLButtonElement;
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

    expect(store.recursos()).toHaveLength(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Nenhum recurso de acessibilidade carregado',
    );
  });

  it('busca sem resultado mostra o empty-state de filtro, não o de lista vazia', async () => {
    await flushLista([recurso_acessibilidade_seed]);

    store.termoBusca.set('recurso-inexistente');
    fixture.detectChanges();

    expect(store.recursosFiltrados()).toHaveLength(0);
    expect(fixture.nativeElement.textContent).toContain(
      'Nenhum recurso de acessibilidade encontrado',
    );
    expect(fixture.nativeElement.textContent).toContain('Ajuste a busca para ver resultados.');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Nenhum recurso de acessibilidade carregado',
    );
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
    expect(store.recursos()).toHaveLength(1);
  });

  it('falha na carga mostra o alerta com o título de recursos de acessibilidade', async () => {
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/recursos-acessibilidade`)
      .flush(null, { status: 500, statusText: 'Error' });
    await propagate();
    fixture.detectChanges();

    const alerta: HTMLElement = fixture.nativeElement.querySelector('.alert--danger');
    expect(alerta.textContent).toContain('Não foi possível carregar os recursos de acessibilidade');
    expect(alerta.textContent).not.toContain('condições de atendimento');
  });

  it('renderiza a lista de recursos de acessibilidade', async () => {
    await flushLista([recurso_acessibilidade_seed]);
    expect(store.recursos()).toHaveLength(1);

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ledor');
    expect(fixture.nativeElement.textContent).toContain(
      'Leitura da prova em voz alta por fiscal designado.',
    );
  });

  it('envia null nos campos obrigatórios preenchidos só com espaços', async () => {
    await flushLista([]);

    edicao.abrirDrawerCriacao();
    // `Validators.required` aceita espaços em branco: sem normalizar, o payload
    // levaria '' e o backend responderia sobre formato, não sobre ausência.
    edicao.form.setValue({ nome: '   ', codigo: 'LEDOR', descricao: '  ' });

    edicao.salvar();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/recursos-acessibilidade`);
    expect(post.request.body).toMatchObject({ codigo: 'LEDOR', nome: null, descricao: null });
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([]);
  });

  it('cria recurso de acessibilidade com nome único, descrição válidos', async () => {
    await flushLista([]);

    edicao.abrirDrawerCriacao();
    edicao.form.setValue({
      nome: 'Ledor',
      codigo: 'LEDOR',
      descricao: 'Leitura da prova em voz alta por fiscal designado.',
    });
    const key = edicao.idempotencyKeyAtual();

    edicao.salvar();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/recursos-acessibilidade`);
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.get('Idempotency-Key')).toBe(key);
    expect(post.request.body).toMatchObject({
      codigo: 'LEDOR',
      nome: 'Ledor',
      descricao: 'Leitura da prova em voz alta por fiscal designado.',
    });
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();

    expect(edicao.formOpen()).toBe(false);
    expect(edicao.modo()).toBe('criar');
    await flushLista([recurso_acessibilidade_seed]);
  });

  it('bloqueia botão de salvar quando os campos obrigatórios estão vazios', async () => {
    await flushLista([]);
    edicao.abrirDrawerCriacao();
    fixture.detectChanges();

    const submit = getSalvarOuEditarButtonEl();
    edicao.salvar();

    expect(submit.disabled).toBe(true);
    controller.expectNone(`${BASE}/api/configuracao/admin/recursos-acessibilidade`);
    expect(edicao.modo()).toBe('criar');
  });

  it('nome duplicado (409) é mapeado ao campo Nome sem fechar o drawer', async () => {
    await flushLista([]);

    edicao.abrirDrawerCriacao();
    edicao.form.setValue({
      nome: 'Ledor',
      codigo: 'LEDOR',
      descricao: '',
    });
    edicao.salvar();
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

    expect(edicao.formOpen()).toBe(true);
    expect(edicao.form.controls.nome.errors?.['backend']).toBeTruthy();
  });

  it('a listagem mostra o código e a busca o encontra', async () => {
    const outro: RecursoAcessibilidadeDto = {
      ...recurso_acessibilidade_seed,
      id: '2',
      codigo: 'SALA_DE_FACIL_ACESSO',
      nome: 'Sala de fácil acesso',
    };
    await flushLista([recurso_acessibilidade_seed, outro]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('td[data-label="Código"] code')?.textContent).toBe(
      'LEDOR',
    );

    store.termoBusca.set('facil_acesso');

    expect(store.recursosFiltrados().map((r) => r.codigo)).toEqual(['SALA_DE_FACIL_ACESSO']);
  });

  it('o código é editável: o PUT leva o código trocado', async () => {
    await flushLista([recurso_acessibilidade_seed]);

    edicao.abrirEdicao(recurso_acessibilidade_seed);
    expect(edicao.form.controls.codigo.value).toBe('LEDOR');
    edicao.form.controls.codigo.setValue('LEDOR_DE_PROVA');
    edicao.salvar();

    const put = controller.expectOne(
      `${BASE}/api/configuracao/admin/recursos-acessibilidade/${RECURSO_ACESSIBILIDADE_ID}`,
    );
    expect(put.request.body).toMatchObject({
      id: RECURSO_ACESSIBILIDADE_ID,
      codigo: 'LEDOR_DE_PROVA',
    });
    put.flush(null, { status: 204, statusText: 'No Content' });
    await flushRecarregarLista([recurso_acessibilidade_seed]);
  });

  it('código duplicado (409) é mapeado ao campo Código sem fechar o drawer', async () => {
    await flushLista([]);

    edicao.abrirDrawerCriacao();
    edicao.form.setValue({ nome: 'Ledor', codigo: 'LEDOR', descricao: '' });
    edicao.salvar();
    controller.expectOne(`${BASE}/api/configuracao/admin/recursos-acessibilidade`).flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.configuracao.recurso_acessibilidade.codigo_ja_existe',
        title: 'Já existe um recurso de acessibilidade ativo com este código',
        status: 409,
        code: 'uniplus.configuracao.recurso_acessibilidade.codigo_ja_existe',
        traceId: 'test-trace',
      }),
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();
    fixture.detectChanges();

    expect(edicao.formOpen()).toBe(true);
    expect(edicao.form.controls.codigo.errors?.['backend']).toBeTruthy();
    expect(edicao.form.controls.nome.errors).toBeNull();
    expect(fixture.nativeElement.querySelector('#cfg-ra-codigo-erro')?.textContent).toContain(
      'Já existe um recurso de acessibilidade ativo com este código',
    );
  });

  it('a recusa de formato do código (422) aparece no campo Código', async () => {
    await flushLista([]);

    edicao.abrirDrawerCriacao();
    edicao.form.setValue({ nome: 'Ledor', codigo: 'LEDOR', descricao: '' });
    edicao.salvar();
    controller.expectOne(`${BASE}/api/configuracao/admin/recursos-acessibilidade`).flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.configuracao.recurso_acessibilidade.codigo_formato_invalido',
        title: 'O código do recurso de acessibilidade está fora do formato',
        status: 422,
        code: 'uniplus.configuracao.recurso_acessibilidade.codigo_formato_invalido',
        traceId: 'test-trace',
        errors: [
          {
            field: 'Codigo',
            code: 'uniplus.configuracao.recurso_acessibilidade.codigo_formato_invalido',
            message: 'O código do recurso de acessibilidade está fora do formato',
          },
        ],
      }),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(edicao.form.controls.codigo.errors?.['backend']).toEqual({
      code: 'uniplus.configuracao.recurso_acessibilidade.codigo_formato_invalido',
      message: 'O código do recurso de acessibilidade está fora do formato',
    });
  });

  it('filtra a lista client-side por nome', async () => {
    const outroRecursoAcessibilidade: RecursoAcessibilidadeDto = {
      ...recurso_acessibilidade_seed,
      id: '2',
      nome: 'Lupa eletrônica',
      descricao: 'amplificador de baixa visão.',
    };
    await flushLista([recurso_acessibilidade_seed, outroRecursoAcessibilidade]);

    store.termoBusca.set('Lupa eletrônica');
    fixture.detectChanges();

    expect(store.recursosFiltrados()).toHaveLength(1);
    expect(store.recursosFiltrados()[0].nome).toBe('Lupa eletrônica');
  });

  it('edita campos de nome', async () => {
    const NOVO_NOME = 'Ledor de Prova';
    const recurso_acessibilidade: RecursoAcessibilidadeDto = {
      ...recurso_acessibilidade_seed,
      nome: NOVO_NOME,
    };

    await flushLista([recurso_acessibilidade_seed]);

    edicao.abrirEdicao(recurso_acessibilidade_seed);
    await propagate();

    edicao.form.controls.nome.setValue(NOVO_NOME);
    edicao.salvar();

    const put = controller.expectOne(
      `${BASE}/api/configuracao/admin/recursos-acessibilidade/${RECURSO_ACESSIBILIDADE_ID}`,
    );
    expect(put.request.method).toBe('PUT');
    expect(put.request.body.nome).toBe(NOVO_NOME);
    put.flush(null, { status: 204, statusText: 'No Content' });
    await flushRecarregarLista([recurso_acessibilidade]);
  });

  it('desabilita as ações da linha (Editar e Remover) durante a recarga da lista', async () => {
    // Estado estável: lista carregada, nada em voo — os botões da linha estão habilitados.
    await flushLista([recurso_acessibilidade_seed]);
    fixture.detectChanges();
    expect(store.carregando()).toBe(false);
    expect(getEditarButtonEl().getAttribute('aria-disabled')).toBeNull();
    expect(getRemoverButtonEl().getAttribute('aria-disabled')).toBeNull();

    // Recarga real: reload() deixa loading()=true com o GET em voo, preservando a linha.
    store.tentarNovamente();
    await propagate();
    fixture.detectChanges();
    expect(store.carregando()).toBe(true);
    expect(getEditarButtonEl().getAttribute('aria-disabled')).toBe('true');
    expect(getRemoverButtonEl().getAttribute('aria-disabled')).toBe('true');
    getEditarButtonEl().click();
    getRemoverButtonEl().click();
    const busca = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    expect(busca.getAttribute('aria-disabled')).toBe('true');
    busca.value = 'Lupa';
    busca.dispatchEvent(new Event('input'));
    expect(busca.value).toBe('');
    expect(edicao.formOpen()).toBe(false);
    expect(edicao.confirmOpen()).toBe(false);

    // Encerra o GET pendente para o controller.verify() do afterEach.
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/recursos-acessibilidade`)
      .flush([recurso_acessibilidade_seed]);
    await propagate();
  });

  it('expõe legenda acessível descrevendo a tabela', async () => {
    await flushLista([recurso_acessibilidade_seed]);
    fixture.detectChanges();

    const caption = fixture.nativeElement.querySelector('table > caption');
    expect(caption).not.toBeNull();
    expect(caption?.classList.contains('sr-only')).toBe(true);
    expect(caption?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Recursos de acessibilidade, com código, nome e descrição',
    );
  });
  it('CA-13/CA-14: a tabela não tem a coluna Status e preserva as demais', async () => {
    await flushLista([recurso_acessibilidade_seed]);
    fixture.detectChanges();
    const cabecalhos = Array.from(
      fixture.nativeElement.querySelectorAll('thead th') as NodeListOf<HTMLElement>,
    ).map((th) => th.textContent?.trim());
    expect(cabecalhos).toEqual(['Código', 'Nome', 'Descrição', 'Ações']);
    expect(fixture.nativeElement.querySelector('td[data-label="Status"]')).toBeNull();
  });

  it('CA-03/CA-04/CA-06: botão e diálogo falam em remover, com o botão principal travado durante a remoção', async () => {
    await flushLista([recurso_acessibilidade_seed]);
    fixture.detectChanges();
    const lixeira = getRemoverButtonEl();
    expect(lixeira.getAttribute('data-tooltip')).toBe('Remover recurso de acessibilidade');
    expect(lixeira.querySelector('.pi-trash')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Inativar');

    lixeira.click();
    fixture.detectChanges();
    const dialogo = (
      Array.from(fixture.nativeElement.querySelectorAll('dialog')) as HTMLElement[]
    ).find((d) => d.textContent?.includes('prestes a')) as HTMLElement;
    expect(dialogo.textContent).toContain('Remover recurso de acessibilidade?');
    expect(dialogo.textContent).toContain('Você está prestes a remover o recurso Ledor.');
    const principal = () =>
      Array.from(
        dialogo.querySelectorAll('button.btn--danger') as NodeListOf<HTMLButtonElement>,
      )[0];
    expect(principal().textContent?.trim()).toBe('Remover');

    principal().click();
    fixture.detectChanges();
    expect(principal().disabled).toBe(true);
    expect(principal().textContent?.trim()).toBe('Removendo...');

    controller
      .expectOne((r) => r.url === URL_REMOCAO && r.method === 'DELETE')
      .flush(null, { status: 204, statusText: 'No Content' });
    await flushRecarregarLista([]);
  });

  it('CA-11: falha na remoção avisa o usuário e mantém o registro e o diálogo', async () => {
    const erroSpy = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
    await flushLista([recurso_acessibilidade_seed]);
    edicao.abrirRemoverRecurso(recurso_acessibilidade_seed);
    edicao.removerConfirmado();

    controller.expectOne(URL_REMOCAO).flush(
      {
        type: 'about:blank',
        title: 'Recurso de acessibilidade não encontrado',
        status: 404,
        code: 'uniplus.configuracao.recurso_acessibilidade.nao_encontrado',
      },
      {
        status: 404,
        statusText: 'Not Found',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(erroSpy).toHaveBeenCalled();
    expect(edicao.confirmOpen()).toBe(true);
    expect(edicao.saving()).toBe(false);
    controller.expectNone((r) => r.url === `${BASE}/api/configuracao/recursos-acessibilidade`);
  });
  it('mantém a gravação e as ações bloqueadas até concluir a recarga', async () => {
    await flushLista([recurso_acessibilidade_seed]);
    edicao.abrirEdicao(recurso_acessibilidade_seed);
    edicao.salvar();
    edicao.salvar();
    edicao.abrirRemoverRecurso(recurso_acessibilidade_seed);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('fieldset')?.matches(':disabled')).toBe(true);
    expect(getSalvarOuEditarButtonEl().getAttribute('aria-busy')).toBe('true');
    const put = controller.expectOne(URL_REMOCAO);
    expect(put.request.method).toBe('PUT');
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    fixture.detectChanges();
    expect(edicao.saving()).toBe(true);
    expect(getEditarButtonEl().getAttribute('aria-disabled')).toBe('true');
    expect(fixture.nativeElement.querySelector('tr [role="status"]')?.textContent).toContain(
      'Salvando',
    );
    await flushRecarregarLista([recurso_acessibilidade_seed]);
    expect(edicao.saving()).toBe(false);
  });

  it('impede o fechamento e mantém controles desabilitados após recusa de campo', async () => {
    await flushLista([]);
    edicao.abrirDrawerCriacao();
    edicao.form.setValue({ nome: 'Ledor', codigo: 'LEDOR', descricao: '' });
    edicao.form.controls.descricao.disable();
    edicao.salvar();
    edicao.fechar();
    expect(edicao.formOpen()).toBe(true);
    controller.expectOne(`${BASE}/api/configuracao/admin/recursos-acessibilidade`).flush(
      {
        title: 'Nome duplicado',
        status: 409,
        code: 'uniplus.configuracao.recurso_acessibilidade.nome_ja_existe',
      },
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();
    fixture.detectChanges();
    expect(edicao.form.controls.descricao.disabled).toBe(true);
    expect(edicao.form.controls.nome.errors?.['backend']).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('[formControlName="nome"]').getAttribute('aria-invalid'),
    ).toBe('true');
  });
});
