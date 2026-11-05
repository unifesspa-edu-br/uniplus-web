import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, TipoDeficienciaDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EdicaoDosTiposDeficiencia } from './edicao-dos-tipos-deficiencia';
import { TiposDeficienciaListPage } from './tipos-deficiencia-list.page';
import { TiposDeficienciaStore } from './tipos-deficiencia.store';

const BASE = 'http://localhost:5000';
const LISTA = `${BASE}/api/configuracao/tipos-deficiencia`;
const ESCRITA = `${BASE}/api/configuracao/admin/tipos-deficiencia`;
const tipo: TipoDeficienciaDto = {
  id: '01960000-0000-7000-0000-0000000000b1',
  codigo: 'VISUAL',
  nome: 'Visual',
  descricao: 'Baixa visão',
  permanente: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

describe('TiposDeficienciaListPage — escritas', () => {
  let fixture: ComponentFixture<TiposDeficienciaListPage>;
  let edicao: EdicaoDosTiposDeficiencia;
  let store: TiposDeficienciaStore;
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
  const lista = async (): Promise<void> => {
    controller.expectOne((r) => r.url === LISTA).flush([tipo]);
    await propagar();
  };
  const preencher = async (): Promise<void> => {
    elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
    await propagar();
    for (const [campo, valor] of [
      ['nome', 'Auditiva'],
      ['descricao', 'Descrição'],
    ]) {
      const input = elemento<HTMLInputElement>(`[formcontrolname="${campo}"]`);
      input.value = valor;
      input.dispatchEvent(new Event('input'));
    }
    await propagar();
  };
  const salvar = (): HTMLButtonElement => elemento('button[form="cfg-tipo-deficiencia-form"]');
  const recusar = (): void => {
    controller.expectOne(ESCRITA).flush(
      JSON.stringify({
        type: 'about:blank',
        title: 'Inválido',
        status: 422,
        code: 'uniplus.validacao',
        errors: [
          {
            field: 'Nome',
            code: 'uniplus.configuracao.tipo_deficiencia.invalido',
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
  const remover = async (): Promise<void> => {
    elemento<HTMLButtonElement>('button[aria-label="Remover tipo de deficiência VISUAL"]').click();
    await propagar();
    elemento<HTMLButtonElement>('ui-dialog .btn--danger').click();
    await propagar();
  };

  beforeEach(async () => {
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
    edicao = fixture.debugElement.injector.get(EdicaoDosTiposDeficiencia);
    store = fixture.debugElement.injector.get(TiposDeficienciaStore);
    controller = TestBed.inject(HttpTestingController);
    app = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
    await lista();
  });
  afterEach(() => controller.verify());

  it('durante o envio mantém valores e foco, bloqueia campos e fechamento', async () => {
    await preencher();
    const botao = salvar();
    botao.focus();
    botao.click();
    const post = controller.expectOne(ESCRITA);
    await propagar();
    const nome = elemento<HTMLInputElement>('input[formcontrolname="nome"]');
    expect(nome.matches(':disabled')).toBe(true);
    expect(nome.value).toBe('Auditiva');
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    expect(botao.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(botao);
    expect(elemento<HTMLButtonElement>('.form-drawer__footer .btn--tertiary').disabled).toBe(true);
    const dialog = elemento<HTMLDialogElement>(
      'dialog[aria-label="Formulário do tipo de deficiência"]',
    );
    expect(dialog.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled).toBe(
      true,
    );
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await propagar();
    expect(edicao.formOpen()).toBe(true);
    post.flush('id', { status: 201, statusText: 'Created' });
    await propagar();
    expect(edicao.formOpen()).toBe(false);
    await lista();
  });

  it('recusa clique e submissão repetidos durante envio', async () => {
    const chamada = vi.spyOn(edicao, 'salvar');
    await preencher();
    salvar().click();
    const post = controller.expectOne(ESCRITA);
    await propagar();
    salvar().click();
    elemento<HTMLFormElement>('#cfg-tipo-deficiencia-form').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    expect(chamada).toHaveBeenCalledTimes(1);
    post.flush('id', { status: 201, statusText: 'Created' });
    await propagar();
    await lista();
  });

  it('a recusa marca o campo e move o foco para ele', async () => {
    await preencher();
    salvar().focus();
    salvar().click();
    await propagar();
    recusar();
    await propagar();
    await propagar();
    const nome = elemento<HTMLInputElement>('input[formcontrolname="nome"]');
    expect(nome.getAttribute('aria-invalid')).toBe('true');
    expect(elemento('#cfg-td-nome-erro').textContent).toContain('Nome recusado.');
    expect(document.activeElement).toBe(nome);
  });

  it('devolve o foco ao acionador após salvar', async () => {
    const acionador = elemento<HTMLButtonElement>('.panel-head .btn--primary');
    acionador.focus();
    await preencher();
    salvar().focus();
    salvar().click();
    await propagar();
    controller.expectOne(ESCRITA).flush('id', { status: 201, statusText: 'Created' });
    await propagar();
    await propagar();
    expect(document.activeElement).toBe(acionador);
    await lista();
  });

  it.each(['sucesso', 'recusa'])('preserva controle desabilitado após %s', async (resultado) => {
    await preencher();
    edicao.form.controls.codigo.disable();
    edicao.salvar();
    expect(edicao.form.controls.nome.enabled).toBe(true);
    if (resultado === 'sucesso') {
      controller.expectOne(ESCRITA).flush('id', { status: 201, statusText: 'Created' });
    } else recusar();
    await propagar();
    expect(edicao.form.controls.codigo.disabled).toBe(true);
    expect(edicao.form.controls.nome.enabled).toBe(true);
    if (resultado === 'sucesso') await lista();
  });

  it('anuncia remoção e recusa acionadores até terminar a recarga', async () => {
    await remover();
    const requisicao = controller.expectOne(`${ESCRITA}/${tipo.id}`);
    expect(edicao.salvando()).toBe(false);
    expect(elemento('ui-dialog [role="status"]').textContent).toContain(
      'Removendo o tipo de deficiência Visual.',
    );
    expect(elemento('.table-responsive__actions').textContent).toContain('Removendo');
    const novo = elemento<HTMLButtonElement>('.panel-head .btn--primary');
    expect(novo.getAttribute('aria-disabled')).toBe('true');
    novo.click();
    expect(edicao.formOpen()).toBe(false);
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    expect(edicao.gravando()).toBe(true);
    novo.click();
    expect(edicao.formOpen()).toBe(false);
    await lista();
    expect(edicao.gravando()).toBe(false);
    expect(elemento('span[role="status"]').textContent).toContain(
      'Tipo de deficiência Visual removido.',
    );
  });

  it('bloqueia nova tentativa de listagem durante remoção', async () => {
    await remover();
    const requisicao = controller.expectOne(`${ESCRITA}/${tipo.id}`);
    store.recarregar();
    await propagar();
    controller
      .expectOne((r) => r.url === LISTA)
      .flush('erro', { status: 503, statusText: 'Indisponível' });
    await propagar();
    const tentar = elemento<HTMLButtonElement>('ui-alert .cfg-campi__retry button');
    expect(tentar.getAttribute('aria-disabled')).toBe('true');
    tentar.click();
    controller.expectNone((r) => r.url === LISTA);
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    await lista();
  });

  it('impede escritas concorrentes durante salvamento e recarga', async () => {
    await preencher();
    edicao.salvar();
    edicao.salvar();
    edicao.abrirRemoverTipoDeficiencia(tipo);
    edicao.removerConfirmado();
    controller.expectNone(`${ESCRITA}/${tipo.id}`);
    controller.expectOne(ESCRITA).flush('id', { status: 201, statusText: 'Created' });
    await propagar();
    edicao.salvar();
    controller.expectNone(ESCRITA);
    await lista();
  });

  it('impede salvamento durante remoção', async () => {
    await preencher();
    edicao.formOpen.set(false);
    edicao.abrirRemoverTipoDeficiencia(tipo);
    edicao.removerConfirmado();
    edicao.salvar();
    controller.expectNone(ESCRITA);
    controller
      .expectOne(`${ESCRITA}/${tipo.id}`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    await lista();
  });
});
