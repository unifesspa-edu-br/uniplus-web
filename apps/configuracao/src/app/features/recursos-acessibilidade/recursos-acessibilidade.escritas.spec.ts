import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  RecursoAcessibilidadeDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EdicaoDosRecursosAcessibilidade } from './edicao-dos-recursos-acessibilidade';
import { RecursosAcessibilidadeListPage } from './recursos-acessibilidade-list.page';
import { RecursosAcessibilidadeStore } from './recursos-acessibilidade.store';

const BASE = 'http://localhost:5000';
const LISTA = `${BASE}/api/configuracao/recursos-acessibilidade`;
const ESCRITA = `${BASE}/api/configuracao/admin/recursos-acessibilidade`;
const recurso: RecursoAcessibilidadeDto = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b027',
  codigo: 'LEDOR',
  nome: 'Ledor',
  descricao: 'Leitura da prova.',
  criadoEm: '2026-07-07T13:23:42Z',
};

describe('Recursos de acessibilidade — escritas', () => {
  let fixture: ComponentFixture<RecursosAcessibilidadeListPage>;
  let edicao: EdicaoDosRecursosAcessibilidade;
  let store: RecursosAcessibilidadeStore;
  let controller: HttpTestingController;
  let app: ApplicationRef;

  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    app.tick();
    fixture.detectChanges();
  };
  const elemento = <T extends HTMLElement>(seletor: string): T => {
    const encontrado = fixture.nativeElement.querySelector(seletor) as T | null;
    expect(encontrado, seletor).not.toBeNull();
    return encontrado as T;
  };
  const salvar = (): HTMLButtonElement => elemento('button[form="cfg-unidade-form"]');
  const lista = async (): Promise<void> => {
    controller.expectOne((r) => r.url === LISTA).flush([recurso]);
    await propagar();
  };
  const preencher = async (): Promise<void> => {
    elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
    await propagar();
    const nome = elemento<HTMLInputElement>('input[formcontrolname="nome"]');
    nome.value = 'Ledor';
    nome.dispatchEvent(new Event('input'));
    await propagar();
  };
  const iniciarRemocao = async (): Promise<void> => {
    elemento<HTMLButtonElement>(
      'button[aria-label="Remover recurso de acessibilidade Ledor"]',
    ).click();
    await propagar();
    const botoes = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        'ui-dialog button',
      ),
    ];
    const confirmar = botoes.find((botao) => botao.textContent?.trim() === 'Remover');
    expect(confirmar).toBeDefined();
    confirmar?.click();
    await propagar();
  };
  const recusar = (): void => {
    controller.expectOne(ESCRITA).flush(
      JSON.stringify({
        type: 'about:blank',
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        traceId: 'test-trace',
        errors: [
          {
            field: 'Nome',
            code: 'uniplus.configuracao.recurso_acessibilidade.invalido',
            message: 'Nome recusado.',
          },
        ],
      }),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
  };

  beforeEach(async () => {
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
    edicao = fixture.debugElement.injector.get(EdicaoDosRecursosAcessibilidade);
    store = fixture.debugElement.injector.get(RecursosAcessibilidadeStore);
    controller = TestBed.inject(HttpTestingController);
    app = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
    await lista();
  });
  afterEach(() => controller.verify());

  it('mantém valores e foco, desabilita campos e impede fechar durante o envio', async () => {
    await preencher();
    const botao = salvar();
    botao.focus();
    botao.click();
    const post = controller.expectOne(ESCRITA);
    await propagar();
    const nome = elemento<HTMLInputElement>('input[formcontrolname="nome"]');
    expect(nome.matches(':disabled')).toBe(true);
    expect(nome.value).toBe('Ledor');
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    expect(botao.getAttribute('aria-busy')).toBe('true');
    expect(botao.textContent).toContain('Salvando...');
    expect(document.activeElement).toBe(botao);
    expect(elemento<HTMLButtonElement>('.form-drawer__footer button').disabled).toBe(true);
    const dialogo = elemento<HTMLDialogElement>(
      'dialog[aria-label="Formulário do recurso de acessibilidade"]',
    );
    expect(dialogo.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled).toBe(
      true,
    );
    dialogo.dispatchEvent(new Event('cancel', { cancelable: true }));
    await propagar();
    expect(edicao.formOpen()).toBe(true);
    post.flush('id', { status: 201, statusText: 'Created' });
    await propagar();
    expect(edicao.formOpen()).toBe(false);
    await lista();
  });

  it('recusa clique e submit enquanto salva', async () => {
    const chamada = vi.spyOn(edicao, 'salvar');
    await preencher();
    salvar().click();
    const post = controller.expectOne(ESCRITA);
    await propagar();
    salvar().click();
    elemento<HTMLFormElement>('#cfg-unidade-form').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await propagar();
    expect(chamada).toHaveBeenCalledTimes(1);
    post.flush('id', { status: 201, statusText: 'Created' });
    await propagar();
    await lista();
  });

  it('mostra a recusa no campo e leva o foco ao primeiro campo recusado', async () => {
    await preencher();
    salvar().focus();
    salvar().click();
    await propagar();
    recusar();
    await propagar();
    await propagar();
    const nome = elemento<HTMLInputElement>('input[formcontrolname="nome"]');
    expect(nome.getAttribute('aria-invalid')).toBe('true');
    expect(nome.closest('label')?.querySelector('.field__error')?.textContent?.trim()).toBe(
      'Nome recusado.',
    );
    expect(document.activeElement).toBe(nome);
  });

  it('devolve o foco ao acionador depois do sucesso', async () => {
    const acionador = elemento<HTMLButtonElement>('.panel-head .btn--primary');
    acionador.focus();
    await preencher();
    salvar().focus();
    salvar().click();
    controller.expectOne(ESCRITA).flush('id', { status: 201, statusText: 'Created' });
    await propagar();
    await propagar();
    expect(document.activeElement).toBe(acionador);
    await lista();
  });

  it.each(['sucesso', 'recusa'])('preserva controle desabilitado após %s', async (resultado) => {
    await preencher();
    edicao.form.controls.descricao.disable();
    edicao.salvar();
    expect(edicao.form.controls.nome.enabled).toBe(true);
    if (resultado === 'sucesso') {
      controller.expectOne(ESCRITA).flush('id', { status: 201, statusText: 'Created' });
    } else recusar();
    await propagar();
    expect(edicao.form.controls.descricao.disabled).toBe(true);
    expect(edicao.form.controls.nome.enabled).toBe(true);
    if (resultado === 'sucesso') await lista();
  });

  it('impede escritas concorrentes e mantém a trava durante a recarga', async () => {
    await preencher();
    edicao.salvar();
    edicao.salvar();
    edicao.abrirRemoverRecurso(recurso);
    edicao.removerConfirmado();
    controller.expectNone(`${ESCRITA}/${recurso.id}`);
    controller.expectOne(ESCRITA).flush('id', { status: 201, statusText: 'Created' });
    await propagar();
    expect(edicao.saving()).toBe(true);
    edicao.abrirDrawerCriacao();
    edicao.salvar();
    edicao.abrirRemoverRecurso(recurso);
    edicao.removerConfirmado();
    controller.expectNone(ESCRITA);
    controller.expectNone(`${ESCRITA}/${recurso.id}`);
    await lista();
    expect(edicao.saving()).toBe(false);
  });

  it('durante remoção recusa salvamento e bloqueia acionadores', async () => {
    await preencher();
    edicao.fechar();
    await propagar();
    await iniciarRemocao();
    const exclusao = controller.expectOne(`${ESCRITA}/${recurso.id}`);
    expect(edicao.salvando()).toBe(false);
    expect(edicao.removendo()).toBe(true);
    for (const botao of (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      'cfg-recursos-acessibilidade-lista button',
    )) {
      expect(botao.disabled || botao.getAttribute('aria-disabled') === 'true').toBe(true);
      botao.click();
    }
    edicao.salvar();
    controller.expectNone(ESCRITA);
    expect(edicao.formOpen()).toBe(false);
    exclusao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    expect(edicao.removendo()).toBe(true);
    await lista();
  });

  it('anuncia o início e o fim da remoção na região de status', async () => {
    await iniciarRemocao();
    const exclusao = controller.expectOne(`${ESCRITA}/${recurso.id}`);
    expect(elemento('[role="status"]').textContent).toContain('Removendo');
    exclusao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    await lista();
    expect(elemento('[role="status"]').textContent).toContain('removido');
  });

  it('recusa tentar novamente com remoção pendente e falha na listagem', async () => {
    await iniciarRemocao();
    const exclusao = controller.expectOne(`${ESCRITA}/${recurso.id}`);
    store.recarregar();
    await propagar();
    controller
      .expectOne((r) => r.url === LISTA)
      .flush(null, { status: 503, statusText: 'Indisponível' });
    await propagar();
    const tentar = elemento<HTMLButtonElement>('ui-alert button');
    expect(tentar.disabled || tentar.getAttribute('aria-disabled') === 'true').toBe(true);
    tentar.click();
    await propagar();
    controller.expectNone((r) => r.url === LISTA);
    exclusao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    await lista();
  });
});
