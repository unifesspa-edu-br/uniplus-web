import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, TipoProcessoDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EdicaoDosTiposProcesso } from './edicao-dos-tipos-processo';
import { TiposProcessoPage } from './tipos-processo.page';

const BASE = 'http://localhost:5000';
const URL = `${BASE}/api/configuracao/admin/tipos-processo`;
const tipo: TipoProcessoDto = {
  id: '01960000-0000-7000-0000-000000000051',
  codigo: 'SISU',
  nome: 'SiSU',
  descricao: null,
  ativo: true,
  criadoEm: '2026-08-11T12:00:00Z',
};

describe('TiposProcessoPage — escritas pela interface', () => {
  let fixture: ComponentFixture<TiposProcessoPage>;
  let edicao: EdicaoDosTiposProcesso;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();
  };
  const elemento = <T extends HTMLElement>(seletor: string): T => {
    const el = fixture.nativeElement.querySelector(seletor) as T | null;
    expect(el, seletor).not.toBeNull();
    return el as T;
  };
  const lista = async (): Promise<void> => {
    controller.expectOne((r) => r.url === URL).flush([tipo]);
    await propagar();
  };
  const preencher = async (): Promise<void> => {
    elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
    await propagar();
    const nome = elemento<HTMLInputElement>('input[formcontrolname="nome"]');
    nome.value = 'Processo seletivo';
    nome.dispatchEvent(new Event('input'));
    await propagar();
  };
  const enviar = (): void =>
    elemento<HTMLButtonElement>('button[form="cfg-tipo-processo-form"]').click();
  const concluir = async (): Promise<void> => {
    controller.expectOne(URL).flush('id', { status: 201, statusText: 'Created' });
    await propagar();
    await lista();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TiposProcessoPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: PermissoesService, useValue: { tem: () => true } },
      ],
    });
    fixture = TestBed.createComponent(TiposProcessoPage);
    edicao = fixture.debugElement.injector.get(EdicaoDosTiposProcesso);
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
    await lista();
  });
  afterEach(() => controller.verify());

  it('mantém o formulário somente leitura e impede fechar durante o envio', async () => {
    await preencher();
    const salvar = elemento<HTMLButtonElement>('button[form="cfg-tipo-processo-form"]');
    salvar.focus();
    enviar();
    await propagar();
    expect(elemento<HTMLFieldSetElement>('fieldset.form-drawer__campos').disabled).toBe(true);
    expect(elemento<HTMLInputElement>('input[formcontrolname="nome"]').matches(':disabled')).toBe(
      true,
    );
    expect(elemento<HTMLInputElement>('input[formcontrolname="nome"]').value).toBe(
      'Processo seletivo',
    );
    expect(salvar.getAttribute('aria-disabled')).toBe('true');
    expect(salvar.getAttribute('aria-busy')).toBe('true');
    expect(salvar.textContent).toContain('Salvando...');
    expect(document.activeElement).toBe(salvar);
    expect(elemento<HTMLButtonElement>('.form-drawer__footer button').disabled).toBe(true);
    const dialog = elemento<HTMLDialogElement>(
      'dialog[aria-label="Formulário de tipo de processo"]',
    );
    expect(dialog.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled).toBe(
      true,
    );
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await propagar();
    expect(edicao.formOpen()).toBe(true);
    await concluir();
  });

  it('recusa clique e envio adicionais enquanto salva', async () => {
    await preencher();
    const salvar = vi.spyOn(edicao, 'salvar');
    enviar();
    await propagar();
    enviar();
    elemento<HTMLFormElement>('#cfg-tipo-processo-form').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await propagar();
    expect(salvar).toHaveBeenCalledTimes(1);
    await concluir();
  });

  it('anuncia a inativação e mantém acionadores indisponíveis até concluir a recarga', async () => {
    elemento<HTMLButtonElement>('button[aria-label="Inativar tipo de processo SISU"]').click();
    await propagar();
    elemento<HTMLButtonElement>('cfg-tipo-processo-confirmacao .btn--primary').click();
    await propagar();
    const requisicao = controller.expectOne(`${URL}/${tipo.id}`);
    expect(elemento('[role="status"]').textContent).toContain(
      'Inativando o tipo de processo SISU.',
    );
    expect(
      elemento<HTMLButtonElement>('.panel-head .btn--primary').getAttribute('aria-disabled'),
    ).toBe('true');
    expect(
      elemento<HTMLButtonElement>('button[aria-label="Editar tipo de processo SISU"]').disabled,
    ).toBe(true);
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    expect(edicao.gravando()).toBe(true);
    elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
    expect(edicao.formOpen()).toBe(false);
    expect(elemento('[role="status"]').textContent).toContain('Operação concluída para SISU.');
    await lista();
    expect(edicao.gravando()).toBe(false);
  });

  it('foca o primeiro campo inválido após validar o formulário', async () => {
    elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
    await propagar();
    const salvar = elemento<HTMLButtonElement>('button[form="cfg-tipo-processo-form"]');
    salvar.focus();
    enviar();
    await propagar();
    await propagar();
    const codigo = elemento<HTMLInputElement>('input[formcontrolname="codigo"]');
    expect(document.activeElement).toBe(codigo);
    expect(codigo.getAttribute('aria-describedby')).toContain('cfg-tproc-codigo-erro');
    expect(elemento('#cfg-tproc-codigo-erro').textContent).toContain('Campo obrigatório.');
    controller.expectNone(URL);
  });

  it.each([
    ['A', 'Valor abaixo do tamanho mínimo.'],
    ['1A', 'Use caixa alta, começando por letra, com letras, números e sublinhado.'],
  ])('exibe orientação para o código inválido %s', async (codigo, mensagem) => {
    elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
    await propagar();
    edicao.form.setValue({ codigo, nome: 'Processo seletivo', descricao: '' });
    enviar();
    await propagar();
    const campo = elemento<HTMLInputElement>('input[formcontrolname="codigo"]');
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(campo.getAttribute('aria-describedby')).toContain('cfg-tproc-codigo-erro');
    expect(elemento('#cfg-tproc-codigo-erro').textContent).toContain(mensagem);
    controller.expectNone(URL);
  });

  it('leva o foco ao campo recusado pelo servidor', async () => {
    await preencher();
    enviar();
    controller.expectOne(URL).flush(
      JSON.stringify({
        type: 'about:blank',
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        traceId: 'test-trace',
        errors: [
          {
            field: 'Nome',
            code: 'uniplus.configuracao.tipo_processo.invalido',
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
    await propagar();
    await propagar();
    expect(elemento('input[formcontrolname="nome"]').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(elemento('input[formcontrolname="nome"]'));
  });

  it('bloqueia escritas concorrentes durante o envio', async () => {
    await preencher();
    edicao.salvar();
    edicao.salvar();
    edicao.pedirRemocao(tipo);
    edicao.removerConfirmado();
    edicao.pedirReativacao({ ...tipo, ativo: false });
    edicao.reativarConfirmado();
    controller.expectNone(`${URL}/${tipo.id}`);
    controller.expectNone(`${URL}/${tipo.id}/ativacao`);
    await concluir();
  });
  it('preserva controle desabilitado no modelo após recusa', async () => {
    await preencher();
    edicao.form.controls.descricao.disable();
    enviar();
    controller.expectOne(URL).flush(
      JSON.stringify({
        type: 'about:blank',
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        errors: [
          {
            field: 'Nome',
            code: 'uniplus.configuracao.tipo_processo.invalido',
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
    await propagar();
    expect(edicao.form.controls.descricao.disabled).toBe(true);
    expect(edicao.form.controls.nome.enabled).toBe(true);
  });

  it('recusa salvar e reativar durante a inativação', async () => {
    await preencher();
    edicao.pedirRemocao(tipo);
    edicao.removerConfirmado();
    edicao.salvar();
    edicao.pedirReativacao({ ...tipo, ativo: false });
    edicao.reativarConfirmado();
    controller.expectNone(URL);
    controller.expectNone(`${URL}/${tipo.id}/ativacao`);
    controller
      .expectOne(`${URL}/${tipo.id}`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    await lista();
  });
});
